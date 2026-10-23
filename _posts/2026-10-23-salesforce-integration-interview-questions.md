---
layout: blog-post
sfx_blog: true
featured: true
title: "15 Salesforce Integration Interview Questions and Answers"
description: "Prepare for Salesforce integration interviews with 15 scenario-based questions on APIs, security, retries, events, testing, and monitoring."
date: 2026-10-23 08:00:00 +0530
last_modified_at: 2026-10-23 08:00:00 +0530
permalink: /blog/salesforce-integration-interview-questions/
primary_category: "Integration"
series: "Salesforce Interview Questions"
categories:
  - interview-prep
  - integration
  - apex
  - architecture
tags:
  - Salesforce integration interview questions
  - Salesforce Integration
  - REST API
  - Named Credentials
  - Platform Events
  - Change Data Capture
  - Pub/Sub API
  - Bulk API 2.0
reading_time: "15 min read"
og_type: article
extra_css:
  - /assets/css/blog.css
toc:
  - id: answer-framework
    label: "Answer framework"
  - id: architecture-questions
    label: "Architecture and APIs"
  - id: security-questions
    label: "Security and credentials"
  - id: reliability-questions
    label: "Reliability and retries"
  - id: event-driven-questions
    label: "Events and data sync"
  - id: testing-operations
    label: "Testing and operations"
  - id: quick-revision
    label: "Quick revision"
---

Your integration receives an order request, calls a payment service, and times out. The user clicks **Retry**. Two orders appear in the downstream system.

What went wrong?

The strongest Salesforce integration interview answer is not “use REST API.” It identifies the unknown outcome created by the timeout, explains how an idempotency key prevents a duplicate side effect, defines who owns retries, and describes how support teams reconcile the two systems.

This guide gives you 15 scenario-based Salesforce integration interview questions and strong answer structures. The goal is to help you reason about reliability, security, data volume, transaction boundaries, and operations—not memorize product names.

If you are preparing across multiple Salesforce roles, start with the broader [scenario-based Salesforce interview questions guide](/blog/salesforce-interview-questions-scenario-based/) and return here for a deeper integration round.

## A strong integration answer framework {#answer-framework}

Before choosing an API or pattern, clarify six things:

1. **Direction:** Is Salesforce calling out, receiving a request, publishing an event, or subscribing to changes?
2. **Timing:** Does the caller need an immediate answer, or can processing finish later?
3. **Volume:** Is this one record, a small dependent transaction, a large data load, or a continuous event stream?
4. **Reliability:** What happens after a timeout, duplicate message, partial failure, or consumer outage?
5. **Security:** Which identity is used, what data can it access, and where are credentials stored?
6. **Operations:** How will teams trace, retry, reconcile, and alert on failures?

> A good answer connects the business requirement to a pattern, explains the trade-off, and proves how the integration behaves when something fails.

## Architecture and API questions {#architecture-questions}

### 1. How do you choose between synchronous and asynchronous integration?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I choose synchronous request–reply when the user or calling process needs an immediate result and both systems can meet the latency and availability requirement. I choose asynchronous messaging when work can finish later, traffic can spike, systems need looser coupling, or retries and replay matter more than an immediate response.

I translate “real time” into a measurable requirement. A user waiting for an eligibility decision may require a synchronous response. Sending a won Opportunity to fulfillment usually does not need to block the Salesforce transaction and is often safer as an event or queued job.

I also define the timeout behavior. If the caller does not receive a response, the outcome is unknown—not automatically failed—so the design needs idempotency or a status lookup before repeating the side effect.
</div>

### 2. REST API, Composite API, or Bulk API 2.0—which would you use?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

For individual records and ordinary CRUD, REST resources are a natural fit. For a small set of related operations where one response feeds another, Composite resources can reduce round trips and express dependencies. For large asynchronous ingest, update, upsert, delete, or query workloads, I consider Bulk API 2.0.

The deciding factor is workload shape, not which API I know best. Bulk API adds job-management overhead and is not automatically better for small interactive operations. Composite reduces network calls but still requires a clear partial-failure strategy. For upserts, I define an External ID and matching contract before loading data.
</div>

