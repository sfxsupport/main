---
layout: blog-post
sfx_blog: true
featured: false
title: "Call Claude, OpenAI and Gemini from Apex: Complete Guide"
seo_title: "Call Claude, OpenAI & Gemini from Salesforce Apex"
description: "Call Claude, OpenAI and Gemini from Salesforce Apex with Named Credentials, HTTP callouts, bulk-safe Batch Apex and HttpCalloutMock tests."
date: 2026-11-25 00:30:00 +0530
last_modified_at: 2026-11-25 04:30:00 +0530
permalink: /blog/call-claude-openai-gemini-from-apex/
primary_category: "Salesforce + AI"
series: "LLMs from Apex"
categories:
  - salesforce-ai
tags:
  - call LLM from Apex
  - Apex callouts
  - Named Credentials
  - Claude API
  - OpenAI API
  - Gemini API
  - Salesforce AI
reading_time: "14 min read"
og_type: article
author_name: "Abhay Nama"
author_url: "https://www.linkedin.com/in/abhay-nama-0739793a7/"
image: /assets/images/blog/call-claude-openai-gemini-from-apex.jpg
image_alt: "Diagram of a Salesforce Apex class sending HTTP callouts through Named Credentials to the Claude, OpenAI and Gemini APIs"
proficiency: "Intermediate"
answer: "To call an LLM from Apex, store the vendor API key in an External Credential and point a Named Credential at the vendor URL. Send a JSON POST with HttpRequest to callout:Your_Named_Credential, parse the reply with JSON.deserializeUntyped, run bulk calls from Batch Apex that implements Database.AllowsCallouts, and test with HttpCalloutMock."
faq:
  - q: "Can I call OpenAI or Claude directly from Apex without the Einstein Trust Layer?"
    a: "Yes. A normal Apex HTTP callout through a Named Credential can reach api.anthropic.com, api.openai.com or generativelanguage.googleapis.com. Those calls do not go through the Einstein Trust Layer, so masking, logging and data-handling rules are your job."
  - q: "Where should I store the LLM API key in Salesforce?"
    a: "Put it in a principal parameter on an External Credential that uses the Custom authentication protocol, and send it with a custom header formula such as {!$Credential.Anthropic.apiKey}. Never put it in Apex, Custom Settings, Custom Metadata or Custom Labels."
  - q: "Why can't I call an LLM from an Apex trigger?"
    a: "Salesforce blocks synchronous callouts from triggers and fails with 'Callout from triggers are currently not supported.' Have the trigger only flag the record, then make the callout from Batch Apex or a Queueable that implements Database.AllowsCallouts."
  - q: "What is the maximum timeout for an LLM callout in Apex?"
    a: "Salesforce documents a default callout timeout of 10 seconds and a maximum of 120,000 milliseconds per callout. It also caps the total callout time in one transaction at 120 seconds, so set HttpRequest.setTimeout(120000) and keep max tokens modest for long generations."
  - q: "How do I write a test class for an Apex LLM callout?"
    a: "Implement HttpCalloutMock so it returns a sample vendor JSON body, register it with Test.setMock(HttpCalloutMock.class, mock), and assert on the parsed text, the token counts and the endpoint. Real callouts are not allowed in tests."
extra_css:
  - /assets/css/blog.css
toc:
  - id: prerequisites
    label: "Prerequisites"
  - id: direct-vs-models-api
    label: "Direct callout or Models API"
  - id: named-credentials
    label: "Store keys safely"
  - id: api-differences
    label: "How the three APIs differ"
  - id: apex-client
    label: "One Apex client for all three"
  - id: async-queueable
    label: "Run it in bulk (Batch Apex)"
  - id: test-class
    label: "Test class"
  - id: common-errors
    label: "Common errors and fixes"
  - id: cost-limits
    label: "Cost and limits"
  - id: solution-kit
    label: "Solution kit"
  - id: official-sources
    label: "Official sources"
---

Someone in your org wants a case summarised, an email drafted or a messy free-text field sorted into categories, and they've already picked a model: Claude, GPT or Gemini. Agentforce and Prompt Builder may not be licensed, may not support that model, or may just be more than the job needs. What you need is a clean, secure and testable way to call the model from Apex. This guide sets that up once for all three vendors, so every caller uses one common interface and switching providers means changing the provider, model ID and credential, not rewriting code.

