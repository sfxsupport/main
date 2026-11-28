---
layout: blog-post
sfx_blog: true
featured: false
title: "List Index Out of Bounds: 0 in Apex: Cause and Fix"
seo_title: "Fix List Index Out of Bounds: 0 in Salesforce Apex"
description: "Fix List index out of bounds: 0 in an Agentforce Apex action by checking query results and returning a useful outcome for each request."
date: 2026-11-28 16:40:00 +0530
last_modified_at: 2026-11-28 16:40:00 +0530
permalink: /blog/list-index-out-of-bounds-salesforce/
primary_category: "Salesforce Troubleshooting"
series: "Apex runtime errors"
categories:
  - salesforce-ai
tags:
  - "List index out of bounds: 0"
  - Apex
  - Salesforce troubleshooting
  - SOQL
  - Apex testing
  - Salesforce debugging
  - Agentforce
reading_time: "10 min read"
og_type: article
author_name: "Abhay Nama"
author_url: "https://www.linkedin.com/in/abhay-nama-0739793a7/"
image: /assets/images/blog/list-index-out-of-bounds-salesforce.jpg
image_alt: "SFX Salesforce Troubleshooting banner showing the error: System.ListException: List index out of bounds: 0"
proficiency: "Intermediate"
answer: "System.ListException: List index out of bounds: 0 means Apex tried to read the first element of an empty list. In an Agentforce action, find the failing list in the Apex stack trace, check why it is empty, and return a defined no-result response before accessing index 0."
faq:
  - q: "Why does List index out of bounds: 0 occur in an Apex test?"
    a: "The test may not create a record that matches the query, or the record may lack a required relationship or field value. Create matching test data and assert the no-match outcome separately."
  - q: "Can an Agentforce Apex action handle several requests at once?"
    a: "Yes. An invocable method receives a list of requests. If it returns results, it must return the same number of results as inputs, including when reporting errors."
  - q: "Does LIMIT 1 prevent List index out of bounds: 0?"
    a: "No. LIMIT 1 allows a query to return zero or one row, so the result can still be empty."
  - q: "Is an empty query result the same as a null list?"
    a: "No. A SOQL query assigned to a list returns an empty list when no rows match. A null reference is a separate condition and can cause a NullPointerException."
  - q: "How can I identify which list caused the exception?"
    a: "Start with the class and line number in the Apex stack trace. Inspect the collection at that expression and trace where it was populated or changed."
extra_css:
  - /assets/css/blog.css
toc:
  - id: meaning
    label: "Meaning"
  - id: causes
    label: "Common causes"
  - id: fix
    label: "Step-by-step fix"
  - id: code
    label: "Apex code and tests"
  - id: reproduce
    label: "Reproduce safely"
  - id: prevent
    label: "Prevent the error"
  - id: related-errors
    label: "Related errors"
  - id: official-sources
    label: "Official sources"
  - id: solution-kit
    label: "Solution kit"
---

```text
System.ListException: List index out of bounds: 0
```

An Agentforce action backed by Apex can surface **List index out of bounds: 0** when its code reads the first item of an empty list. For example, an account lookup may find no record visible to the action’s running user and then try to read `accounts[0]`. Start with the Apex stack trace: the action displaying the message may not be where the faulty list was created.

