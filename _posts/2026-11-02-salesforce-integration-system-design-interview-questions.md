---
layout: blog-post
sfx_blog: true
featured: false
title: "20 Salesforce Integration and System Design Interview Questions"
seo_title: "Salesforce Integration System Design Interview Questions"
description: "Prepare for senior Salesforce integration interviews with 20 system-design questions on APIs, events, scale, security, reliability, observability, and cutover."
date: 2026-11-02 08:00:00 +0530
last_modified_at: 2026-11-02 08:00:00 +0530
permalink: /blog/salesforce-integration-system-design-interview-questions/
primary_category: "Integration"
series: "Salesforce Interview Questions"
categories:
  - interview-prep
  - integration
  - architecture
tags:
  - Salesforce Integration Interview Questions
  - Salesforce System Design
  - Integration Architecture
  - Platform Events
  - Change Data Capture
  - Bulk API 2.0
  - Pub/Sub API
  - Named Credentials
  - Salesforce Architect Interview
reading_time: "22 min read"
og_type: article
extra_css:
  - /assets/css/blog.css
toc:
  - id: interview-framework
    label: "System-design framework"
  - id: requirements-boundaries
    label: "Requirements and boundaries"
  - id: data-api-design
    label: "Data and API design"
  - id: reliability-messaging
    label: "Reliability and messaging"
  - id: security-governance
    label: "Security and governance"
  - id: operations-delivery
    label: "Operations and delivery"
  - id: design-exercise
    label: "Complete design exercise"
  - id: revision-checklist
    label: "Revision checklist"
  - id: sources
    label: "Official sources"
---

The interviewer gives you a whiteboard and says:

> “Design an integration between Salesforce and an ERP. Sales users submit orders in Salesforce. The ERP validates inventory, creates the official order, and returns fulfillment status. The business expects near-real-time updates and cannot tolerate duplicate orders.”

A weak answer starts drawing REST arrows immediately. A senior answer first asks who owns the order, which response the user needs synchronously, the peak transaction rate, what a timeout means, how duplicates are prevented, how systems recover after an outage, which identity can access the data, and how support traces one order across the entire path.

These 20 Salesforce integration and system-design interview questions focus on those decisions. Each question is expandable, so you can attempt your own design before reading the strong answer.

This guide assumes you already know the basic integration vocabulary. If you need that foundation, begin with [15 Salesforce Integration interview questions and answers](/blog/salesforce-integration-interview-questions/) and the SFX [Integration Patterns learning guide](/integration-patterns/).

