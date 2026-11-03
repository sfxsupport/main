---
layout: blog-post
sfx_blog: true
featured: false
title: "Salesforce Too Many SOQL Queries 101: Production Diagnosis and Fix"
seo_title: "Salesforce Too Many SOQL Queries 101: Fix Guide"
description: "Diagnose Salesforce Too many SOQL queries: 101 using debug logs, transaction maps, bulk-safe Apex and Flow fixes, regression tests, and monitoring."
date: 2026-11-01 08:00:00 +0530
last_modified_at: 2026-11-01 08:00:00 +0530
permalink: /blog/salesforce-too-many-soql-queries-101/
primary_category: "Problem Solving"
series: "Real-World Salesforce Problem Solving"
categories:
  - problem-solving
  - apex
  - flow
tags:
  - Salesforce Too Many SOQL Queries 101
  - Salesforce Governor Limits
  - Apex Debug Logs
  - Apex Bulkification
  - Record-Triggered Flow
  - Salesforce Order of Execution
  - Salesforce Production Support
reading_time: "19 min read"
og_type: article
extra_css:
  - /assets/css/blog.css
toc:
  - id: contain-incident
    label: "Contain the incident"
  - id: limit-means
    label: "What query 101 means"
  - id: capture-log
    label: "Capture useful evidence"
  - id: transaction-map
    label: "Build the transaction map"
  - id: attribute-queries
    label: "Attribute every query"
  - id: apex-refactor
    label: "Bulk-safe Apex refactor"
  - id: flow-investigation
    label: "Investigate Flow"
  - id: false-fixes
    label: "Avoid false fixes"
  - id: verification
    label: "Verify the correction"
  - id: prevention
    label: "Prevent recurrence"
  - id: runbook
    label: "Incident runbook"
  - id: sources
    label: "Official sources"
---

At 10:15 on Monday morning, sales users start seeing this error when they close Opportunities:

```text
System.LimitException: Too many SOQL queries: 101
```

The latest stack frame points to an Opportunity trigger, so the first response is to open that class and search for a query inside a loop. No obvious loop exists. A developer adds a `try/catch`, the data team reduces its batch size, and individual UI saves begin working again—but the next bulk update fails.

This is a common production trap. The query that crosses the limit is not necessarily the component that consumed most of the budget. A before-save Flow, several Apex handlers, an invocable action, an Account update, a roll-up recalculation, and an after-save Flow can all participate in one transaction. Their queries accumulate until the 101st synchronous query raises an uncatchable governor-limit exception.

The right fix begins with evidence: reproduce the failing entry point and data shape, capture the full transaction, assign query usage to each automation, identify why usage scales, and refactor the source without breaking legitimate behavior.

For interview-level trigger design, read [Salesforce Apex Trigger interview questions for 6+ years of experience](/blog/salesforce-apex-trigger-interview-questions-6-years-experience/). This guide focuses on the incident response you can use in a real org.

