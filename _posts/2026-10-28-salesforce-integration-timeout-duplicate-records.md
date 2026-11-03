---
layout: blog-post
sfx_blog: true
featured: false
title: "Why Salesforce Integration Retries Create Duplicate Records—and How Idempotency Fixes It"
seo_title: "Salesforce Integration Idempotency: Stop Duplicates"
description: "Stop Salesforce integration retries from creating duplicate orders with idempotency keys, unique external IDs, safe responses, and reconciliation."
date: 2026-10-28 08:00:00 +0530
last_modified_at: 2026-10-28 08:00:00 +0530
permalink: /blog/salesforce-integration-retries-idempotency/
primary_category: "Integration"
series: "Real-World Salesforce Problem Solving"
categories:
  - integration
  - architecture
  - apex
  - problem-solving
tags:
  - Salesforce Integration
  - Idempotency
  - Integration Retries
  - External ID
  - Apex REST
  - Duplicate Records
reading_time: "16 min read"
og_type: article
extra_css:
  - /assets/css/blog.css
toc:
  - id: timeout-ambiguity
    label: "Why timeouts create duplicates"
  - id: idempotency-contract
    label: "Define the idempotency contract"
  - id: entity-vs-command
    label: "External ID versus command key"
  - id: inbound-pattern
    label: "Inbound Salesforce pattern"
  - id: outbound-pattern
    label: "Outbound Salesforce pattern"
  - id: failure-matrix
    label: "Failure and retry matrix"
  - id: verification
    label: "Testing and monitoring"
  - id: interview-answer
    label: "Interview-ready answer"
---

Your ecommerce service sends Salesforce a request to create order `WEB-84721`. Salesforce commits the order, but the HTTP response never reaches the service. After 30 seconds, the service sees a timeout and sends the same `POST` again.

If the endpoint treats both requests as new work, Salesforce creates two orders. The transport failed once, but the business operation happened twice.

The weak fix is “check whether an order exists before inserting.” Two requests can perform that check at the same time, both see no record, and both insert. The production-safe fix is a contract: every retry of the same logical operation carries the same idempotency key; Salesforce enforces that key with a unique database constraint; and the endpoint returns the original result instead of repeating the side effect.

This is a deeper implementation guide to one failure mode covered in our [Salesforce integration interview questions](/blog/salesforce-integration-interview-questions/). It applies to orders, payments, refunds, case creation, provisioning, and any write that must happen once from the business user's point of view.