## Use this system-design answer framework
{: #interview-framework}

Before naming a Salesforce feature, structure your answer in eight layers:

1. **Business outcome:** What must the user or downstream process accomplish?
2. **Nonfunctional requirements:** What are the peak volume, latency, availability, recovery-time, recovery-point, retention, compliance, and cost targets?
3. **Ownership:** Which system owns each entity and field? Which IDs are stable across systems?
4. **Interaction pattern:** Is the step request–reply, fire-and-forget, batch synchronization, event-driven change propagation, or virtualization?
5. **Failure semantics:** What happens after a timeout, duplicate delivery, partial success, out-of-order event, consumer outage, or poison message?
6. **Security boundary:** Which identity runs the operation, where are credentials stored, and what object, field, record, and API access does it have?
7. **Operations:** How do teams trace, alert, retry, reconcile, replay, and prove business completion?
8. **Evolution:** How will the contract be versioned, tested, deployed, migrated, and retired without breaking consumers?

A clean interview diagram can follow this shape:

```text
User / Source
    -> ingress validation and authentication
    -> durable command or request
    -> business processing
    -> idempotent destination update
    -> status/event response
    -> monitoring + reconciliation + recovery queue
```

Do not treat the diagram as the answer. Label every boundary with the protocol, owner, data contract, timeout, retry owner, and failure destination.

## Requirements and architecture boundaries
{: #requirements-boundaries}

<div class="interview-accordion-list">

<details class="interview-accordion" id="question-1">
<summary><span class="interview-question-number">01</span><span class="interview-question-text">What do you ask before drawing a Salesforce integration architecture?</span></summary>
<div class="interview-accordion-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I ask for the business action, actors, systems, source of truth, data classification, and measurable nonfunctional requirements. “Real time” becomes a latency target such as “95% of accepted orders reach the ERP within 60 seconds.” “High volume” becomes an average, peak, burst shape, payload size, and growth forecast.

I clarify whether the caller needs a business result or only acknowledgement, whether records must be processed in order, whether partial success is acceptable, and what happens when either system is unavailable. I ask for recovery-time and recovery-point objectives, retention, audit, data-residency, and maintenance-window constraints.

Finally, I identify ownership and support boundaries: who owns the API contract, credentials, middleware, Salesforce automation, downstream service, alerts, dead-letter queue, reconciliation job, and incident response. Without those answers, a technology diagram is only a guess.
</div>
</details>

<details class="interview-accordion" id="question-2">
<summary><span class="interview-question-number">02</span><span class="interview-question-text">How do you decide the system of record and field-level ownership?</span></summary>
<div class="interview-accordion-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I define ownership per business attribute, not merely per object. Salesforce may own sales-entered delivery instructions while the ERP owns order number, credit status, allocation, and fulfillment state. A written ownership matrix states which system may create, update, correct, and publish each field.

I assign stable cross-system identifiers and store the authoritative external ID in Salesforce. Consumers use that ID for upsert and correlation rather than matching on names or mutable business values. Where a field can change in both systems, I require a conflict policy: source priority, version comparison, explicit merge, or human review.

This prevents sync loops and silent overwrites. “Last write wins” is not a default design; it is a business decision with data-loss consequences. I also define how deletes, merges, reparenting, and identity corrections propagate.
</div>
</details>

<details class="interview-accordion" id="question-3">
<summary><span class="interview-question-number">03</span><span class="interview-question-text">How do you turn traffic estimates into an integration capacity model?</span></summary>
<div class="interview-accordion-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I model average and peak requests per second, burst duration, daily records, payload size, fan-out, API calls per business transaction, event deliveries per consumer, and retry amplification. Ten thousand orders do not equal ten thousand API calls if every order requires five lookups and three writes.

Then I map the workload to current org allocations and transactional limits: API request allocation, concurrent processing, event publishing and delivery, Bulk API jobs, Apex callouts, CPU, heap, SOQL, DML, and downstream quotas. I read the org's `/limits` resource and product-specific documentation rather than copying limits from an old diagram.

I reserve operating headroom, define rate limits at ingress, and test the burst—not only the daily average. If the consumer can process 50 messages per second while the producer can emit 500, the design needs buffering, flow control, backlog alerts, and a time-to-drain calculation.
</div>
</details>

<details class="interview-accordion" id="question-4">
<summary><span class="interview-question-number">04</span><span class="interview-question-text">When should a design be synchronous, asynchronous, or hybrid?</span></summary>
<div class="interview-accordion-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I use synchronous request–reply only when the caller cannot continue without an immediate result and the dependency can meet the latency and availability target. I use asynchronous messaging when work can complete later, traffic is bursty, systems must be decoupled, or durable retry and replay are more important than immediate completion.

Many real designs are hybrid. An order submission can synchronously validate required input and return an accepted command ID, then asynchronously create the ERP order. Salesforce shows a processing state and receives a later fulfillment update. The user does not wait for the ERP, but the business still gets a traceable result.

I explain the trade-off: synchronous design is simple for the caller but couples availability and latency. Async improves resilience and buffering but introduces eventual consistency, duplicate delivery, ordering decisions, separate failure monitoring, and a status experience.
</div>
</details>

<details class="interview-accordion" id="question-5">
<summary><span class="interview-question-number">05</span><span class="interview-question-text">When do you use middleware instead of a direct Salesforce connection?</span></summary>
<div class="interview-accordion-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I use a direct connection for a bounded integration between two systems when the contract, transformation, retry behavior, security, and operations remain simple. I introduce middleware when several systems need routing, orchestration, canonical transformation, protocol mediation, centralized throttling, durable queues, shared policy enforcement, or enterprise observability.

The decision is about responsibility, not fashion. Middleware can reduce point-to-point coupling but becomes another production platform with its own availability, capacity, security, deployment, and support costs. I do not move business ownership into a generic integration layer merely to keep Salesforce code small.

I draw the failure domains. If middleware is unavailable, can Salesforce accept commands durably? If the ERP is unavailable, where does the backlog live? Which team replays it, and how is the replay made idempotent?
</div>
</details>

</div>

## Data movement and API design
{: #data-api-design}

<div class="interview-accordion-list">

<details class="interview-accordion" id="question-6">
<summary><span class="interview-question-number">06</span><span class="interview-question-text">How do you select the Salesforce API for a workload?</span></summary>
<div class="interview-accordion-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I start with the interaction shape. REST resources fit ordinary record operations and queries. Composite resources reduce round trips for a small related request and can pass one subrequest's result into another. Composite Graph fits more complex groups of dependent record operations with atomic behavior inside each graph. Bulk API 2.0 fits large asynchronous ingest, upsert, delete, and query workloads. Pub/Sub API fits event publishing and subscription for Platform Events and Change Data Capture.

I do not choose an API by record count alone. I evaluate latency, transactionality, dependency between records, partial-failure needs, payload size, query selectivity, client capability, retry behavior, and operational ownership.

The interview answer should name the rejected alternatives. For example, Bulk API 2.0 is strong for a large nightly upsert but adds job lifecycle and result-file handling that is unnecessary for a user waiting on one record.
</div>
</details>

<details class="interview-accordion" id="question-7">
<summary><span class="interview-question-number">07</span><span class="interview-question-text">How would you design an initial migration followed by continuous synchronization?</span></summary>
<div class="interview-accordion-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I separate the initial load from the delta stream but connect them with a controlled watermark. First I clean and map source data, provision unique external IDs, load parents before dependent children, and use Bulk API 2.0 upsert for large datasets. I retain successful, failed, and unprocessed results and reconcile counts and business totals.

Before the load begins, I capture a source-system change watermark or start a durable change feed. After the baseline is accepted, I apply changes that occurred after that watermark in deterministic order. Then I switch to normal continuous processing.

The cutover plan defines freeze or dual-write behavior, validation queries, ownership transfer, rollback criteria, and how to replay the delta without duplicates. I test with production-shaped data, skewed parents, automation enabled, and the same integration identity used in production.
</div>
</details>

<details class="interview-accordion" id="question-8">
<summary><span class="interview-question-number">08</span><span class="interview-question-text">An external system must create an Account, Contacts, and Opportunity together. How do you handle atomicity?</span></summary>
<div class="interview-accordion-answer" markdown="1">
<span class="answer-label">Strong answer</span>

First I confirm whether the business truly requires all records to commit or none. If standard record APIs satisfy the validation and security requirements, Composite or Composite Graph can express dependencies and atomic groups without a custom endpoint. Reference IDs connect child operations to records created earlier in the request.

If the transaction requires domain logic that standard resources cannot express safely, I consider a narrow Apex REST service with a versioned contract. It validates the complete request, applies explicit user or system access decisions, performs bulk-safe work, returns stable business error codes, and never exposes internal exceptions.

I keep the atomic boundary small. A graph containing hundreds of unrelated customers creates a large blast radius when one fails. Independent business aggregates should be independent graphs or requests so failure isolation and replay remain manageable.
</div>
</details>

<details class="interview-accordion" id="question-9">
<summary><span class="interview-question-number">09</span><span class="interview-question-text">When should external data be copied into Salesforce versus virtualized?</span></summary>
<div class="interview-accordion-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I copy data when Salesforce automation, reporting, search, offline access, sharing, low-latency reads, or historical analysis requires a local record. I consider virtualization when the external system must remain authoritative, the dataset is large or changes rapidly, users need only occasional real-time access, and the supported external-data capability meets query and security needs.

Copying creates synchronization, storage, deletion, reconciliation, and data-residency obligations. Virtualization couples the user experience to remote availability and latency and may limit Salesforce features available on the data.

I often use a hybrid: store the minimal customer or order summary needed for Salesforce workflows, keep detailed transactions in the source, and retrieve detail on demand. The design documents freshness and what users may do when the source is unavailable.
</div>
</details>

</div>

## Reliability, events, and recovery
{: #reliability-messaging}

<div class="interview-accordion-list">

<details class="interview-accordion" id="question-10">
<summary><span class="interview-question-number">10</span><span class="interview-question-text">Platform Events or Change Data Capture: which contract do you choose?</span></summary>
<div class="interview-accordion-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I use Change Data Capture when consumers need to know that Salesforce records changed. I use a custom Platform Event when Salesforce must publish an explicit business fact or command such as `Order_Submitted__e` with a deliberate payload and lifecycle.

CDC communicates data change, not necessarily business intent. An Opportunity update can occur for many reasons; a fulfillment request should be explicit. A custom event also gives the team control over its semantic contract, while CDC naturally follows enabled object changes.

I define publish timing. For a business event that must describe committed Salesforce data, I use an after-commit publication model so consumers do not act on a transaction that later rolls back. I also define retention-gap recovery because event replay is finite.
</div>
</details>

<details class="interview-accordion" id="question-11">
<summary><span class="interview-question-number">11</span><span class="interview-question-text">Can you guarantee exactly-once processing across Salesforce and another system?</span></summary>
<div class="interview-accordion-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I do not promise distributed exactly-once side effects from delivery alone. Networks time out, acknowledgements are lost, and brokers or clients can redeliver. I design for at-least-once delivery with an idempotent receiver.

Every logical command carries a stable idempotency key that remains the same across retries. The receiver stores that key and its result in a durable uniqueness boundary. If the command returns, the receiver returns the original result instead of repeating payment, order creation, or inventory reservation.

For record synchronization, a unique external ID plus upsert is often the right foundation. For business commands, I also persist command state because two different commands can target the same record legitimately. I explain where the deduplication record is stored, how long it lives, and how concurrent duplicate requests are serialized.
</div>
</details>

<details class="interview-accordion" id="question-12">
<summary><span class="interview-question-number">12</span><span class="interview-question-text">How do you handle ordering and concurrent updates?</span></summary>
<div class="interview-accordion-answer" markdown="1">
<span class="answer-label">Strong answer</span>

First I ask whether global order is required or only order per business aggregate such as one Order. Global serialization destroys throughput and is rarely necessary. For per-order ordering, the contract includes aggregate ID and source version or sequence.

The receiver rejects, defers, or reconciles stale versions rather than letting a late `Shipped` event be overwritten by an earlier `Packed` event. Updates are made idempotent, and optimistic concurrency or a version check protects a newer state from an older write.

I also design for Salesforce locking. Events for the same Account can cause concurrent child processing and row locks even if event delivery order is correct. Partitioning, consistent parent-lock order, smaller transactions, bounded retry, and per-aggregate serialization can reduce contention.
</div>
</details>

<details class="interview-accordion" id="question-13">
<summary><span class="interview-question-number">13</span><span class="interview-question-text">How does the architecture survive a consumer slowdown or outage?</span></summary>
<div class="interview-accordion-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I put a durable boundary between producer and consumer so the Salesforce transaction does not wait for a slow destination. The consumer uses Pub/Sub API flow control or the middleware equivalent to request only the events it can process. It scales within downstream quotas rather than pulling an unlimited backlog and failing repeatedly.

I monitor backlog age, not only queue length. A thousand messages can be healthy at high throughput or a severe breach at low throughput. Alerts include oldest-message age, processing rate, retry rate, poison messages, and estimated time to drain.

Recovery uses bounded retries with backoff and jitter for transient failures. Permanent validation or authorization failures go to a durable failed state with an owner and safe replay action. Circuit breaking prevents a failing dependency from turning every message into an immediate retry storm.
</div>
</details>

<details class="interview-accordion" id="question-14">
<summary><span class="interview-question-number">14</span><span class="interview-question-text">Replay IDs are available. Why do you still need reconciliation?</span></summary>
<div class="interview-accordion-answer" markdown="1">
<span class="answer-label">Strong answer</span>

Replay handles an interruption while events remain in the retention window. It does not prove that a subscriber applied every business change correctly, and it cannot recover a gap older than retention. Replay IDs are opaque positions; they are not business identifiers or permanent audit keys.

The subscriber stores progress only after durable processing succeeds. It also deduplicates using an event or business ID because replay can deliver an event again.

Reconciliation compares authoritative business state across systems: missing orders, mismatched totals, stale statuses, or commands marked sent without a downstream result. It runs on a schedule and on demand after incidents, produces an explainable variance report, and repairs through the same idempotent path used by normal processing.
</div>
</details>

<details class="interview-accordion" id="question-15">
<summary><span class="interview-question-number">15</span><span class="interview-question-text">What should a production event contract contain?</span></summary>
<div class="interview-accordion-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I keep the contract explicit, minimal, and safe. A useful envelope includes stable event ID, event type, schema version, source, occurred-at time, correlation ID, aggregate ID, and an aggregate version when ordering matters.

```json
{
  "eventId": "8cc4b3e2-8dd2-4ab1-9cb1-8abeb7e75f10",
  "eventType": "OrderSubmitted",
  "schemaVersion": 1,
  "source": "salesforce",
  "occurredAt": "2026-11-02T08:00:00Z",
  "correlationId": "order-2026-000184",
  "aggregateId": "order-2026-000184",
  "aggregateVersion": 7,
  "payload": {
    "currency": "INR",
    "total": 12500.00
  }
}
```

The example values are synthetic. I exclude secrets and unnecessary personal data, document required versus optional fields, define null and enum behavior, and decide whether consumers receive a state snapshot or must query for detail. A large event carrying an entire record graph increases coupling and data-exposure risk.
</div>
</details>

</div>

## Security and integration governance
{: #security-governance}

<div class="interview-accordion-list">

<details class="interview-accordion" id="question-16">
<summary><span class="interview-question-number">16</span><span class="interview-question-text">How do you design authentication and identity for system-to-system access?</span></summary>
<div class="interview-accordion-answer" markdown="1">
<span class="answer-label">Strong answer</span>

For inbound system-to-system access, I give each integration its own API-only Salesforce identity and client application. That creates independent permissions, audit history, rotation, revocation, and blast radius. I never use a human administrator's account as a shared integration identity.

I choose an OAuth flow supported by the client and trust model. OAuth client credentials can fit a confidential headless service that always runs as one configured integration user. Other scenarios may require a different OAuth flow or certificate-based approach. I document token lifetime, rotation, allowlisting, network controls, and emergency revocation.

The identity receives only the object, field, record, Apex class, and API permissions required by the contract. API-only access limits UI use; it does not automatically make broad data permissions safe.
</div>
</details>

<details class="interview-accordion" id="question-17">
<summary><span class="interview-question-number">17</span><span class="interview-question-text">How do you secure outbound Salesforce callouts and inbound custom APIs?</span></summary>
<div class="interview-accordion-answer" markdown="1">
<span class="answer-label">Strong answer</span>

For outbound callouts I use the current Named Credential and External Credential model. The Named Credential defines the endpoint and transport, while the External Credential defines authentication and principals. Sensitive material is provisioned per environment and never stored in Apex, Custom Metadata, source control, logs, or the payload.

For inbound custom APIs I authenticate the caller, authorize the exact operation, validate schema and size, use allowlisted fields, bind query inputs, apply bulk limits, and return stable errors without stack traces. I explicitly choose user-mode or controlled system-mode data operations and enforce record, object, and field access according to the service contract.

I also protect availability: request-size limits, rate limits, timeouts, idempotency, and abuse monitoring are part of security. A correctly authenticated client can still overload or misuse an endpoint.
</div>
</details>

</div>

## Operations, testing, and delivery
{: #operations-delivery}

<div class="interview-accordion-list">

<details class="interview-accordion" id="question-18">
<summary><span class="interview-question-number">18</span><span class="interview-question-text">How do you version an integration contract without breaking consumers?</span></summary>
<div class="interview-accordion-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I distinguish compatible and breaking change. Adding an optional field is usually compatible when consumers ignore unknown fields. Renaming or removing a field, changing meaning, tightening validation, or changing enum behavior can be breaking.

Contracts are stored in source control with examples, schemas, ownership, compatibility rules, and a changelog. Consumer contract tests run in CI. A breaking change gets a new endpoint, event type, or schema version, and the old and new versions coexist through a measured migration window.

I inventory consumers and require usage telemetry before retirement. A calendar date alone is not proof that all consumers migrated. The deprecation plan defines communication, test environments, traffic comparison, rollback, and final disablement.
</div>
</details>

<details class="interview-accordion" id="question-19">
<summary><span class="interview-question-number">19</span><span class="interview-question-text">What observability and testing prove the design is production-ready?</span></summary>
<div class="interview-accordion-answer" markdown="1">
<span class="answer-label">Strong answer</span>

Every business operation carries a correlation ID across Salesforce, middleware, and the destination. Structured logs record component, operation, version, sanitized business key, attempt, duration, outcome, and error category. Metrics cover throughput, success rate, latency percentiles, queue age, retries, dead letters, API and event allocation use, and reconciliation variance.

Testing includes contract, mapping, security, bulk, performance, concurrency, idempotency, ordering, timeout, duplicate delivery, malformed payload, token failure, downstream throttling, consumer outage, replay, retention-gap reconciliation, and disaster recovery. I test with production-shaped data and the real execution identities.

Go-live evidence includes agreed service-level indicators, alert thresholds, dashboards, on-call ownership, runbooks, safe replay, data repair, cutover rehearsal, and rollback. An HTTP 200 test proves connectivity, not system reliability.
</div>
</details>

</div>

## Complete design exercise: Salesforce to ERP order fulfillment
{: #design-exercise}

<div class="interview-accordion-list">

<details class="interview-accordion" id="question-20" open>
<summary><span class="interview-question-number">20</span><span class="interview-question-text">Design a resilient Salesforce-to-ERP order integration end to end.</span></summary>
<div class="interview-accordion-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I begin with assumptions: Salesforce owns the sales submission; the ERP owns the official order number, inventory allocation, and fulfillment status; users need immediate validation but can tolerate asynchronous creation; peak volume and recovery targets are measured; duplicate ERP orders are unacceptable.

### Proposed flow

1. A user submits an Order through Salesforce. Validation confirms required data, permissions, product eligibility, and a stable customer/ERP key.
2. Salesforce creates an immutable command ID and changes the Order to `Submission Pending` in the same transaction.
3. After commit, Salesforce publishes an `OrderSubmitted` business event containing the command ID, Salesforce Order ID, version, correlation ID, and the minimal approved payload—or middleware retrieves detail using the ID.
4. Middleware consumes with flow control, validates the schema, enriches or transforms the command, and calls the ERP with the same command ID as its idempotency key.
5. The ERP stores that key in a unique boundary. A duplicate command returns the original ERP order result without creating another order.
6. Middleware publishes or calls back a versioned result. Salesforce upserts the status using the command ID and ERP external ID, rejects stale status versions, and records the latest processing state.
7. Transient failures receive bounded backoff. Permanent validation failures enter a durable recovery queue with sanitized context, ownership, and a replay action that preserves the command ID.
8. A reconciliation job compares Salesforce submitted orders with ERP accepted orders and fulfillment states. It repairs missing results through the same idempotent path.

```text
Salesforce Order
  -> after-commit OrderSubmitted event
  -> middleware durable consumer + transformation
  -> ERP idempotent order API
  -> versioned status result
  -> Salesforce status upsert

Cross-cutting: OAuth identities, least privilege, correlation IDs,
metrics, dead-letter handling, replay, reconciliation, and runbooks
```

### Design trade-offs

The asynchronous boundary prevents ERP latency from blocking Salesforce and absorbs traffic spikes, but users see a processing state rather than an immediate ERP number. If the business truly requires an instant inventory quote, I separate that read-only synchronous check from the idempotent asynchronous order command.

I avoid dual ownership. Salesforce may cancel a pending request, but once the ERP accepts the order, cancellation becomes a new ERP command rather than a direct Salesforce status overwrite. Contract versions allow both systems to deploy independently.

### Verification

I test a normal order, duplicate submission, timeout after ERP acceptance, out-of-order status, stale update, token expiry, schema incompatibility, ERP outage, backlog recovery, replay, and reconciliation after the event-retention window. I load-test the measured peak plus retry amplification and verify that no test produces two ERP orders for one command ID.
</div>
</details>

</div>

## Senior interview revision checklist
{: #revision-checklist}

Before finishing any Salesforce system-design answer, confirm that you covered:

- [ ] measurable volume, latency, availability, and recovery targets;
- [ ] object and field ownership plus stable cross-system identifiers;
- [ ] synchronous, asynchronous, batch, event, or virtualization rationale;
- [ ] API choice and rejected alternatives;
- [ ] transaction and atomicity boundary;
- [ ] idempotency, duplicate delivery, ordering, and concurrency;
- [ ] retries, backoff, dead-letter ownership, and safe replay;
- [ ] event-retention gaps and scheduled reconciliation;
- [ ] dedicated identities, least privilege, and credential management;
- [ ] contract versioning and consumer migration;
- [ ] correlation IDs, metrics, alerts, and business completion monitoring;
- [ ] bulk, performance, security, failure, cutover, and rollback testing.

Need help preparing for a Salesforce integration architect interview? Contact SFX Support at [founders@sfxsupport.com](mailto:founders@sfxsupport.com), call [+91-9414849173](tel:+919414849173), or [message us on WhatsApp](https://wa.me/919414849173).

## Official Salesforce sources
{: #sources}

- [Salesforce Integration Patterns](https://architect.salesforce.com/docs/architect/fundamentals/guide/integration-patterns)
- [Data Integration Decision Guide](https://architect.salesforce.com/docs/architect/decision-guides/guide/data-integration)
- [Bulk API 2.0](https://developer.salesforce.com/docs/platform/api-asynch/guide/bulk-api-2-0.html)
- [Using Composite Graphs](https://developer.salesforce.com/docs/platform/api-rest/guide/resources-composite-graph-introduction.html)
- [Upsert Records by External ID](https://developer.salesforce.com/docs/platform/api-rest/guide/resources-sobject-upsert-patch.html)
- [Pub/Sub API Pull Subscription and Flow Control](https://developer.salesforce.com/docs/platform/pub-sub-api/guide/flow-control.html)
- [Event Message Durability and Replay IDs](https://developer.salesforce.com/docs/platform/pub-sub-api/guide/event-message-durability.html)
- [Named and External Credentials](https://developer.salesforce.com/docs/platform/named-credentials/guide/get-started.html)
- [Give Integration Users API-Only Access](https://help.salesforce.com/s/articleView?id=sf.integration_user.htm&language=en_US&type=5)
- [Protect Apex from CRUD and FLS Vulnerabilities](https://developer.salesforce.com/docs/platform/secure-coding/guide/secure-coding-access-control-protect-from-crud-fls-vulnerabilities.html)
- [Observability and Monitoring Patterns](https://architect.salesforce.com/docs/architect/well-architected/guide/operational-excellence-observability-patterns.html)