## What does List index out of bounds: 0 mean?
{: #meaning}

Apex tried to access the first element of a list that contains no elements. Indexes start at zero, so an empty list has no valid index.

For a list with `n` elements, valid indexes run from `0` through `n - 1`. The number in the exception is the index Apex attempted to access; it does not identify which list is responsible.

A SOQL query assigned to a list can return zero rows. According to [Salesforce Help](https://help.salesforce.com/s/articleView?id=000385743&language=en_US&type=1), a query returning no records is the most common cause of this error.

**Quick fix:** locate the list at the failing line, determine why it is empty, and handle that case before indexing. Decide what the action should return when no record is found. `LIMIT 1` sets a maximum; it does not guarantee a result.

## Why do I get List index out of bounds: 0?
{: #causes}

The immediate cause is an attempt to read index `0` from an empty list. In an Agentforce action, the list might come from a query, a filtered collection, or another method.

| Cause | How to confirm | Fix |
| --- | --- | --- |
| SOQL returns no rows | Check the query, bind values, filters, and row count in the failing transaction. | Correct the data or query if needed, then handle zero rows. |
| Test data is missing or does not match | Compare the test fixture with each query condition and required relationship. | Create matching records and test the no-match case separately. |
| The running user sees different records | Trace the action in the affected user and access context. | Correct intended access, or handle an absence of visible records. |
| Code filters, clears, or never populates the list | Check its size immediately before the failing line and trace its changes. | Correct the control flow and handle an empty list where it is valid. |
| A child or derived collection is empty | Identify the specific child list, parsed collection, or method return being indexed. | Validate that collection and fix missing source data or input. |

## How do I fix List index out of bounds: 0?
{: #fix}

Use the stack trace to identify the exact list, then check the data and access context that produced it. Decide what the action should return for each request when its record is missing.

### 1. Find the failing access

Open the action error details or test failure and note the first relevant Apex class and line number. Follow the exception back to the Apex method invoked by the action.

For a reproducible action, capture a log:

1. In **Setup**, enter **Debug Logs** in Quick Find and open **Debug Logs**.
2. Create a debug level with **Apex Code** set to **Finest**. Set **Workflow** to **Finer** when investigating a Flow.
3. Create a trace flag for the user performing the action, with an active start and expiration time and that debug level.
4. Reproduce the action, return to **Setup → Debug Logs**, and open the resulting log.

Search for the exception and stack trace. For a query, inspect the corresponding `SOQL_EXECUTE_END` event for its row count. Salesforce describes these steps and events in its [debug logging guide](https://help.salesforce.com/s/articleView?id=000392579&language=en_US&type=1). Use a narrow trace window and avoid logging sensitive values unnecessarily.

At the failing line, distinguish the collection from nearby objects. If you can change the code in a development environment, inspect the relevant list’s size immediately before the access. An earlier size check may no longer apply after a method filters or clears the list.

### 2. Fix a query that returns no rows

Compare each filter and bind value with the actual records. Check IDs, status values, relationships, and whether the record exists at the time the query runs.

If zero matches are expected, return a defined no-result outcome. If a match is required, return a useful error through the action’s result. Do not create a placeholder record or remove a filter merely to suppress the exception.

When selecting one of several possible records, use an explicit `ORDER BY` that matches the business rule. Without it, “first” does not define which matching record your application needs.

### 3. Fix a failing test or deployment

Open the failure’s class and line, then inspect the query at that line. Create the records the test needs, including fields and relationships used by the query.

Prefer isolated test data over relying on existing org records or adding `SeeAllData=true` as a shortcut. Assert both matching and missing outcomes, including a batch containing more than one request. If a deployment fails because an existing test throws this error, repair the fixture or production logic according to the intended behavior, then rerun the relevant tests.

### 4. Check record visibility and execution mode

If the same inputs work for one user but not another, reproduce the operation as the affected user and inspect the query’s execution context. Review the class sharing declaration, query access mode, applicable sharing and restriction rules, and the user’s intended access.

Salesforce states that database operations default to user mode in Apex API version 67.0 and later; in version 66.0 and earlier, the default is system mode. Explicit access modes and sharing declarations also matter. Object or field permission problems can raise an access error instead of returning an empty list. See [Salesforce’s access-mode documentation](https://developer.salesforce.com/docs/platform/apex-dev/references/apex-dev/apex-classes-enforce-usermode.html).

Grant access only when the user is supposed to have it. For a deeper investigation, use the [record visibility troubleshooting map](/blog/why-salesforce-user-can-see-record/).

### 5. Trace lists built in memory

If the list is not the direct result of SOQL, trace its source and changes. Check branches that populate it, filters that remove items, calls to `clear()`, and methods that return collections. For child query results or parsed input, inspect the specific collection at the failing expression.

If the stack trace points into a managed package and you cannot inspect the code, collect the operation, inputs, user context, timestamp, and log. Check the product’s documentation and contact its support team.

## What Apex code fixes List index out of bounds: 0?
{: #code}

The unsafe pattern indexes a query result without checking it. The fixed example is an invocable Apex action for Agentforce: it queries requested accounts in one operation and returns a result for each input, including a no-match outcome.

### Bad pattern

This fragment illustrates the failing access inside an action; do not deploy it as the fix.

```apex
List<Account> accounts = [
    SELECT Id, Name
    FROM Account
    WHERE Id = :accountId
    WITH USER_MODE
    LIMIT 1
];

// Throws ListException if the query returns no rows.
Account firstAccount = accounts[0];
```

### Fixed class

Save this as `AccountLookup.cls`. Each request supplies an account ID. The action returns the account name when found, or a status that lets the agent handle a missing or unavailable record.

```apex
public with sharing class AccountLookup {
    public class Request {
        @InvocableVariable(
            label='Account ID'
            description='ID of the account to look up.'
            required=true
        )
        public Id accountId;
    }

    public class Result {
        @InvocableVariable(
            label='Account found'
            description='Whether a matching account was found.'
        )
        public Boolean found;

        @InvocableVariable(
            label='Account name'
            description='Name of the matching account, when found.'
        )
        public String accountName;

        @InvocableVariable(
            label='Status'
            description='Outcome of the account lookup.'
        )
        public String status;
    }

    @InvocableMethod(
        label='Look Up Account'
        description='Find an account by ID and report when it is unavailable.'
    )
    public static List<Result> findAccounts(List<Request> requests) {
        if (requests == null || requests.isEmpty()) {
            return new List<Result>();
        }

        Set<Id> accountIds = new Set<Id>();

        for (Request request : requests) {
            if (request != null && request.accountId != null) {
                accountIds.add(request.accountId);
            }
        }

        Map<Id, Account> accountsById = new Map<Id, Account>();
        if (!accountIds.isEmpty()) {
            accountsById = new Map<Id, Account>([
                SELECT Id, Name
                FROM Account
                WHERE Id IN :accountIds
                WITH USER_MODE
            ]);
        }

        List<Result> results = new List<Result>();
        for (Request request : requests) {
            Result result = new Result();
            result.found = false;

            if (request == null || request.accountId == null) {
                result.status = 'Account ID is required.';
            } else {
                Account account = accountsById.get(request.accountId);
                if (account == null) {
                    result.status = 'Account not found or not available.';
                } else {
                    result.found = true;
                    result.accountName = account.Name;
                    result.status = 'Account found.';
                }
            }
            results.add(result);
        }

        return results;
    }
}
```

The method preserves input order and returns one result per request, as required for invocable methods that return results. The query uses `WITH USER_MODE` to enforce the running user’s access. Configure the action and its permissions for the intended Agentforce user, and instruct the agent to use `found` and `status` when deciding what to say. See Salesforce’s [invocable method reference](https://developer.salesforce.com/docs/platform/apex-dev/references/apex-dev/apex-classes-annotation-invocablemethod.html) and [Agentforce Apex action guidance](https://developer.salesforce.com/docs/ai/agentforce/guide/agent-invocablemethod.html).

### Test class

Save this as `AccountLookupTest.cls`. The test checks a batch containing a matching ID, a deleted account ID, and a missing ID, plus empty and null input lists.

```apex
@IsTest
private class AccountLookupTest {
    @IsTest
    static void returnsAnOutcomeForEachRequest() {
        Account matching = new Account(Name = 'Lookup test account');
        Account deletedAccount = new Account(Name = 'Deleted lookup account');
        insert new List<Account>{ matching, deletedAccount };

        Id deletedId = deletedAccount.Id;
        delete deletedAccount;

        AccountLookup.Request foundRequest = new AccountLookup.Request();
        foundRequest.accountId = matching.Id;

        AccountLookup.Request missingRequest = new AccountLookup.Request();
        missingRequest.accountId = deletedId;

        AccountLookup.Request noIdRequest = new AccountLookup.Request();

        Test.startTest();
        List<AccountLookup.Result> results = AccountLookup.findAccounts(
            new List<AccountLookup.Request>{
                foundRequest, missingRequest, noIdRequest
            }
        );
        Test.stopTest();

        System.assertEquals(3, results.size(), 'Return one result per request.');
        System.assertEquals(true, results[0].found);
        System.assertEquals('Lookup test account', results[0].accountName);
        System.assertEquals('Account found.', results[0].status);

        System.assertEquals(false, results[1].found);
        System.assertEquals(null, results[1].accountName);
        System.assertEquals('Account not found or not available.', results[1].status);

        System.assertEquals(false, results[2].found);
        System.assertEquals('Account ID is required.', results[2].status);
    }

    @IsTest
    static void returnsNoResultsForNoRequests() {
        Test.startTest();
        List<AccountLookup.Result> emptyResults = AccountLookup.findAccounts(
            new List<AccountLookup.Request>()
        );
        List<AccountLookup.Result> nullResults = AccountLookup.findAccounts(null);
        Test.stopTest();

        System.assertEquals(0, emptyResults.size());
        System.assertEquals(0, nullResults.size());
    }
}
```

Normal SOQL excludes the deleted account, so the first test exercises an empty lookup for that ID. Org validation rules or automation may require additional fixture fields or setup. These examples have not been run in an org for this post; the tests also do not establish the permissions of your Agentforce user.

## How do I reproduce List index out of bounds: 0 safely?
{: #reproduce}

Run a small anonymous Apex example in a development org to see the exception without changing records. Then deploy and run the action’s tests in that org.

1. Open your development org and launch **Developer Console** from the **Setup gear** menu. If it is unavailable, an administrator can open Setup, enter **Development** in Quick Find, select **Web Console**, and set **Enable Developer Console** to **Active**. See Salesforce’s [Web Console FAQ](https://developer.salesforce.com/docs/platform/webconsole/guide/faq.html).
2. In Developer Console, choose **Debug → Open Execute Anonymous Window**.
3. Enter the following code and execute it:

```apex
List<String> values = new List<String>();
System.debug(values[0]);
```

4. Inspect the execution result or log for the list exception. This example performs no database writes.
5. Create the files in the solution kit, deploy them to the development org, and run `AccountLookupTest`. Confirm that both tests pass.

The reproduction demonstrates an empty list access. Use the stack trace and execution context to establish the cause of a particular action failure.

## How do I prevent List index out of bounds: 0?
{: #prevent}

Define what an empty result means at each boundary and test it. Validate the actual index being accessed, including after a list has changed.

- Use `isEmpty()` before reading index `0`. For any index `i`, require `i >= 0` and `i < items.size()`.
- Check the index in the expression itself. A loop condition that validates `i` does not automatically validate `i + 1`.
- Prefer a `for` loop over list elements when you do not need an index. An empty list then produces zero iterations.
- Give an Agentforce action a clear result for each request, and make the agent’s instructions account for no match.
- Test matching, missing, filtered-out, and relevant visibility cases. Include relationships and filters in test fixtures.
- Keep SOQL outside loops when processing collections. See [Salesforce Too Many SOQL Queries 101](/blog/salesforce-too-many-soql-queries-101/).

## Related errors
{: #related-errors}

Similar messages point to different failing operations. Check the exception type and requested index before applying a fix.

### Negative list index

```text
System.ListException: List index out of bounds: -1
```

**Cause:** Apex attempted to use a negative index.

**Fix:** Check the calculation that produces the index and require it to be at least zero and less than the list size.

### Null reference

```text
System.NullPointerException: Attempt to de-reference a null object
```

**Cause:** Code dereferenced a null reference.

**Fix:** Identify which reference is null and handle that condition before accessing its fields or methods.

### No rows assigned to a single sObject

```text
System.QueryException: List has no rows for assignment to SObject
```

**Cause:** A SOQL query assigned directly to a single sObject returned no rows.

**Fix:** When a match is optional, assign the query to a list and check whether it is empty before accessing a result.

For another common query-related failure, see [SObject Row Retrieved Without Querying the Field](/blog/sobject-row-retrieved-without-querying-field/).

## Official sources
{: #official-sources}

These Salesforce sources support the diagnosis, action contract, and deployment steps.

- [Apex: How to Fix “System.ListException: List index out of bounds”](https://help.salesforce.com/s/articleView?id=000385743&language=en_US&type=1): empty query results and checking list size. Checked 2026-11-28.
- [Capture and read Salesforce debug logs](https://help.salesforce.com/s/articleView?id=000392579&language=en_US&type=1): trace setup and query row-count events. Checked 2026-11-28.
- [Set an access mode for database operations](https://developer.salesforce.com/docs/platform/apex-dev/references/apex-dev/apex-classes-enforce-usermode.html): user mode, system mode, and API version behavior. Checked 2026-11-28.
- [InvocableMethod annotation](https://developer.salesforce.com/docs/platform/apex-dev/references/apex-dev/apex-classes-annotation-invocablemethod.html): invocable input and output requirements. Checked 2026-11-28.
- [Apex for Agentforce custom actions](https://developer.salesforce.com/docs/ai/agentforce/guide/agent-invocablemethod.html): using invocable Apex in an agent action. Checked 2026-11-28.
- [Built-in Apex exceptions](https://developer.salesforce.com/docs/platform/apex-dev/references/apex-dev/apex-exception-builtin.html): exception types. Checked 2026-11-28.
- [Web Console FAQ](https://developer.salesforce.com/docs/platform/webconsole/guide/faq.html): enabling Developer Console. Checked 2026-11-28.
- [Run Apex tests with Salesforce CLI](https://developer.salesforce.com/docs/platform/sfdx-dev/guide/sfdx-dev-testing.html) and [deploy project metadata](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_project_deploy_start.html): test and deployment workflow. Checked 2026-11-28.

Need this fixed in your org? [SFX can build it](/services/) with a written scope and fixed quote.

## Solution kit
{: #solution-kit}

The complete example needs two Apex files and their metadata files in an existing Salesforce DX project. Deploy it first to a Developer Edition org or sandbox, then configure and test it as an Agentforce custom action with the intended user permissions.

Create these four files:

```text
force-app/main/default/classes/AccountLookup.cls
force-app/main/default/classes/AccountLookup.cls-meta.xml
force-app/main/default/classes/AccountLookupTest.cls
force-app/main/default/classes/AccountLookupTest.cls-meta.xml
```

Use the two Apex blocks above for the `.cls` files. Put the following content in **each** `.cls-meta.xml` file:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>66.0</apiVersion>
    <status>Active</status>
</ApexClass>
```

From the project root, with Salesforce CLI installed and the development org authenticated under the alias `my-dev-org`, run:

```bash
sf project deploy start \
  --source-dir force-app/main/default/classes/AccountLookup.cls \
  --source-dir force-app/main/default/classes/AccountLookupTest.cls \
  --target-org my-dev-org \
  --wait 10
```

After the deployment succeeds, run:

```bash
sf apex run test \
  --tests AccountLookupTest \
  --target-org my-dev-org \
  --result-format human \
  --wait 10
```

Replace `my-dev-org` with your org alias. If either command returns a job ID before finishing, check the final result before treating the deployment or tests as successful. Production deployments have their own test requirements; review the [Salesforce deployment reference](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_project_deploy_start.html) before deploying there.

<script>
document.addEventListener('DOMContentLoaded', function () {
  const actions = document.querySelector('.article-cta-actions');
  if (!actions) return;
  const serviceLink = actions.querySelector('a[href="/services/"]');
  Array.from(actions.querySelectorAll('a')).forEach(function (link) {
    if (link !== serviceLink) link.remove();
  });
});
</script>