## Why a timeout creates an unknown outcome
{: #timeout-ambiguity}

A timeout does not mean “Salesforce rejected the request.” It means the caller did not receive a complete response before its deadline. At least four outcomes are possible:

| What actually happened | What the caller observed | Risk of a blind retry |
|---|---|---|
| The request never reached Salesforce | Timeout | Usually safe, but the caller cannot prove it |
| Salesforce received the request but rolled it back | Timeout | Usually safe, but still unknown to the caller |
| Salesforce committed the change and the response was lost | Timeout | A second insert creates a duplicate |
| Salesforce is still processing the first request | Timeout | Concurrent attempts can race or repeat a side effect |

This uncertainty is the core design problem. Increasing the client timeout can reduce how often it occurs, but it cannot eliminate dropped connections, proxy failures, client restarts, or delayed responses.

Retries are still necessary. Networks and services fail transiently. The goal is not “never retry”; it is **make the operation safe to repeat**.

Salesforce Architects describes this as an **idempotent receiver**: the receiver tracks a unique message identifier and prevents repeated delivery from repeating the business effect. The same guidance warns that repeated non-idempotent invocations can create duplicate records or process a transaction more than once.

### The three identities people often mix up

Keep these values separate:

1. **Business entity ID:** Identifies the order, customer, invoice, or case, such as `WEB-84721`.
2. **Idempotency key:** Identifies one requested operation, such as “create order WEB-84721.” Every retry of that operation reuses the key.
3. **Correlation ID:** Connects logs and spans across Salesforce, middleware, and the remote system. It can change by attempt if a trace system requires that, while the idempotency key stays stable.

A retry counter is not an idempotency key. Generating a fresh UUID for every attempt guarantees that the receiver sees every retry as new work.

## Define the idempotency contract before writing Apex
{: #idempotency-contract}

The caller and receiver need an explicit contract. “We send a unique ID” is not enough.

### 1. Decide who creates the key

The system that knows the logical business operation should create the key and persist it before the first network attempt. For an inbound order request, the ecommerce service can create it. For an outbound Salesforce refund, Salesforce can create and store it before dispatch.

Every retry—automatic, manual, or replayed from a recovery queue—must reuse that key.

### 2. Scope the key

Define whether a key is unique globally or within a tenant and operation. A practical internal uniqueness value could be:

```text
commerce-eu:create-order:8d6d99ab-6e8a-45b0-8ad2-8502d77776d6
```

Do not concatenate untrusted values without length and character validation. Store a normalized key that fits the Salesforce field definition.

### 3. Bind the key to the request

The same key with the same logical payload is a retry. The same key with a different amount, customer, or order identifier is a client defect or possible abuse.

Store a request fingerprint made from normalized business fields. Do not hash raw JSON unless the sender guarantees canonical serialization; harmless property ordering or whitespace changes would otherwise produce a different hash.

### 4. Define the response for every state

A useful contract distinguishes:

- **First accepted request:** Process it and return the created resource or accepted job.
- **Completed duplicate:** Return the previously stored outcome; do not run the action again.
- **Same key, different fingerprint:** Reject it as a conflict.
- **First request still processing:** Return an “in progress” response or a status resource; do not start a second worker.
- **Retryable failure:** Preserve the key and retry policy.
- **Permanent validation failure:** Return the same stable rejection for that request unless the business contract explicitly allows a corrected payload under a new key.

The response should tell the caller whether a resource was newly created or replayed, while keeping the business result stable.

### 5. Set retention from business risk

Do not delete idempotency records merely because the transport retry window ended. A support engineer may replay a week-old failed request. A mobile client may reconnect much later. Payments or refunds may require a longer protection window than low-impact notifications.

Retention is a business, audit, storage, and privacy decision. Document when a key can be reused, and never silently reuse it while the original business effect still matters.

## External ID upsert is useful—but it is not the entire contract
{: #entity-vs-command}

Salesforce REST API can upsert an sObject by an External ID. If the value matches no record, Salesforce creates one; if it matches one record, Salesforce updates that record. Salesforce also recommends upsert in cases where duplicate records must be avoided.

For entity synchronization, that is often exactly right:

```http
PATCH /services/data/v68.0/sobjects/Order__c/External_Order_Id__c/WEB-84721
Content-Type: application/json

{
  "Status__c": "Confirmed",
  "Total__c": 249.90
}
```

Configure `External_Order_Id__c` as both **External ID** and **Unique**. The unique database index closes the race that a query-then-insert implementation leaves open.

But an entity key and a command key answer different questions:

| Requirement | Best key |
|---|---|
| Synchronize the latest state of order `WEB-84721` | Unique external order ID |
| Charge order `WEB-84721` once | Idempotency key for the charge command |
| Refund two separate items on the same order | One idempotency key per refund command |
| Replay the result of a prior request | Stored command key plus stored response |

Upserting an order can stop a second order record, but it does not automatically stop downstream automation from sending a second confirmation, allocating inventory again, or making a second callout when the same command updates the record twice.

Use an entity External ID for record identity. Add a command ledger when the operation has a side effect whose result must be replayed or audited.

## A practical inbound Salesforce pattern
{: #inbound-pattern}

Assume an external service calls a custom Apex REST endpoint to create an order. First consider whether the standard sObject REST resource or Composite API can satisfy the requirement; custom Apex REST adds code, security, testing, and operational ownership.

When custom orchestration is justified, create a small command-ledger object such as `Integration_Request__c`.

### Suggested fields

| Field | Purpose |
|---|---|
| `Idempotency_Key__c` | Text, External ID, and Unique; the database race barrier |
| `Operation__c` | For example, `CREATE_ORDER` or `REFUND_ORDER` |
| `Request_Fingerprint__c` | Hash of normalized business inputs |
| `Status__c` | Received, Processing, Succeeded, Retryable Failure, or Rejected |
| `Response_Code__c` | Stable HTTP or application result |
| `Response_Body__c` | Sanitized result that can be replayed |
| `Business_Record_Id__c` | The resulting Order, Case, or other record |
| `Correlation_Id__c` | Cross-system trace value |
| `Attempt_Count__c` | Operational visibility, not deduplication identity |
| `Last_Error_Category__c` | Safe category; do not store secrets or raw sensitive responses |

The key must be enforced by a unique field. Apex logic alone is not a concurrency control.

### Request algorithm

Use this sequence:

1. Authenticate the caller and authorize the operation through a least-privileged integration user or connected app policy.
2. Validate the key, operation, content type, payload size, and required business fields.
3. Normalize the relevant inputs and calculate the request fingerprint.
4. Attempt to insert the ledger record with the unique key.
5. If the key already exists, compare fingerprints and return the stored state or result.
6. If the key is new, run the business transaction once.
7. Store the successful result before returning it.
8. If business processing fails, roll back partial business DML while preserving a classified ledger result for safe recovery.

The following Apex fragment shows the core database controls. Adapt object names, authorization, error handling, and response DTOs to your org.

```apex
public with sharing class OrderIdempotencyService {
    public class Result {
        public Boolean created;
        public Id orderId;
        public String outcome;
    }

    public static Result createOrReplay(
        String idempotencyKey,
        String fingerprint,
        Order__c requestedOrder
    ) {
        Integration_Request__c ledger = new Integration_Request__c(
            Idempotency_Key__c = idempotencyKey,
            Operation__c = 'CREATE_ORDER',
            Request_Fingerprint__c = fingerprint,
            Status__c = 'Processing'
        );

        Database.SaveResult inserted = Database.insert(
            ledger,
            false,
            AccessLevel.USER_MODE
        );

        if (!inserted.isSuccess()) {
            Boolean duplicateKey = false;
            for (Database.Error error : inserted.getErrors()) {
                duplicateKey = duplicateKey ||
                    error.getStatusCode() == StatusCode.DUPLICATE_VALUE;
            }
            if (!duplicateKey) {
                throw new IdempotencyException('Unable to register request');
            }
            return replayExisting(idempotencyKey, fingerprint);
        }

        Savepoint businessWork = Database.setSavepoint();
        try {
            Database.UpsertResult orderResult = Database.upsert(
                requestedOrder,
                Order__c.Fields.External_Order_Id__c,
                AccessLevel.USER_MODE
            );
            if (!orderResult.isSuccess()) {
                throw new IdempotencyException('Order was not accepted');
            }

            ledger.Status__c = 'Succeeded';
            ledger.Business_Record_Id__c = orderResult.getId();
            ledger.Response_Code__c = '201';
            Database.update(ledger, AccessLevel.USER_MODE);

            Result response = new Result();
            response.created = orderResult.isCreated();
            response.orderId = orderResult.getId();
            response.outcome = 'SUCCEEDED';
            return response;
        } catch (Exception processingError) {
            Database.rollback(businessWork);

            ledger.Status__c = 'Retryable Failure';
            ledger.Last_Error_Category__c = classify(processingError);
            Database.update(ledger, AccessLevel.USER_MODE);
            throw processingError;
        }
    }

    public class IdempotencyException extends Exception {}

    // Implement replayExisting() with a USER_MODE query. It must compare the
    // stored fingerprint and return only an approved, sanitized response.
    // Implement classify() with an allowlist of safe operational categories.
}
```

Important review points:

- `with sharing` alone does not enforce object and field permissions. The example explicitly requests user-mode DML; verify the integration user has only the permissions required by this contract.
- Catching and classifying the error preserves the ledger entry. If an exception rolls back the whole transaction, the key disappears and the next attempt can look new.
- The savepoint is created **after** the ledger insert, so rolling back to it removes partial business DML but retains the request record.
- Never return raw exception messages to the caller or store secrets in the ledger.
- `replayExisting()` must reject a reused key with a different fingerprint. It must not simply return whichever record happens to share the key.
- If the work can exceed the synchronous deadline, create durable work and return an accepted/status response instead of holding the connection open.

### What if both requests arrive at the same time?

Both may reach the insert statement, but only one can own a correctly configured unique value. The database constraint is the serialization point. One request processes the command; the other follows the duplicate path.

Do not replace the unique constraint with this pattern:

```apex
// Unsafe under concurrency: both requests can query before either inserts.
if ([SELECT COUNT() FROM Order__c WHERE External_Order_Id__c = :externalId] == 0) {
    insert new Order__c(External_Order_Id__c = externalId);
}
```

The query is useful for retrieving an existing result, but it is not the final race barrier.

## A practical outbound Salesforce pattern
{: #outbound-pattern}

Now reverse the direction: Salesforce must send a paid order to fulfillment.

The Salesforce transaction should create durable dispatch state before relying on the network. A common pattern is:

1. Create an integration-work record with a unique idempotency key and the business record reference.
2. Commit the business change and durable work according to the selected transaction pattern.
3. Let Queueable Apex, middleware, or an event consumer dispatch the request.
4. Send the stored idempotency key in the remote API contract.
5. Classify the response and update the work record.
6. Retry only transient failures, with bounded backoff and the **same** key.
7. Move exhausted work to a visible failed state for controlled replay and reconciliation.

Use a current Named Credential and External Credential for the endpoint and authentication. Do not hardcode a URL, client secret, access token, or API key in Apex, Custom Metadata, or a Custom Setting.

```apex
HttpRequest request = new HttpRequest();
request.setEndpoint('callout:Fulfillment_Service/v1/orders');
request.setMethod('POST');
request.setHeader('Content-Type', 'application/json');
request.setHeader('Idempotency-Key', work.Idempotency_Key__c);
request.setHeader('X-Correlation-Id', work.Correlation_Id__c);
request.setBody(work.Sanitized_Request_Body__c);

HttpResponse response = new Http().send(request);
```

The remote receiver must honor the key. Adding a header does nothing if the downstream service ignores it.

### Who should retry?

Give one layer primary retry ownership. If Apex retries three times, middleware retries three times, and the remote SDK retries three times, one outage can create many attempts and hide where recovery belongs.

Document:

- which status codes and exceptions are transient;
- maximum attempts and backoff;
- whether the remote API supplies a retry delay;
- the maximum age of a request;
- concurrency limits;
- who can replay failed work;
- how the operator proves that replay will reuse the original key.

## Build a failure and retry matrix
{: #failure-matrix}

Do not treat every non-2xx response the same. Agree on a matrix with the remote owner.

| Result | Typical interpretation | Normal action |
|---|---|---|
| Connection failure before response | Outcome unknown | Retry only with the same idempotency key or check status first |
| Timeout | Outcome unknown | Same as connection failure; never assume “not processed” |
| `400` validation error | Permanent request defect | Stop, expose a safe reason, correct data under the contract |
| `401` or `403` | Credential or authorization failure | Stop normal retries, alert the credential owner |
| Conflict for same key/different payload | Contract violation | Stop and investigate; do not invent a new key automatically |
| `429` throttling | Usually transient | Respect the agreed retry delay and bound attempts |
| `500`, `502`, or `503` | Potentially transient | Retry with backoff and the same key when the contract permits |
| `2xx` with business rejection | Completed business decision | Store and return the stable rejection; do not transport-retry it |

HTTP codes alone are not enough. Some services use `200` with an application error; others use `409` to return an existing resource. The integration contract must define the meaning, and tests must enforce it.

### A retry cannot repair every failure

Retries help transient failures. They do not fix:

- invalid data;
- revoked access;
- an incompatible schema;
- a reused idempotency key with changed intent;
- automation that already performed an irreversible external side effect;
- two systems disagreeing about which one owns a field.

Route those failures to an owner with evidence. An infinite retry loop is an outage amplifier, not a recovery design.

## Verification, monitoring, and reconciliation
{: #verification}

Idempotency is a behavioral promise. Prove it with tests and production evidence.

### Minimum test scenarios

1. First request creates one business record and one ledger result.
2. Same key and same payload returns the original result without a second business side effect.
3. Same key and different payload is rejected.
4. Two concurrent requests with the same key produce one business result.
5. The response is lost after commit; a retry returns the committed result.
6. A retryable failure preserves the ledger state and reuses the key.
7. A permanent validation failure does not enter an automatic retry loop.
8. An unauthorized integration user cannot read or change data outside the contract.
9. A manual replay uses the original key and records the operator and reason.
10. Ledger retention and cleanup do not allow a still-valid business command to run again.

Unit tests can cover the service decisions. A concurrency or duplicate-delivery test should also run in an integration environment because database locking, middleware retries, proxy timeouts, and remote behavior cross process boundaries.

### Metrics that reveal the real health

Track at least:

- new commands versus duplicate replays;
- conflicts caused by key reuse with a different payload;
- success, retryable failure, permanent rejection, and exhausted retry counts;
- request latency and queue age;
- attempt count per logical command;
- oldest unresolved command;
- business records created per unique business identifier;
- reconciliation mismatches between Salesforce and the remote system.

A sudden increase in duplicate replays can expose an upstream timeout or client defect before users report duplicate records. Zero duplicates in Salesforce does not prove success if fulfillment never received the order, so reconciliation remains necessary.

### A useful reconciliation job

For each command older than the normal processing window:

1. Compare the Salesforce ledger status with the business record.
2. Query the downstream system by the same business or idempotency identifier.
3. Classify the record as consistent, missing downstream, missing in Salesforce, conflicting, or still processing.
4. Repair through an approved, idempotent action.
5. Record the decision and alert an owner for unresolved conflicts.

Operational teams need this runbook before production, not after the first duplicate payment.

## A strong interview answer
{: #interview-answer}

If an interviewer asks, “A Salesforce call timed out. Would you retry it?”, a strong answer is:

> A timeout creates an unknown outcome; it does not prove the first write failed. I would retry a read safely, but I would not blindly repeat a non-idempotent write. The caller should persist one idempotency key for the logical command and reuse it on every attempt. The receiver should enforce that key with a unique database constraint, bind it to a normalized request fingerprint, and return the stored result for a duplicate. For entity synchronization, I would use a unique External ID and upsert, but commands such as charge or refund may also need a command ledger because updating the same entity can still repeat side effects. Retries must be bounded and classified, and I would verify the design with duplicate-delivery, concurrent-request, lost-response, authorization, and reconciliation tests.

That answer identifies the ambiguity, the database race, the difference between entity identity and command identity, operational ownership, and verification. It is much stronger than “use Queueable Apex” or “increase the timeout.”

If you need help reviewing an integration retry design or duplicate-record incident, [contact SFX Support](/contact/), email **founders@sfxsupport.com**, or message us on WhatsApp at **+91-9414849173**.

## Sources

- [Integration Patterns — Salesforce Architects](https://architect.salesforce.com/docs/architect/fundamentals/guide/integration-patterns)
- [Insert or Update a Record Using an External ID — REST API Developer Guide](https://developer.salesforce.com/docs/platform/api-rest/guide/dome-upsert.html)
- [Upsert Core Call — SOAP API Developer Guide](https://developer.salesforce.com/docs/platform/api/guide/sforce-api-calls-upsert.html)
- [Writing Apex REST Services (and When Not To) — Salesforce Developers](https://developer.salesforce.com/blogs/2022/08/writing-apex-rest-services-and-when-not-to)
- [Protect Your Application from CRUD/FLS Vulnerabilities — Salesforce Secure Coding Guide](https://developer.salesforce.com/docs/platform/secure-coding/guide/secure-coding-access-control-protect-from-crud-fls-vulnerabilities.html)
- [Named Credentials Reference — Salesforce Developers](https://developer.salesforce.com/docs/platform/named-credentials/references/named-credentials-reference)
- [Storing Sensitive Data — Salesforce Secure Coding Guide](https://developer.salesforce.com/docs/platform/secure-coding/guide/secure-coding-storing-sensitive-data.html)
- [Status Codes and Error Responses — REST API Developer Guide](https://developer.salesforce.com/docs/platform/api-rest/guide/errorcodes.html)