Salesforce’s official [Platform API comparison](https://developer.salesforce.com/blogs/2024/04/accessing-object-data-with-salesforce-platform-apis) maps record volume and interaction style to the major data APIs. The [Bulk API 2.0 guide](https://developer.salesforce.com/docs/platform/api-asynch/guide/bulk-api-2-0.html) documents its asynchronous ingest and query model.

### 3. When would you use middleware instead of point-to-point integration?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I introduce middleware when several systems need orchestration, canonical transformations, protocol mediation, centralized retries, throttling, routing, or shared observability. Middleware is especially useful when Salesforce should not own downstream-specific branching and recovery logic.

I do not add middleware only to make the diagram look enterprise. For a well-bounded call from Salesforce to one stable service, a Named Credential and focused Apex or Flow implementation can be simpler. The trade-off is another platform to operate versus reduced coupling and centralized control.
</div>

### 4. An external system must create an Account and related Contacts atomically. What would you design?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

First I confirm whether “atomic” truly means all records must succeed or none may persist. If standard APIs meet the requirement, I consider Composite with dependent subrequests and the appropriate rollback behavior. I use reference IDs so later subrequests can consume earlier results.

If the business transaction needs custom validation, complex orchestration, or behavior that standard resources cannot express safely, I may expose a narrow Apex REST service. That service should define one request contract, validate inputs, enforce the intended access model, and return stable business error codes. I would not expose a generic “run anything” endpoint.
</div>

The REST API guide explains how [Composite requests execute dependent operations](https://developer.salesforce.com/docs/platform/api-rest/guide/resources-composite-composite-post.html) and return each subrequest’s status.

## Security and credential questions {#security-questions}

### 5. Where should an Apex callout store its endpoint and authentication details?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I use the current Named Credential and External Credential model rather than hardcoding a URL, API key, client secret, or access token in Apex, Custom Metadata, or a Custom Setting.

The Named Credential defines the endpoint and transport configuration. The External Credential defines the authentication protocol and principals. Principal access is mapped through profiles, permission sets, or permission set groups. I provision sensitive authentication material separately in each environment because secrets should not travel in source control.
</div>

Salesforce’s [Named Credentials guide](https://developer.salesforce.com/docs/platform/named-credentials/guide/get-started.html) recommends the extensible Named Credential model and notes that legacy named credentials are deprecated.

```apex
HttpRequest request = new HttpRequest();
request.setEndpoint('callout:Order_Service/v1/orders');
request.setMethod('POST');
request.setHeader('Content-Type', 'application/json');
request.setHeader('Idempotency-Key', stableRequestId);
request.setBody(JSON.serialize(payload));

HttpResponse response = new Http().send(request);
if (response.getStatusCode() < 200 || response.getStatusCode() >= 300) {
    throw new OrderIntegrationException(
        'Order service returned HTTP ' + response.getStatusCode()
    );
}
```

The code refers to the credential by name and contains no secret. The idempotency key is stable for the business operation; it must not be regenerated for every retry.

### 6. When do you use a named principal versus per-user authentication?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I use a named principal when all approved Salesforce users or processes should call the remote service as one controlled integration identity. I use per-user authentication when the downstream system must authorize and audit each individual user separately.

The decision changes support and security. A shared integration identity is simpler to operate but needs tightly scoped permissions, credential rotation, and audit correlation back to the initiating Salesforce user. Per-user authentication preserves downstream user identity but requires every user to authenticate and introduces more token-lifecycle failure modes.
</div>

### 7. Is an Apex REST class secure because it is declared `with sharing`?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

No. `with sharing` addresses record-level sharing; it does not automatically enforce object and field permissions. I define whether the endpoint should operate in user context or as a controlled integration service, then enforce that decision explicitly.

For user-context data operations I consider user-mode SOQL and DML or appropriate CRUD and field-level checks. I validate every input, use bind variables, avoid returning internal exception details, and grant the integration user only the permissions required by the contract. Authentication proves identity; it does not prove that every requested operation should be allowed.
</div>

The SFX [Salesforce Security and Sharing guide](/security-sharing/) provides the object, field, and record-access model that should be applied to inbound services.

## Reliability and retry questions {#reliability-questions}

### 8. A callout times out. Should the integration retry immediately?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

Not automatically. A timeout tells me that Salesforce did not receive a complete response. It does not prove that the remote service failed to process the request.

For a read-only request, a bounded retry may be safe. For a side effect such as creating an order or taking payment, I first need an idempotent operation or a status lookup. The request carries a stable business or idempotency key, and the receiver returns the existing result when that key is seen again.

Retries should be bounded, use backoff, distinguish transient errors from permanent validation errors, and end in an observable recovery queue rather than retry forever.
</div>

### 9. How does idempotency prevent duplicate Salesforce records?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

For inbound data, I define a stable source-system identifier and store it in a unique External ID field. The integration uses upsert so the same business entity updates the existing Salesforce record instead of inserting another one.

For business commands, an External ID alone may not be enough. I also track a unique request identifier and the processing result. If the same command arrives again, the receiver returns the previous result without repeating the side effect.

I do not use a retry attempt number as the idempotency key. Every retry of the same logical operation must carry the same key.
</div>

Salesforce Architects describes duplicate tracking with unique message identifiers as the typical [idempotent receiver pattern](https://architect.salesforce.com/docs/architect/fundamentals/guide/integration-patterns).

### 10. How would you build a retry and dead-letter process in Salesforce?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I store durable request state outside the running transaction: correlation ID, target operation, sanitized payload reference, attempt count, next-attempt time, last error category, and final status. Queueable or scheduled processing can select eligible work and make the callout.

I retry only transient failures such as selected timeouts, throttling responses, or temporary service errors. Authentication, schema, and business-validation failures should stop and alert an owner. After the maximum attempts, the request moves to a failed state with a manual replay action that preserves the original idempotency key.

I also control concurrency so a recovery surge does not overload the remote service or Salesforce. The queue is an operational product: it needs ownership, dashboards, alerts, retention, and a runbook.
</div>

For Apex execution options and transaction trade-offs, see [Asynchronous Apex](/asynchronous-apex/).

## Event-driven and data-sync questions {#event-driven-questions}

### 11. Platform Events or Change Data Capture—which should you choose?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I use a custom Platform Event when the business wants to publish an explicit fact such as `Order_Ready__e` with a deliberate event contract. I use Change Data Capture when consumers need notifications that Salesforce records were created, updated, deleted, or undeleted.

CDC communicates record change; it does not automatically communicate business intent. An Opportunity field update may happen for many reasons, while `Fulfillment_Requested__e` states what downstream systems should do. The choice depends on the contract consumers need, not only on which mechanism is easier to enable.
</div>

Salesforce documents that [Change Data Capture publishes record-change events](https://developer.salesforce.com/docs/platform/change-data-capture/guide/cdc-intro.html), while [Pub/Sub API](https://developer.salesforce.com/docs/platform/pub-sub-api/guide/intro.html) offers one interface for publishing and subscribing to Platform Events and subscribing to CDC events.

### 12. How does an event subscriber recover after being offline?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

The subscriber durably stores its last successfully processed replay position and requests retained events from that position when it reconnects. It acknowledges progress only after its own processing succeeds.

Replay does not remove the need for idempotency. The consumer can receive the same business event more than once, so it should deduplicate using a durable message or business identifier. I also design for the case where the outage lasts beyond the event-retention window: run a reconciliation query or bulk extract to rebuild the missing state.
</div>

The Pub/Sub API documentation explains [event durability and replay IDs](https://developer.salesforce.com/docs/platform/pub-sub-api/guide/event-message-durability.html). Retention is finite, so replay and reconciliation solve different recovery windows.

### 13. How do you prevent loops in a bidirectional synchronization?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I define field-level ownership first. If Salesforce owns customer status and the ERP owns credit status, each side publishes only changes it owns. I carry source-system and correlation metadata so a consumer can recognize its own echoed update.

I compare meaningful values before writing, avoid updates that make no actual change, and use stable external identifiers. A blanket “integration user changed it, so ignore it” rule can hide legitimate work and breaks when several integrations share an identity. Ownership and correlation are safer than username-only filtering.
</div>

## Testing and production operations {#testing-operations}

### 14. How do you test an Apex HTTP integration?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I separate payload mapping, business decisions, and transport code so most behavior can be tested without a network dependency. For the callout boundary, I use `HttpCalloutMock` with `Test.setMock()` and assert both the outbound request and the handling of the response.

The test suite includes success, validation error, authentication failure, throttling, server error, timeout-equivalent exception, malformed JSON, empty body, and duplicate retry behavior. I assert durable state and business outcomes—not only code coverage.

Credential configuration is also tested in a sandbox or target test org with least-privileged access. Unit tests prove code paths; they do not prove that an OAuth principal, endpoint, certificate, firewall, or remote permission is configured correctly.
</div>

### 15. What should you monitor after a Salesforce integration goes live?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I monitor business completion, not only HTTP success. The minimum operational view includes request count, success and failure rate, latency, retry count, queue age, dead-letter volume, authentication failures, API or event allocation usage, and reconciliation differences.

Every transaction carries a correlation ID across Salesforce, middleware, and the remote system. Logs avoid secrets and unnecessary customer data but preserve enough context to trace one business operation. Alerts have owners and thresholds, and the runbook explains how to replay safely.

Finally, I reconcile. For example, compare orders marked “sent” in Salesforce with orders accepted downstream. A 200 response does not guarantee that every later business step completed.
</div>

Salesforce provides [API usage notifications](https://help.salesforce.com/articleView?id=monitor_rate_limit.htm&language=en_US) and the `PlatformEventUsageMetric` object for [monitoring event publishing and delivery usage](https://developer.salesforce.com/docs/platform/platform-events/guide/platform-events-monitor-usage.html). These platform metrics should complement application-level business metrics.

## Quick revision sheet {#quick-revision}

Use this table before your interview:

| Scenario | Start with | Important follow-up |
|---|---|---|
| Immediate user decision | Synchronous request–reply | Timeout and fallback behavior |
| Large data migration | Bulk API 2.0 with External IDs | Reconciliation and failed-record replay |
| Several dependent REST operations | Composite API | Partial failure and rollback choice |
| Secure Apex callout | Named + External Credential | Principal permissions and secret provisioning |
| Timeout after a create request | Idempotency key or status lookup | Never assume timeout means failure |
| Business event | Custom Platform Event | Contract versioning and consumer ownership |
| Record-change synchronization | Change Data Capture | Loop prevention and field ownership |
| Subscriber outage | Stored replay position | Finite retention and reconciliation fallback |
| Production retry | Durable queue with bounded backoff | Dead-letter owner and manual replay |
| Integration testing | `HttpCalloutMock` plus sandbox credential test | Assert requests, failures, and business state |

The recurring theme is ownership. Someone must own the data contract, authentication principal, retry queue, alert, reconciliation report, and recovery decision. An integration is not complete when data moves once; it is complete when teams can prove what happened and recover when it does not.

If you want to practise another category, continue with [18 scenario-based Salesforce interview questions](/blog/salesforce-interview-questions-scenario-based/) covering Admin, Security, Flow, Apex, Deployment, and Integration.

Working through a real integration design or interview scenario? [Contact SFX Support](/contact/) or use [Ask Krrish](/chatbot/) to reason through the trade-offs.

## Sources

- [Integration Patterns — Salesforce Architects](https://architect.salesforce.com/docs/architect/fundamentals/guide/integration-patterns)
- [Get Started with Named Credentials — Salesforce Developers](https://developer.salesforce.com/docs/platform/named-credentials/guide/get-started.html)
- [Send Multiple Requests Using Composite — REST API Developer Guide](https://developer.salesforce.com/docs/platform/api-rest/guide/resources-composite-composite-post.html)
- [Bulk API 2.0 — Salesforce Developers](https://developer.salesforce.com/docs/platform/api-asynch/guide/bulk-api-2-0.html)
- [Get Started with Pub/Sub API — Salesforce Developers](https://developer.salesforce.com/docs/platform/pub-sub-api/guide/intro.html)
- [Change Data Capture — Salesforce Developers](https://developer.salesforce.com/docs/platform/change-data-capture/guide/cdc-intro.html)
- [Event Message Durability — Pub/Sub API](https://developer.salesforce.com/docs/platform/pub-sub-api/guide/event-message-durability.html)
- [Monitor Platform Event Publishing and Delivery Usage — Salesforce Developers](https://developer.salesforce.com/docs/platform/platform-events/guide/platform-events-monitor-usage.html)
- [Manage API Usage Notifications — Salesforce Help](https://help.salesforce.com/articleView?id=monitor_rate_limit.htm&language=en_US)