## Contain the incident without hiding it
{: #contain-incident}

Before changing metadata, record the incident facts:

- the exact error text, timestamp, user, and entry point;
- the object, operation, and number of records in the request;
- whether the request came from Lightning, an API integration, Data Loader, Batch Apex, scheduled automation, or another job;
- representative record IDs and business conditions, stored only in an approved private ticket;
- the last known successful execution and recent deployments, Flow activations, package upgrades, group changes, or data-volume shifts;
- the operational impact: failed saves, incomplete jobs, missed integrations, or user downtime.

A governor-limit exception cannot be handled by application code. When it terminates a transaction, Salesforce rolls back its database work. Do not tell users to retry repeatedly: every retry can recreate the same load, flood logs, and trigger external effects that are not part of the database rollback.

If the incident is blocking business, a temporary containment can be appropriate. Examples include pausing the responsible integration, lowering an API batch size, disabling a newly deployed automation through an established bypass control, or rescheduling a noncritical job. Each containment needs an approver, scope, expiry, rollback plan, and reconciliation plan. It is not the permanent fix.

Avoid changing organization-wide automation blindly. Deactivating a Flow or trigger can allow saves while silently skipping compliance checks, related updates, notifications, or integration messages. First identify which behavior would be lost and how affected transactions will be repaired.

## Understand what query 101 actually means
{: #limit-means}

Salesforce governor limits protect the multitenant platform from a transaction monopolizing shared resources. The current Apex limits allow **100 SOQL queries in a synchronous transaction** and **200 in many asynchronous Apex transactions**. The platform raises `Too many SOQL queries: 101` when a synchronous transaction attempts the query after its budget is exhausted.

Important details change how you diagnose the failure:

- Limits are counted **per transaction**, not independently per trigger, Flow, class, or handler.
- Static SOQL and calls such as `Database.query`, `Database.countQuery`, and `Database.getQueryLocator` count toward the query limit.
- Parent-to-child relationship subqueries have additional aggregate-query accounting. Query rows are also limited separately, so reducing the number of statements can reveal a row-limit or heap problem if the replacement query is too broad.
- A certified managed package namespace can receive separate limits for many per-transaction resources, but native automation still shares its own transaction budget. Package boundaries are not a reason to ignore inefficient custom logic.
- Batch Apex receives a fresh set of per-transaction limits for each `execute` invocation. Scheduled Apex is an asynchronous feature, but Salesforce documents that scheduled Apex uses synchronous limits.
- A true post-commit asynchronous path starts a new transaction with a new budget. Moving work there also changes timing, rollback, monitoring, and user-visible consistency.

The number `101` tells you which boundary was crossed. It does not tell you which component is responsible. A handler using one query per invocation can still be the architectural cause if recursion invokes it 80 times. A Flow using five queries can be the tipping point when existing Apex already consumes 96. The unit of diagnosis is the whole transaction.

## Capture a useful debug log
{: #capture-log}

Create a trace flag for the user or execution identity that actually fails: the integration user, Automated Process, a scheduled job owner, or the affected business user. Reproduce one controlled transaction with the same entry point, record count, and meaningful data conditions.

Use targeted debug levels. Salesforce's current troubleshooting guidance recommends detailed Apex and Workflow logging for Apex and Flow incidents, while the debug-log reference explains which events appear at each level. Excessive logging can truncate the portion that contains the cause, so capture the smallest reproducible transaction and reduce unrelated categories when necessary.

Search the log for these events:

| Log event | What it tells you |
|---|---|
| `FATAL_ERROR` | The governor exception and final failure location |
| `SOQL_EXECUTE_BEGIN` / `SOQL_EXECUTE_END` | Each query source and returned rows |
| `CODE_UNIT_STARTED` / `CODE_UNIT_FINISHED` | Trigger, class, and other execution boundaries |
| `DML_BEGIN` | A database change that can start another save cycle |
| `CUMULATIVE_LIMIT_USAGE` | Transaction totals at a checkpoint |
| `LIMIT_USAGE_FOR_NS` | Limit usage attributed to a namespace |
| `FLOW_ELEMENT_LIMIT_USAGE` | Limit usage associated with a Flow element |
| `FLOW_INTERVIEW_FINISHED_LIMIT_USAGE` | Limits consumed by a completed Flow interview |

The last `SOQL_EXECUTE_BEGIN` is only where the budget ran out. Work backward and count the queries inside every code unit and Flow interview. Note where the count rises in proportion to records, loop iterations, child updates, or recursive saves.

If the log is truncated, do not guess from the surviving tail. Reduce the reproduction size until the log remains complete, narrow the debug categories, or isolate the suspected automation in a full-copy or representative sandbox. Then compare a small successful run with the smallest failing run. The growth curve often exposes the pattern: five fixed queries are different from one extra query for every input record.

For easier local inspection, download the log and use the SFX [Debug Log Analyzer](/debug-log-analyzer/) or search the text in your approved editor. Preserve the original log as incident evidence before annotating it.

## Build the whole transaction map
{: #transaction-map}

List every automation that can run from the initial DML operation. For a record save, Salesforce's order of execution currently includes:

1. before-save record-triggered Flows;
2. before Apex triggers;
3. validation and duplicate rules;
4. after Apex triggers;
5. assignment, auto-response, workflow, and other supported automation;
6. a second before/after trigger execution when a workflow field update changes the record;
7. after-save record-triggered Flows;
8. parent or grandparent updates caused by roll-ups and cross-object work;
9. criteria-based sharing evaluation;
10. commit and post-commit work, including asynchronous paths.

The exact path depends on the operation and configured features, so use the current Salesforce order-of-execution documentation rather than a memorized diagram. Record-triggered Flow ordering can be configured, but an ordering setting does not create a new query budget.

For every step, capture:

- entry criteria and whether unchanged records are unnecessarily processed;
- queries, DML, subflows, and invocable Apex actions;
- objects updated and the automation those updates invoke;
- recursion or re-entry controls;
- package namespace and execution context;
- whether work is in the current transaction or a genuine asynchronous transaction.

Draw the cascade, not just a list. A typical failure can look like this:

```text
Opportunity API update (200 records)
  -> before-save Flow
  -> Opportunity before/after trigger handlers
  -> update Account totals
       -> Account trigger
       -> Account after-save Flow
            -> update qualifying Opportunities
                 -> Opportunity automation runs again
```

Every arrow before the commit can share the same limit budget. A query-free trigger can still cause the failure by issuing DML that re-enters a query-heavy automation. This is why “no SOQL inside the trigger” is not enough.

## Attribute queries to their source and scaling pattern
{: #attribute-queries}

Create a simple query ledger from the log:

| Component | Invocations | Queries per invocation | Approximate total | Why it scales |
|---|---:|---:|---:|---|
| Opportunity before Flow | 1 bulk interview group | 2 | 2 | Fixed reference lookups |
| Opportunity handler | 1 | 4 | 4 | Bulk queries |
| Pricing helper | 50 | 1 | 50 | Called once per qualifying record |
| Account Flow | 40 | 1 | 40 | Re-entered by parent updates |
| Package namespace | 1 | 3 | 3 | Fixed |

The ledger turns a vague limit failure into two concrete questions:

1. Which component uses the largest share of the budget?
2. Which component's usage grows with volume or re-entry?

Temporary instrumentation can help when a large class hides the delta:

```apex
Integer queriesAtStart = Limits.getQueries();

PricingService.recalculate(opportunities);

System.debug(
    LoggingLevel.WARN,
    'PricingService SOQL delta=' +
    (Limits.getQueries() - queriesAtStart) +
    ', transaction total=' + Limits.getQueries() +
    '/' + Limits.getLimitQueries()
);
```

Use this to attribute consumption in a controlled environment or tightly scoped diagnostic release. It is observability, not a control mechanism. Do not skip required business logic when `Limits.getQueries()` reaches 99; that converts a visible failure into inconsistent data. Remove or lower noisy diagnostic logging after the incident.

Look beyond obvious Apex syntax. Common multipliers include:

- a helper method with SOQL called from a loop;
- a property getter that queries every time it is accessed;
- an invocable Apex method designed for one request instead of the full request list;
- repeated queries for the same configuration or parent IDs in different handlers;
- Flow **Get Records** inside a loop or a subflow called once per item;
- DML inside loops, causing downstream automation to run repeatedly;
- recursion controls that fail to recognize the same records on re-entry;
- automation that runs on every update without checking relevant field changes;
- one integration request per record instead of a bulk API request.

## Refactor Apex around collections, not records
{: #apex-refactor}

Suppose an after-insert Case handler maintains `Account.Open_Case_Count__c`. The unsafe implementation queries once for every Case:

```apex
public class CaseAccountRollupService {
    public static void updateCountsUnsafe(List<Case> newCases) {
        List<Account> updates = new List<Account>();

        for (Case caseRecord : newCases) {
            if (caseRecord.AccountId == null) {
                continue;
            }

            Integer openCount = [
                SELECT COUNT()
                FROM Case
                WHERE AccountId = :caseRecord.AccountId
                AND IsClosed = false
            ];

            updates.add(new Account(
                Id = caseRecord.AccountId,
                Open_Case_Count__c = openCount
            ));
        }

        update updates;
    }
}
```

With enough Cases, this pattern consumes one query per input record. It can also add duplicate Account IDs to the update list. The bulk-safe version collects distinct parent IDs, queries all counts once, and performs one update per Account:

```apex
public class CaseAccountRollupService {
    public static void updateCounts(List<Case> newCases) {
        Set<Id> accountIds = new Set<Id>();

        for (Case caseRecord : newCases) {
            if (caseRecord.AccountId != null) {
                accountIds.add(caseRecord.AccountId);
            }
        }

        if (accountIds.isEmpty()) {
            return;
        }

        Map<Id, Integer> openCountsByAccount = new Map<Id, Integer>();

        for (AggregateResult result : [
            SELECT AccountId accountId, COUNT(Id) openCount
            FROM Case
            WHERE AccountId IN :accountIds
            AND IsClosed = false
            GROUP BY AccountId
        ]) {
            openCountsByAccount.put(
                (Id) result.get('accountId'),
                (Integer) result.get('openCount')
            );
        }

        List<Account> updates = new List<Account>();
        for (Id accountId : accountIds) {
            updates.add(new Account(
                Id = accountId,
                Open_Case_Count__c = openCountsByAccount.containsKey(accountId)
                    ? openCountsByAccount.get(accountId)
                    : 0
            ));
        }

        update updates;
    }
}
```

This demonstrates the reusable pattern:

1. collect distinct keys from the entire input collection;
2. return early when there is no work;
3. query all required data outside loops;
4. organize results in maps for constant-time lookup;
5. calculate in memory;
6. issue collection DML once;
7. let the caller pass all trigger records, not one record at a time.

The trade-off is not simply “one query is always better.” A consolidated query must select only required fields, remain selective at production volume, respect the 50,000-row transaction limit, and avoid excessive heap. If the business operation genuinely spans more data than one transaction can safely process, partition it with an appropriate Batch, Queueable, event, or scheduled pattern and design for eventual consistency and recovery.

## Investigate Flow as part of the same budget
{: #flow-investigation}

Flow is not exempt from transaction limits. Use `FLOW_ELEMENT_LIMIT_USAGE`, `FLOW_BULK_ELEMENT_LIMIT_USAGE`, and `FLOW_INTERVIEW_FINISHED_LIMIT_USAGE` to identify the elements that add queries, rows, DML, or CPU.

Inspect these patterns:

- **Get Records in a loop:** collect IDs and retrieve the collection before the loop where the data shape permits.
- **Update/Create/Delete Records in a loop:** build a record collection with Assignment or Transform and perform one data operation after the loop.
- **Repeated subflows:** pass collections and avoid calling a query-heavy subflow once for each item.
- **Broad start criteria:** use entry conditions and “only when changed” behavior so unrelated updates do not run the automation.
- **Multiple record-triggered Flows on one object:** set deliberate trigger order and evaluate whether shared data access or a consolidated orchestration model would reduce duplicated work.
- **Invocable Apex:** design the method for the complete input list; Flow can invoke the action with bulk inputs.
- **Cross-object DML:** trace the automation on every object the Flow updates.

Salesforce can bulkify Flow operations across interviews, but the transaction still has finite limits. Do not assume the runtime will rescue a design that performs record-by-record data access or repeatedly re-enters other automation.

Before moving a Flow path to asynchronous execution, confirm the business trade-off. The original transaction can succeed before the deferred work finishes, failures require separate monitoring and retry, and users may temporarily see stale related data. Async is an architectural boundary, not a larger bucket used to preserve an inefficient loop.

## Avoid fixes that merely move the failure
{: #false-fixes}

### “Wrap the query in try/catch”

Governor-limit exceptions cannot be caught. Refactor the consumption before the limit is reached.

### “Change the limit from 100”

Per-transaction Apex governor limits are platform constraints. Design within them. Do not build a production plan around requesting a higher query limit.

### “Reduce the integration batch size permanently”

A smaller batch can contain an incident, but record-by-record processing creates more transactions, overhead, and opportunities for partial completion. It can also conceal unsafe automation until volume grows again. Bulkify first, then select a batch size based on measured transaction headroom and business recovery needs.

### “Move everything to Queueable Apex”

Many async Apex transactions have a larger query allowance, but a query-per-record design will fail again at a larger volume. Queueable also introduces job limits, eventual consistency, and a separate failure channel. Use it when the work can be asynchronous, not because query 101 appeared.

### “Add a static Boolean recursion guard”

A single transaction-wide flag can skip legitimate records when the trigger runs again with a different chunk or business event. Prefer meaningful field-change gates, per-record context tracking, idempotent logic, and a trigger framework that records which operation has already processed which records.

### “Fix only the last stack frame”

The final query can be valid and efficient. If it executes after 100 wasteful queries elsewhere, deleting it breaks behavior without addressing the cause. Use the query ledger and transaction map.

## Verify the correction at realistic volume
{: #verification}

Do not close the incident because one UI save succeeds. Test the full automation graph.

### Automated checks

Cover at least:

- one record and a full 200-record trigger batch;
- records sharing the same parent and records spread across many parents;
- qualifying and nonqualifying field changes;
- inserts, updates, deletes, and undeletes where the handler supports them;
- recursion and cross-object updates;
- the integration user or other execution context;
- success assertions on business results, not merely the absence of an exception;
- negative paths, partial DML behavior, and asynchronous failure handling where applicable.

A test can capture query usage around a focused service call with `Limits.getQueries()` and assert that the delta remains bounded as input grows. Avoid asserting a fragile exact count for an end-to-end transaction owned by several teams; define a reviewed budget with meaningful headroom and test the component plus the complete transaction.

### Production-shaped validation

Use a representative sandbox and the same entry point, batch size, data distribution, active Flows, triggers, packages, and permissions as production. A unit test with five new records will not reveal data skew, parent concentration, formula cost, package interaction, or a cascade triggered only by existing data.

Compare the before-and-after log:

- total queries and query rows;
- usage by component;
- number of automation re-entries;
- DML statements and rows;
- CPU and heap;
- outcome records and user-visible timing.

Deploy with an explicit rollback or kill-switch plan. After release, monitor the original entry point, Apex Jobs or Flow errors where relevant, integration failures, and limit telemetry available in your Salesforce edition. Reconcile every transaction affected during containment.

## Prevent the next query-limit incident
{: #prevention}

Make query efficiency a release property rather than a production surprise:

- require bulk tests for trigger handlers, invocable actions, and record-triggered automation;
- use Salesforce Code Analyzer or an equivalent approved static check to flag SOQL and DML inside loops;
- assign ownership for the combined automation on high-density objects;
- review the order-of-execution graph when a Flow, trigger, package, roll-up, or integration changes;
- establish component budgets for queries, rows, DML, CPU, and heap with operational headroom;
- make bypass controls permissioned, audited, time-bound, and followed by reconciliation;
- monitor automation at realistic peak volume before and after releases;
- document async boundaries, retry behavior, idempotency, and job ownership.

The strongest design does not merely stay at 99 queries in today's test. It keeps enough margin for larger batches, different data shapes, and the next legitimate automation added to the transaction.

## Too Many SOQL Queries 101 incident runbook
{: #runbook}

- [ ] Capture user, time, entry point, object, operation, record count, and exact error.
- [ ] Stop blind retries and document any temporary containment.
- [ ] Trace the actual execution user and reproduce the production data shape safely.
- [ ] Capture a complete debug log with Apex, database, and Workflow events.
- [ ] Find the fatal query, then work backward through every `SOQL_EXECUTE_BEGIN`.
- [ ] Map before-save Flow, triggers, DML cascades, re-entry, after-save Flow, packages, and async boundaries.
- [ ] Build a query ledger by component, invocation count, and scaling pattern.
- [ ] Refactor record-by-record queries and DML into collection operations.
- [ ] Review Flow loops, subflows, invocable actions, start criteria, and cross-object updates.
- [ ] Test one and 200 records, parent concentration, recursion, integration context, and negative cases.
- [ ] Compare before-and-after query, row, DML, CPU, heap, and business outcomes.
- [ ] Deploy with monitoring, rollback, and reconciliation plans.

Need a second pair of eyes on a Salesforce production incident? Contact SFX Support at [founders@sfxsupport.com](mailto:founders@sfxsupport.com), call [+91-9414849173](tel:+919414849173), or [message us on WhatsApp](https://wa.me/919414849173).

## Official Salesforce sources
{: #sources}

- [Execution Governors and Limits](https://developer.salesforce.com/docs/platform/apex-dev/references/apex-dev/apex-gov-limits.html)
- [Triggers and Order of Execution](https://developer.salesforce.com/docs/platform/apex-dev/references/apex-dev/apex-triggers-order-of-execution.html)
- [Common Bulk Trigger Idioms](https://developer.salesforce.com/docs/platform/apex-dev/references/apex-dev/apex-triggers-bulk-idioms.html)
- [How to Capture and Read Salesforce Debug Logs](https://help.salesforce.com/s/articleView?id=000392579&language=en_US&type=1)
- [Debug Log Levels](https://help.salesforce.com/s/articleView?id=code_setting_debug_log_levels.htm&language=en_US&type=5)
- [How Flows Run in Transactions](https://help.salesforce.com/s/articleView?id=sf.flow_concepts_transaction.htm&language=en_US&type=5)
- [Record-Triggered Automation Decision Guide](https://architect.salesforce.com/docs/architect/decision-guides/guide/record-triggered)
- [Resource and Cost Optimization](https://architect.salesforce.com/docs/architect/well-architected/guide/resource-and-cost-optimization.html)