## What do you need before calling an LLM from Apex?
{: #prerequisites}

- **A Salesforce org with API version 59.0 or later** (any edition that allows Apex callouts). External Credentials with custom headers are part of the current Named Credentials model, and Salesforce now calls the old "legacy" named credentials deprecated.
- **System Administrator access**, or the "Customize Application" and "Manage Named Credentials" permissions.
- **An API key from each vendor you plan to use:**
  - Anthropic: Claude Console (platform.claude.com) → API Keys.
  - OpenAI: OpenAI platform dashboard → API keys.
  - Google: Google AI Studio → Get API key. This guide uses the Gemini Developer API. Vertex AI uses Google Cloud OAuth instead, which is a different setup.
- **A model ID for each vendor that your account can use.** Model names change every few months. Confirm the current IDs on each vendor's models page before you deploy. The IDs in this post are examples.
- **Approval from your data protection lead** to send record data to that vendor. With a direct callout, Salesforce does not mask anything for you.

## Should you call the vendor directly or use the Salesforce Models API?
{: #direct-vs-models-api}

Salesforce offers its own Apex route to LLMs, the **Models API**, through the `aiplatform` namespace (`aiplatform.ModelsAPI.createGenerations()`). It runs through the Einstein Trust Layer and uses Salesforce-managed model names such as `sfdc_ai__DefaultOpenAIGPT4OmniMini`. A direct HTTP callout skips all of that and talks to the vendor's own API.

| Question | Direct callout (this guide) | Models API (`aiplatform`) |
|---|---|---|
| Licence needed | Only a vendor API key | Einstein generative AI features turned on in your org |
| Einstein Trust Layer (masking, audit) | No. You build your own controls | Yes |
| Model choice | Any model and feature the vendor offers on day one | Models Salesforce supports, plus Bring Your Own LLM setups |
| Billing | Vendor invoice, per token | Salesforce AI consumption under your contract |
| Latest vendor features (tools, structured output, caching) | Available right away | Depends on what Salesforce exposes |
| Best for | Internal tools, prototypes, specific model needs | Regulated data and Trust Layer requirements |

If your security team requires Trust Layer masking, use the Models API. If you need a specific model, a vendor-specific feature, or have no Einstein entitlement, use the direct pattern below. Either way, keep a human reviewer on anything customer-facing. Our [production-safe case summary pattern](/blog/salesforce-ai-case-summary-human-review/) explains why.

## How do I store the API keys safely with Named Credentials?
{: #named-credentials}

The key lives in an **External Credential** as a hidden principal parameter. The External Credential adds the auth header at runtime using a formula. Apex only ever sees `callout:Anthropic_API`, and the key never appears in code, debug logs or deployments.

Repeat these steps for each vendor. The table after the steps lists the values to use.

1. **Create the External Credential.** Go to Setup → Quick Find → **Named Credentials** → **External Credentials** tab → **New**.
   - Label: `Anthropic`, Name: `Anthropic`
   - Authentication Protocol: **Custom**
   - Save.
2. **Add a principal that holds the key.** On the External Credential, go to the **Principals** section → **New**.
   - Parameter Name: `ClaudeKey` (any name works)
   - Sequence Number: `1`
   - Identity Type: **Named Principal**. Everyone shares one org-level key.
   - **Add Authentication Parameter** → Name: `apiKey`, Value: paste your key. Salesforce treats custom principal parameters as secrets and hides them on input.
   - Save.
3. **Add the auth header.** On the same External Credential, go to the **Custom Headers** section → **New**.
   - Name: `x-api-key`
   - Value: `{!$Credential.Anthropic.apiKey}`
   - Sequence Number: `1`
4. **Create the Named Credential.** Go to Setup → **Named Credentials** → **Named Credentials** tab → **New**.
   - Label/Name: `Anthropic_API`
   - URL: `https://api.anthropic.com`
   - External Credential: `Anthropic`
   - **Allow Formulas in HTTP Header**: checked
   - Generate Authorization Header: unchecked. The custom header handles auth.
5. **Give users access to the principal.** Go to Setup → **Permission Sets** → **New** (for example `LLM_Callout_Access`).
   - **External Credential Principal Access** → Edit → add `Anthropic - ClaudeKey`.
   - **Object Settings** → **User External Credentials**: give **View All** (View All Records). With Custom authentication and a named principal, the admin enters the key once and callout users use it through this access; principal access alone is not enough. See Salesforce Help: [Permission Concepts for User External Credentials](https://help.salesforce.com/s/articleView?id=sf.nc_user_external_credentials_permissions.htm&type=5).
   - Assign the permission set to every user whose transactions make the callout. That includes the user who enqueues async jobs and any integration user.

| Vendor | External Credential header name | Header value formula | Named Credential URL |
|---|---|---|---|
| Anthropic (Claude) | `x-api-key` | `{!$Credential.Anthropic.apiKey}` | `https://api.anthropic.com` |
| OpenAI | `Authorization` | `{!'Bearer ' & $Credential.OpenAI.apiKey}` | `https://api.openai.com` |
| Google (Gemini) | `x-goog-api-key` | `{!$Credential.Gemini.apiKey}` | `https://generativelanguage.googleapis.com` |

Name the Named Credentials `Anthropic_API`, `OpenAI_API` and `Gemini_API` so the code below works without edits. The `$Credential.<ExternalCredentialName>.<parameterName>` merge syntax follows Salesforce's Named Credentials docs. If your org's formula editor rejects the `&` concatenation, check the Named Credential Formula Functions reference for your release.

**Deployment note:** you can retrieve External Credentials and Named Credentials as metadata and keep them in source control, but the secret values never travel in metadata. Re-enter the key in each org (sandbox, UAT, production). That's by design. It also lets each environment use a separate key. Set spend and rate limits in each vendor's console; depending on the vendor these apply per organisation, project or workspace rather than per key.

## How are the Claude, OpenAI and Gemini APIs different?
{: #api-differences}

All three accept a JSON POST and return JSON, but the field names differ:

| | Anthropic Messages API | OpenAI Responses API | Gemini `generateContent` |
|---|---|---|---|
| Path | `/v1/messages` | `/v1/responses` | `/v1beta/models/{model}:generateContent` |
| Auth header | `x-api-key` | `Authorization: Bearer …` | `x-goog-api-key` |
| Extra required header | `anthropic-version: 2023-06-01` | none | none |
| Model | `model` in body | `model` in body | in the URL path |
| System prompt | `system` | `instructions` | `systemInstruction.parts[].text` |
| User prompt | `messages[{role, content}]` | `input` | `contents[{role, parts[{text}]}]` |
| Output limit | `max_tokens` (required) | `max_output_tokens` | `generationConfig.maxOutputTokens` |
| Where the text is | `content[]` items with `type: "text"` | `output[]` items with `type: "message"` → `content[]` with `type: "output_text"` | `candidates[0].content.parts[].text` |
| Why it stopped | `stop_reason` | `status` (+ `incomplete_details`) | `candidates[0].finishReason` |
| Token usage | `usage.input_tokens` / `output_tokens` | `usage.input_tokens` / `output_tokens` | `usageMetadata.promptTokenCount` / `candidatesTokenCount` |

One trap with OpenAI: the `output_text` shortcut you see in Python and JavaScript examples comes from the SDK. The raw REST response doesn't include it. In Apex you have to walk the `output` array yourself, as the code below does.

## How do I write one Apex class that calls all three LLMs?
{: #apex-client}

This class builds the request for each vendor, sends it through the Named Credential, turns HTTP errors into a typed exception and returns the same result shape for all three. Copy it as is.

```apex
public with sharing class LlmClient {

    public enum Provider { CLAUDE, OPENAI, GEMINI }

    public class LlmException extends Exception {
        public Integer statusCode;
    }

    public class LlmResult {
        @AuraEnabled public String text = '';
        @AuraEnabled public String stopReason;
        @AuraEnabled public Integer inputTokens;
        @AuraEnabled public Integer outputTokens;
    }

    // Salesforce maximum for a single callout (120 seconds).
    private static final Integer TIMEOUT_MS = 120000;

    /**
     * Sends one prompt to the chosen provider and returns plain text.
     * model: a model ID enabled on your vendor account, e.g. 'claude-sonnet-5-5'.
     */
    public static LlmResult complete(Provider p, String model, String systemPrompt,
                                     String userPrompt, Integer maxTokens) {
        if (p == null) {
            throw new LlmException('provider is required.');
        }
        if (maxTokens != null && maxTokens <= 0) {
            throw new LlmException('maxTokens must be positive.');
        }
        if (String.isBlank(model) || String.isBlank(userPrompt)) {
            throw new LlmException('model and userPrompt are required.');
        }
        if (Limits.getCallouts() >= Limits.getLimitCallouts()) {
            throw new LlmException('Callout limit reached in this transaction.');
        }

        HttpResponse res = new Http().send(buildRequest(p, model, systemPrompt, userPrompt, maxTokens));

        Integer status = res.getStatusCode();
        if (status < 200 || status > 299) {
            LlmException e = new LlmException(
                p.name() + ' returned HTTP ' + status + ': ' + String.valueOf(res.getBody()).left(1000));
            e.statusCode = status;
            throw e;
        }

        Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        switch on p {
            when CLAUDE { return parseClaude(body); }
            when OPENAI { return parseOpenAi(body); }
            when else   { return parseGemini(body); }
        }
    }

    @TestVisible
    private static HttpRequest buildRequest(Provider p, String model, String systemPrompt,
                                            String userPrompt, Integer maxTokens) {
        HttpRequest req = new HttpRequest();
        req.setMethod('POST');
        req.setTimeout(TIMEOUT_MS);
        req.setHeader('Content-Type', 'application/json');
        Integer limitTokens = maxTokens == null ? 1024 : maxTokens;
        Map<String, Object> payload = new Map<String, Object>();

        switch on p {
            when CLAUDE {
                req.setEndpoint('callout:Anthropic_API/v1/messages');
                req.setHeader('anthropic-version', '2023-06-01');
                payload.put('model', model);
                payload.put('max_tokens', limitTokens);
                if (String.isNotBlank(systemPrompt)) {
                    payload.put('system', systemPrompt);
                }
                payload.put('messages', new List<Object>{
                    new Map<String, Object>{ 'role' => 'user', 'content' => userPrompt }
                });
            }
            when OPENAI {
                req.setEndpoint('callout:OpenAI_API/v1/responses');
                payload.put('model', model);
                payload.put('max_output_tokens', limitTokens);
                if (String.isNotBlank(systemPrompt)) {
                    payload.put('instructions', systemPrompt);
                }
                payload.put('input', userPrompt);
            }
            when else {
                req.setEndpoint('callout:Gemini_API/v1beta/models/'
                    + EncodingUtil.urlEncode(model, 'UTF-8') + ':generateContent');
                if (String.isNotBlank(systemPrompt)) {
                    payload.put('systemInstruction', new Map<String, Object>{
                        'parts' => new List<Object>{ new Map<String, Object>{ 'text' => systemPrompt } }
                    });
                }
                payload.put('contents', new List<Object>{
                    new Map<String, Object>{
                        'role' => 'user',
                        'parts' => new List<Object>{ new Map<String, Object>{ 'text' => userPrompt } }
                    }
                });
                payload.put('generationConfig', new Map<String, Object>{ 'maxOutputTokens' => limitTokens });
            }
        }
        req.setBody(JSON.serialize(payload));
        return req;
    }

    private static LlmResult parseClaude(Map<String, Object> body) {
        LlmResult r = new LlmResult();
        for (Object o : (List<Object>) body.get('content')) {
            Map<String, Object> block = (Map<String, Object>) o;
            if ('text'.equals(block.get('type'))) {
                r.text += (String) block.get('text');
            }
        }
        r.stopReason = (String) body.get('stop_reason');
        Map<String, Object> usage = (Map<String, Object>) body.get('usage');
        if (usage != null) {
            r.inputTokens = (Integer) usage.get('input_tokens');
            r.outputTokens = (Integer) usage.get('output_tokens');
        }
        return r;
    }

    private static LlmResult parseOpenAi(Map<String, Object> body) {
        LlmResult r = new LlmResult();
        List<Object> output = (List<Object>) body.get('output');
        if (output != null) {
            for (Object o : output) {
                Map<String, Object> item = (Map<String, Object>) o;
                if (!'message'.equals(item.get('type'))) {
                    continue; // skip reasoning and tool items
                }
                for (Object c : (List<Object>) item.get('content')) {
                    Map<String, Object> part = (Map<String, Object>) c;
                    if ('output_text'.equals(part.get('type'))) {
                        r.text += (String) part.get('text');
                    }
                }
            }
        }
        r.stopReason = (String) body.get('status');
        Map<String, Object> usage = (Map<String, Object>) body.get('usage');
        if (usage != null) {
            r.inputTokens = (Integer) usage.get('input_tokens');
            r.outputTokens = (Integer) usage.get('output_tokens');
        }
        return r;
    }

    private static LlmResult parseGemini(Map<String, Object> body) {
        List<Object> candidates = (List<Object>) body.get('candidates');
        if (candidates == null || candidates.isEmpty()) {
            throw new LlmException('Gemini returned no candidates: '
                + JSON.serialize(body.get('promptFeedback')));
        }
        LlmResult r = new LlmResult();
        Map<String, Object> cand = (Map<String, Object>) candidates[0];
        r.stopReason = (String) cand.get('finishReason');
        Map<String, Object> content = (Map<String, Object>) cand.get('content');
        if (content != null && content.get('parts') != null) {
            for (Object o : (List<Object>) content.get('parts')) {
                Map<String, Object> part = (Map<String, Object>) o;
                if (part.get('text') != null) {
                    r.text += (String) part.get('text');
                }
            }
        }
        Map<String, Object> usage = (Map<String, Object>) body.get('usageMetadata');
        if (usage != null) {
            r.inputTokens = (Integer) usage.get('promptTokenCount');
            r.outputTokens = (Integer) usage.get('candidatesTokenCount');
        }
        return r;
    }
}
```

Try it in Execute Anonymous (Developer Console → Debug → Open Execute Anonymous Window) as a user who has the permission set:

```apex
LlmClient.LlmResult r = LlmClient.complete(
    LlmClient.Provider.CLAUDE,
    'claude-sonnet-5-5',            // example ID: confirm on Anthropic's models page
    'Answer in one sentence.',
    'What is a Salesforce governor limit?',
    200
);
System.debug(r.text + ' | stop=' + r.stopReason + ' | tokens=' + r.inputTokens + '/' + r.outputTokens);
```

To switch vendors, change the provider enum and the model ID, and set up that vendor's credential (for example `LlmClient.Provider.GEMINI` with a current stable Gemini model). In production, keep model IDs in Custom Metadata, not hard-coded, so an admin can move to a new model without a deployment.

**Check the stop reason every time.** Only treat the output as complete when Claude returns `end_turn`, OpenAI returns `completed`, or Gemini returns `STOP`, and the text is not blank. Anything else (`max_tokens`, `refusal`, `incomplete`, `MAX_TOKENS`, `SAFETY`) means the text was cut off, refused or blocked. Don't write it to a record as if it were complete.

## How do I run the LLM call asynchronously from a record?
{: #async-queueable}

LLM calls are slow, and Salesforce doesn't allow callouts from triggers or after uncommitted DML. For bulk work, the safest design is a **durable queue**: the trigger (or a record-triggered flow) only ticks a checkbox, and a scheduled job runs **one Batch Apex job with a scope of 1** over the ticked records. Every record then gets its own transaction and its own 120-second callout budget, trigger chunking and Queueable limits can't break the insert, and only one job runs at a time.

Create three fields on Case first: a Long Text Area `AI_Summary__c`, a Checkbox `AI_Summary_Requested__c` and a Number `AI_Summary_Attempts__c` (default 0).

**1. Mark the records (no callout, no async job in the trigger):**

```apex
// CaseTrigger.trigger
// Flag new Cases, and Cases whose Subject or Description changed; reset the attempt counter.
trigger CaseTrigger on Case (before insert, before update) {
    for (Case c : Trigger.new) {
        Case old = Trigger.isUpdate ? Trigger.oldMap.get(c.Id) : null;
        if (String.isNotBlank(c.Description) && (old == null || CaseSummaryBatch.textChanged(old, c))) {
            c.AI_Summary_Requested__c = true;
            c.AI_Summary_Attempts__c = 0;
        }
    }
}
```

**2. The batch: one Case, one callout, one transaction:**

```apex
public with sharing class CaseSummaryBatch implements Database.Batchable<SObject>, Database.AllowsCallouts {

    public Database.QueryLocator start(Database.BatchableContext ctx) {
        return Database.getQueryLocator(
            [SELECT Id, Subject, Description, AI_Summary_Attempts__c FROM Case
             WHERE AI_Summary_Requested__c = true
             WITH USER_MODE
             LIMIT 2000]
        );
    }

    private static final Integer MAX_ATTEMPTS = 3;

    // Apex == and != ignore letter case for strings, so compare with equals() (case-sensitive, null-safe).
    public static Boolean textChanged(Case a, Case b) {
        return !String.valueOf(a.Subject).equals(String.valueOf(b.Subject))
            || !String.valueOf(a.Description).equals(String.valueOf(b.Description));
    }

    public void execute(Database.BatchableContext ctx, List<Case> scope) {
        Integer maxLen = Case.AI_Summary__c.getDescribe().getLength();
        List<Case> updates = new List<Case>();

        for (Case row : scope) {
            // Re-read in user mode right before the callout: skip Cases that were deleted,
            // are no longer visible to this user, or are no longer requested.
            List<Case> current = [SELECT Id, Subject, Description, AI_Summary_Attempts__c,
                                         AI_Summary_Requested__c
                                  FROM Case WHERE Id = :row.Id WITH USER_MODE];
            if (current.isEmpty() || !current[0].AI_Summary_Requested__c) {
                continue;
            }
            Case c = current[0];

            LlmClient.LlmResult r = null;
            try {
                r = LlmClient.complete(
                    LlmClient.Provider.CLAUDE,
                    'claude-sonnet-5-5', // example ID: confirm on Anthropic's models page
                    'Summarise this support case in at most 3 bullet points. Use only facts in the text. '
                        + 'If information is missing, say so.',
                    'Subject: ' + c.Subject + '\nDescription: ' + c.Description,
                    400
                );
            } catch (LlmClient.LlmException e) {
                System.debug(LoggingLevel.WARN, 'LLM error for ' + c.Id + ': ' + e.getMessage());
            } catch (System.CalloutException e) {
                System.debug(LoggingLevel.WARN, 'Callout failed for ' + c.Id + ': ' + e.getMessage());
            }

            // Success or failure: re-read and lock the row. If someone edited the text or
            // unticked the request while the model was answering, leave the record alone.
            List<Case> locked = [SELECT Subject, Description, AI_Summary_Requested__c FROM Case
                                 WHERE Id = :c.Id WITH USER_MODE FOR UPDATE];
            if (locked.isEmpty() || !locked[0].AI_Summary_Requested__c || textChanged(c, locked[0])) {
                continue;
            }

            if (r != null && r.stopReason == 'end_turn' && String.isNotBlank(r.text)) {
                // Save the summary and clear the request in the same update.
                updates.add(new Case(Id = c.Id,
                    AI_Summary__c = r.text.left(maxLen),
                    AI_Summary_Requested__c = false));
            } else {
                // Error, timeout, truncated or refused output: count the attempt and
                // stop retrying after MAX_ATTEMPTS so failures can't crowd out new work.
                Integer attempts = (c.AI_Summary_Attempts__c == null ? 0 : c.AI_Summary_Attempts__c.intValue()) + 1;
                updates.add(new Case(Id = c.Id,
                    AI_Summary_Attempts__c = attempts,
                    AI_Summary_Requested__c = attempts < MAX_ATTEMPTS));
            }
        }

        if (!updates.isEmpty()) {
            update as user updates;
        }
    }

    public void finish(Database.BatchableContext ctx) {}
}
```

**3. The dispatcher: start at most one batch at a time:**

```apex
public with sharing class CaseSummaryDispatcher implements Schedulable {
    public void execute(SchedulableContext ctx) {
        Integer running = [SELECT COUNT() FROM AsyncApexJob
                           WHERE ApexClass.Name = 'CaseSummaryBatch'
                           AND Status IN ('Holding', 'Queued', 'Preparing', 'Processing')];
        if (running == 0) {
            Database.executeBatch(new CaseSummaryBatch(), 1); // scope 1 = one callout per transaction
        }
    }
}

// Run once in Execute Anonymous to schedule it every hour:
// System.schedule('Case AI summaries', '0 0 * * * ?', new CaseSummaryDispatcher());
```

How this behaves:

- **Permissions:** each Case is re-read `WITH USER_MODE` right before the callout and again (locked) before saving, and the update runs `as user`, so the job skips Cases the running user can no longer see and only changes what that user can edit. If the user loses field access completely, the user-mode query throws and that run fails loudly in **Apex Jobs** instead of sending data. A call already sent to the vendor can't be recalled. Schedule the job as a user who can read the Cases, read `Subject` and `Description`, and edit `AI_Summary__c`, `AI_Summary_Requested__c` and `AI_Summary_Attempts__c`. Give that user the External Credential principal access and User External Credentials access from the setup section too.
- **Failures:** only `LlmClient.LlmException` and `System.CalloutException` are caught, so real bugs (bad casts, null pointers) still fail loudly. A caught failure is retried on the next runs, up to 3 attempts; then its checkbox is cleared and `AI_Summary_Attempts__c` = 3 marks it for review. The limit counts only failures the job could record: if the whole transaction fails (an uncaught exception, or the final update itself failing), nothing is saved and the record is tried again, so check **Apex Jobs** in Setup for failed batches. Editing the Subject or Description (case-sensitive) queues it again with a fresh counter. Unticking the checkbox stops retries, and a run that finishes after you untick it or edit the text leaves the record alone.
- **Duplicate charges:** a record is cleared only after its summary is saved, and only one batch runs at a time. That keeps repeat calls rare, but it can't rule them out: if the vendor call succeeds and the Salesforce update then fails, the next run calls the model again. Set a spend limit at the vendor and watch the debug logs. The same retry problem is covered in [why integration retries create duplicates](/blog/salesforce-integration-retries-idempotency/).
- **Volume:** `LIMIT 2000` keeps each run bounded; anything left over is handled by the next scheduled run.

If you're unsure whether the entry point should be a flow or a trigger, see [Flow or Apex? A decision guide](/blog/salesforce-flow-vs-apex-decision-guide/).

## How do I test LLM callouts in Apex?
{: #test-class}

Apex tests can't make real callouts. A single configurable `HttpCalloutMock` covers all three vendors and the error path. The tests also check that the API key is never set in Apex.

```apex
@IsTest
private class LlmClientTest {

    private class MockLlm implements HttpCalloutMock {
        private Integer status;
        private String body;
        public HttpRequest lastRequest;

        MockLlm(Integer status, String body) {
            this.status = status;
            this.body = body;
        }

        public HttpResponse respond(HttpRequest req) {
            lastRequest = req;
            HttpResponse res = new HttpResponse();
            res.setStatusCode(status);
            res.setHeader('Content-Type', 'application/json');
            res.setBody(body);
            return res;
        }
    }

    @IsTest
    static void claudeReturnsText() {
        MockLlm mock = new MockLlm(200,
            '{"content":[{"type":"text","text":"Hello from Claude"}],'
            + '"stop_reason":"end_turn","usage":{"input_tokens":12,"output_tokens":5}}');
        Test.setMock(HttpCalloutMock.class, mock);

        Test.startTest();
        LlmClient.LlmResult r = LlmClient.complete(
            LlmClient.Provider.CLAUDE, 'claude-sonnet-5-5', 'Be brief.', 'Hi', 100);
        Test.stopTest();

        Assert.areEqual('Hello from Claude', r.text);
        Assert.areEqual('end_turn', r.stopReason);
        Assert.areEqual(12, r.inputTokens);
        Assert.areEqual(5, r.outputTokens);
        Assert.areEqual('callout:Anthropic_API/v1/messages', mock.lastRequest.getEndpoint());
        Assert.areEqual('2023-06-01', mock.lastRequest.getHeader('anthropic-version'));
        Assert.isNull(mock.lastRequest.getHeader('x-api-key'), 'Key must come from the External Credential');
        Assert.isTrue(mock.lastRequest.getBody().contains('"max_tokens":100'));
    }

    @IsTest
    static void openAiSkipsReasoningItems() {
        MockLlm mock = new MockLlm(200,
            '{"status":"completed","output":['
            + '{"type":"reasoning","summary":[]},'
            + '{"type":"message","role":"assistant","content":'
            + '[{"type":"output_text","text":"Hello from OpenAI","annotations":[]}]}],'
            + '"usage":{"input_tokens":10,"output_tokens":4}}');
        Test.setMock(HttpCalloutMock.class, mock);

        Test.startTest();
        LlmClient.LlmResult r = LlmClient.complete(
            LlmClient.Provider.OPENAI, 'example-openai-model', null, 'Hi', 100);
        Test.stopTest();

        Assert.areEqual('Hello from OpenAI', r.text);
        Assert.areEqual('completed', r.stopReason);
        Assert.areEqual('callout:OpenAI_API/v1/responses', mock.lastRequest.getEndpoint());
        Assert.isNull(mock.lastRequest.getHeader('Authorization'));
        Assert.isFalse(mock.lastRequest.getBody().contains('instructions'), 'Blank system prompt omitted');
    }

    @IsTest
    static void geminiReturnsText() {
        MockLlm mock = new MockLlm(200,
            '{"candidates":[{"content":{"role":"model","parts":[{"text":"Hello from Gemini"}]},'
            + '"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":8,"candidatesTokenCount":4}}');
        Test.setMock(HttpCalloutMock.class, mock);

        Test.startTest();
        LlmClient.LlmResult r = LlmClient.complete(
            LlmClient.Provider.GEMINI, 'example-gemini-model', 'Be brief.', 'Hi', 100);
        Test.stopTest();

        Assert.areEqual('Hello from Gemini', r.text);
        Assert.areEqual('STOP', r.stopReason);
        Assert.areEqual(8, r.inputTokens);
        Assert.areEqual(
            'callout:Gemini_API/v1beta/models/example-gemini-model:generateContent',
            mock.lastRequest.getEndpoint());
    }

    @IsTest
    static void httpErrorThrowsTypedException() {
        Test.setMock(HttpCalloutMock.class, new MockLlm(429,
            '{"type":"error","error":{"type":"rate_limit_error","message":"Rate limited"}}'));

        Test.startTest();
        try {
            LlmClient.complete(LlmClient.Provider.CLAUDE, 'claude-sonnet-5-5', null, 'Hi', 50);
            Assert.fail('Expected LlmException');
        } catch (LlmClient.LlmException e) {
            Assert.areEqual(429, e.statusCode);
            Assert.isTrue(e.getMessage().contains('rate_limit_error'));
        }
        Test.stopTest();
    }

    @IsTest
    static void geminiWithNoCandidatesThrows() {
        Test.setMock(HttpCalloutMock.class, new MockLlm(200,
            '{"promptFeedback":{"blockReason":"SAFETY"}}'));

        Test.startTest();
        try {
            LlmClient.complete(LlmClient.Provider.GEMINI, 'example-gemini-model', null, 'Hi', 50);
            Assert.fail('Expected LlmException');
        } catch (LlmClient.LlmException e) {
            Assert.isTrue(e.getMessage().contains('SAFETY'));
        }
        Test.stopTest();
    }
}
```

Test the batch the same way. Put this in `CaseSummaryBatchTest.cls` (it reuses the mock pattern above, with a status code you choose):

```apex
@IsTest
private class CaseSummaryBatchTest {

    private class Mock implements HttpCalloutMock {
        private final Integer status;
        Mock(Integer status) { this.status = status; }
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(status);
            res.setHeader('Content-Type', 'application/json');
            res.setBody(status == 200
                ? '{"content":[{"type":"text","text":"- Customer cannot log in"}],"stop_reason":"end_turn"}'
                : '{"type":"error","error":{"type":"api_error","message":"boom"}}');
            return res;
        }
    }

    private static Case newCase(Integer attempts) {
        Case c = new Case(Subject = 'Login', Description = 'Customer cannot log in');
        insert c; // the trigger ticks AI_Summary_Requested__c
        if (attempts > 0) {
            update new Case(Id = c.Id, AI_Summary_Attempts__c = attempts);
        }
        return c;
    }

    @IsTest
    static void savesSummaryAndClearsRequest() {
        Case c = newCase(0);
        Test.setMock(HttpCalloutMock.class, new Mock(200));
        Test.startTest();
        Database.executeBatch(new CaseSummaryBatch(), 1);
        Test.stopTest();
        c = [SELECT AI_Summary__c, AI_Summary_Requested__c FROM Case WHERE Id = :c.Id];
        Assert.isTrue(c.AI_Summary__c.contains('cannot log in'));
        Assert.isFalse(c.AI_Summary_Requested__c);
    }

    @IsTest
    static void countsFailedAttempt() {
        Case c = newCase(0);
        Test.setMock(HttpCalloutMock.class, new Mock(500));
        Test.startTest();
        Database.executeBatch(new CaseSummaryBatch(), 1);
        Test.stopTest();
        c = [SELECT AI_Summary_Attempts__c, AI_Summary_Requested__c FROM Case WHERE Id = :c.Id];
        Assert.areEqual(1, c.AI_Summary_Attempts__c);
        Assert.isTrue(c.AI_Summary_Requested__c);
    }

    @IsTest
    static void dispatcherStartsTheBatch() {
        Case c = newCase(0);
        Test.setMock(HttpCalloutMock.class, new Mock(200));
        Test.startTest();
        new CaseSummaryDispatcher().execute(null);
        Test.stopTest();
        Assert.areEqual(1, [SELECT COUNT() FROM AsyncApexJob
                            WHERE ApexClass.Name = 'CaseSummaryBatch' AND JobType = 'BatchApex']);
        c = [SELECT AI_Summary_Requested__c FROM Case WHERE Id = :c.Id];
        Assert.isFalse(c.AI_Summary_Requested__c);
    }

    @IsTest
    static void stopsAfterThirdFailure() {
        Case c = newCase(2);
        Test.setMock(HttpCalloutMock.class, new Mock(500));
        Test.startTest();
        Database.executeBatch(new CaseSummaryBatch(), 1);
        Test.stopTest();
        c = [SELECT AI_Summary_Attempts__c, AI_Summary_Requested__c FROM Case WHERE Id = :c.Id];
        Assert.areEqual(3, c.AI_Summary_Attempts__c);
        Assert.isFalse(c.AI_Summary_Requested__c);
    }
}
```

The success mock returns the Claude response shape because the batch uses `Provider.CLAUDE`. If your `LlmClient` throws for HTTP 500 differently, adjust the status, not the assertions.

## Common errors and fixes
{: #common-errors}

Each heading below is the error people paste into Google. Find yours, then apply the fix.

### Unauthorized endpoint

```text
System.CalloutException: Unauthorized endpoint, please check Setup->Security->Remote site settings. endpoint = https://api.openai.com/v1/responses
```

**Cause:** the code calls a raw URL instead of the Named Credential.

**Fix:** use `callout:OpenAI_API/v1/responses`. Don't add a Remote Site Setting just to make a key-in-code approach work.

### We couldn't access the credential(s)

```text
We couldn't access the credential(s). You might not have the required permissions, or the external credential "Anthropic" might not exist.
```

**Cause:** the running user is missing **External Credential Principal Access** or **View All** on **User External Credentials**.

**Fix:** assign the permission set to the user the code actually runs as. Scheduled jobs, platform event triggers and integration users often differ from the person who tested in Execute Anonymous.

### You have uncommitted work pending

```text
System.CalloutException: You have uncommitted work pending. Please commit or rollback before calling out
```

**Cause:** DML ran before the callout in the same transaction.

**Fix:** make the callout first, or move it into the batch job shown above.

### Callout from triggers are currently not supported

```text
Callout from triggers are currently not supported.
```

**Cause:** triggers can't make synchronous callouts.

**Fix:** have the trigger flag the record, then make the callout from Batch Apex or a Queueable that implements `Database.AllowsCallouts` (see the batch example above).

### Methods defined as TestMethod do not support Web service callouts

```text
Methods defined as TestMethod do not support Web service callouts
```

**Cause:** a test reached `Http.send()` without a mock.

**Fix:** call `Test.setMock(HttpCalloutMock.class, ...)` before the code under test runs.

### Read timed out

```text
System.CalloutException: Read timed out
```

**Cause:** the model took longer than the callout timeout.

**Fix:** set `setTimeout(120000)`, lower max tokens, choose a faster model, or split the task. 120 seconds is the hard ceiling.

### HTTP 401 from the vendor

```text
Anthropic: authentication_error
OpenAI: Incorrect API key provided
Gemini: API key not valid. Please pass a valid API key.
```

**Cause:** the header formula or key is wrong.

**Fix:** check that the header name matches the table above, that **Allow Formulas in HTTP Header** is checked, and that the External Credential and parameter names in the formula match exactly. Names are case-sensitive.

### HTTP 429 or 529 overloaded_error

**Cause:** a rate limit, or the vendor is overloaded.

**Fix:** for a transient rate limit or overload, retry a limited number of times (for example 3) from a Queueable with a growing delay (`System.enqueueJob(job, delayInMinutes)`), and follow any `retry-after` header the vendor sends. If the error says you hit a spending or quota limit, don't retry: alert an admin. Never loop in the same transaction.

### HTTP 404 with a model error

**Cause:** the model ID is retired or your account can't use it.

**Fix:** update the ID from the vendor's models or deprecations page.

## What does it cost, and which limits apply?
{: #cost-limits}

**Vendor cost.** All three vendors price by tokens, with separate input and output rates that differ by model; Gemini also has a free tier for some models, and thinking tokens and prompt caching can change the bill. Prices change often, so check the official pricing pages linked below rather than any figure quoted in a blog. Every response includes token usage, which `LlmResult` captures. Log `inputTokens` and `outputTokens` to a custom object so you can estimate spend per feature. Set spend limits in each vendor's console as well (per organisation, project or workspace, depending on the vendor).

**Salesforce limits that matter for LLM calls:**

- 100 callouts per Apex transaction.
- Default callout timeout of 10 seconds, maximum 120,000 ms per callout, and 120 seconds of total callout time per transaction.
- Heap size: 6 MB synchronous, 12 MB asynchronous. Long prompts that include record history count against it. Trim inputs before you send them.
- No callouts after uncommitted DML in the same transaction.

Check the current numbers on Salesforce's "Execution Governors and Limits" page for your release.

**Data.** A direct callout sends record text to a third party. Send only the fields the task needs, leave out personal identifiers unless they're approved, and use `WITH USER_MODE` queries so a user can't pull in data they can't already see. Treat the output as a draft for a human to review, not as a final decision. The same principle applies in our [lead qualification guardrails post](/blog/salesforce-ai-lead-qualification-guardrails/).

Need this built in your org? [SFX can build it](/services/) with a written scope and fixed quote.

## Solution kit: files and deploy commands
{: #solution-kit}

These commands build the whole project from scratch with the Salesforce CLI. Create the External Credentials, Named Credentials (`Anthropic_API`, `OpenAI_API`, `Gemini_API`) and the permission set in Setup first, as described above, because the API keys must be entered there, not deployed.

**1. Create the three Case fields** in **Setup → Object Manager → Case → Fields & Relationships**: `AI_Summary__c` (Long Text Area), `AI_Summary_Requested__c` (Checkbox, default unchecked) and `AI_Summary_Attempts__c` (Number, 3 digits, 0 decimals, default 0). Give the permission set read and edit access to all three.

**2. Generate the project and empty classes** (the CLI writes `sfdx-project.json` and every `-meta.xml` file for you):

```bash
sf project generate --name llm-apex && cd llm-apex
for c in LlmClient LlmClientTest CaseSummaryBatch CaseSummaryBatchTest CaseSummaryDispatcher; do
  sf apex generate class --name "$c" --output-dir force-app/main/default/classes
done
sf apex generate trigger --name CaseTrigger --sobject Case --event "before insert,before update" \
  --output-dir force-app/main/default/triggers
```

**3. Paste the code** from this guide into the matching `.cls` and `.trigger` files, replacing the generated stubs. Put the `MockLlm`-based tests in `LlmClientTest.cls` and the batch and dispatcher tests in `CaseSummaryBatchTest.cls`.

> **Testing status:** this code was reviewed line by line against the official Apex, Named Credential and vendor API docs, but it has not yet been run in a Salesforce org by SFX. Run the tests in a sandbox before production, and tell us if anything fails so we can fix the guide.

**4. Deploy to a sandbox and run the tests:**

```bash
sf org login web --alias my-sandbox --instance-url https://test.salesforce.com
sf project deploy start --source-dir force-app --target-org my-sandbox
sf apex run test --class-names LlmClientTest --class-names CaseSummaryBatchTest \
  --target-org my-sandbox --result-format human --wait 10
```

**5. Schedule the dispatcher** once from Execute Anonymous (step 3 of the bulk section) and watch the first runs in **Setup → Apex Jobs**.

## Official sources
{: #official-sources}

- Salesforce: [Get Started with Named Credentials](https://developer.salesforce.com/docs/platform/named-credentials/guide/get-started.html)
- Salesforce: [Named Credential Formula Functions](https://developer.salesforce.com/docs/platform/named-credentials/references/named-credentials-reference/nc-formula-functions.html)
- Salesforce: [Custom Headers and Bodies of Apex Callouts That Use Named Credentials](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_callouts_named_credentials_custom_headers_bodies.htm)
- Salesforce: [Callout Limits and Limitations](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_callouts_timeouts.htm)
- Salesforce: [Execution Governors and Limits](https://developer.salesforce.com/docs/atlas.en-us.salesforce_app_limits_cheatsheet.meta/salesforce_app_limits_cheatsheet/salesforce_app_limits_platform_apexgov.htm)
- Salesforce: [Access Models API with Apex](https://developer.salesforce.com/docs/ai/agentforce/guide/access-models-api-with-apex.html) and [Models API Apex Classes](https://developer.salesforce.com/docs/ai/agentforce/references/models-apex-api/models-apex-reference.html)
- Anthropic: [Claude API overview](https://platform.claude.com/docs/en/api/overview), [Messages API](https://docs.anthropic.com/en/api/messages), [Models overview](https://docs.anthropic.com/en/docs/about-claude/models/overview), [Pricing](https://www.anthropic.com/pricing)
- OpenAI: [Create a model response (Responses API)](https://developers.openai.com/api/docs/api-reference/responses/create), [Deprecations](https://developers.openai.com/api/docs/deprecations), [Changelog](https://developers.openai.com/api/docs/changelog), [Pricing](https://openai.com/api/pricing/)
- Google: [Gemini API reference](https://ai.google.dev/api), [Gemini models](https://ai.google.dev/gemini-api/docs/models), [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
