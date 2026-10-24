---
layout: blog-post
sfx_blog: true
featured: true
title: "15 Senior Salesforce Apex Trigger Interview Questions for 6+ Years Experience"
description: "Prepare for senior Salesforce interviews with 15 Apex trigger questions on transactions, bulk design, recursion, locking, security, testing, and debugging."
date: 2026-10-25 02:00:00 +0530
last_modified_at: 2026-10-25 02:00:00 +0530
permalink: /blog/salesforce-apex-trigger-interview-questions-6-years-experience/
primary_category: "Senior Apex"
series: "Salesforce Interview Questions"
categories:
  - interview-prep
  - apex
  - triggers
  - architecture
tags:
  - Salesforce Apex trigger interview questions
  - Salesforce interview questions for 6 years experience
  - Senior Salesforce Developer interview
  - Apex Triggers
  - Trigger Framework
  - Order of Execution
  - Apex Bulkification
  - Salesforce Governor Limits
reading_time: "17 min read"
og_type: article
extra_css:
  - /assets/css/blog.css
toc:
  - id: senior-answer-framework
    label: "Senior answer framework"
  - id: architecture-ownership
    label: "Architecture and ownership"
  - id: transaction-behavior
    label: "Transaction behavior"
  - id: reliability-concurrency
    label: "Reliability and concurrency"
  - id: security-testing
    label: "Security and testing"
  - id: production-debugging
    label: "Production debugging"
  - id: quick-revision
    label: "Quick revision"
---

An Opportunity trigger works perfectly in a developer sandbox. In production, a bulk integration updates 200 Opportunities, an after-save Flow updates the same Accounts, several transactions touch the same parent records, and users begin seeing both `Too many SOQL queries: 101` and `UNABLE_TO_LOCK_ROW`.

A junior answer says, “Move SOQL outside the loop.”

A senior answer asks which automation owns the outcome, maps the complete order of execution, measures the shared transaction budget, groups work by parent, removes unnecessary DML, controls re-entry, and changes the concurrency pattern that creates hot-record locks.

That difference is what experienced Salesforce interviews test. For candidates with six or more years of experience, trigger questions are usually architecture and production-support questions disguised as Apex questions. Interviewers want to hear how you make automation predictable when Flow, Apex, integrations, managed packages, and asynchronous work all meet in one transaction.

This guide gives you 15 senior Salesforce Apex trigger interview questions and answer structures. It intentionally skips beginner questions such as “What is `Trigger.new`?” and focuses on the decisions expected from a senior developer or technical lead.

For a broader interview set, use [18 scenario-based Salesforce interview questions](/blog/salesforce-interview-questions-scenario-based/). For async trade-offs referenced below, keep the SFX [Asynchronous Apex guide](/asynchronous-apex/) nearby.

## How to answer a senior trigger question {#senior-answer-framework}

Use this seven-part structure:

1. **Define the business invariant.** What must always be true after the transaction?
2. **Map every entry point.** UI, API, data load, Flow, Apex, integration, platform event, and managed automation can all change the data shape.
3. **Choose one owner.** Decide whether Flow, a before trigger, an after trigger, or asynchronous processing owns each outcome.
4. **Design for a collection.** Assume every trigger context contains many records and shares limits with the rest of the transaction.
5. **Make re-entry safe.** Gate on meaningful state changes and make side effects idempotent.
6. **Plan failure and concurrency.** Explain rollback, partial success, retries, duplicate prevention, and record locking.
7. **Prove it.** Describe bulk, negative, security, re-entry, async, and production-observability tests.

> A six-year answer should sound like a short design review: ownership, transaction, failure mode, and evidence—not a list of Apex keywords.

## Architecture and ownership questions {#architecture-ownership}

### 1. When would you choose an Apex trigger instead of a record-triggered Flow?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I start with the requirement, the team that will support it, and the existing automation architecture. A before-save Flow is a strong choice for maintainable field updates on the triggering record. Flow can also handle many ordinary related-record actions. I choose Apex when the requirement needs complex collection processing, reusable domain logic, precise transaction control, sophisticated error handling, logic shared across entry points, or behavior that is clearer and safer in tested code.

The senior decision is not “code is faster” or “clicks not code.” I compare data volume, query shape, failure behavior, security context, deployment ownership, observability, and expected change frequency. I also avoid splitting one business outcome across Flow and Apex without a clear boundary. If a Flow calculates eligibility and a trigger independently recalculates the same rule, production support will struggle to explain which result is authoritative.

My final answer names one owner for the business invariant and documents how the other automation layers interact with it.
</div>

### 2. How do you decide between a before trigger and an after trigger?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I use a before trigger when I need to validate or change fields on the records being saved. I can update values in `Trigger.new` without issuing another DML statement, which avoids a second save cycle. I use `addError()` when the business rule must block a record and explain the failure.

I use an after trigger when I need system-populated values such as record IDs or when I must create or update related records. Trigger records are read-only in after context, so changing the same records requires another DML operation and can cause re-entry. That is a design warning: if the value could have been calculated before save, I move it there.

I also separate the event from the work. “After update” alone is too broad; the handler should process only records whose relevant state actually changed.
</div>

Salesforce's trigger fundamentals distinguish [before triggers for validation or same-record changes and after triggers for system-set values or related work](https://trailhead.salesforce.com/content/learn/modules/apex_triggers/apex_triggers_intro).

### 3. Why do senior teams often use one trigger per object?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

Salesforce does not guarantee the execution order of multiple triggers on the same object for the same event. For automation owned by my team, I prefer one thin trigger as the entry point and route contexts to explicit handler or domain methods. That gives the team one place to define sequencing, bypass rules, logging, and transaction-scoped state.

The trigger should not become a thousand-line framework. It should identify the context and delegate. Business rules live in testable services; queries and DML are coordinated across the complete requirement so separate handlers do not each query and update the same records.

I also acknowledge the boundary: managed packages can install their own triggers, and I cannot force their order relative to mine. The design must not depend on running immediately before or after package automation. I test the combined transaction instead.
</div>

Salesforce's current order-of-execution guidance confirms that [the order of multiple Apex triggers in the same trigger group isn't guaranteed](https://help.salesforce.com/s/articleView?id=000005694&language=en_US&type=1).

### 4. What does a maintainable trigger framework provide—and what should it avoid?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

A useful framework provides predictable context routing, a thin entry point, explicit sequencing, reusable services, bulk-safe data access, controlled bypass, and test seams. It should make the business logic easier to find and the transaction easier to reason about.

It should avoid reflection-heavy magic, hidden queries, global mutable state, and handlers that perform DML simply because a lifecycle hook exists. A framework cannot fix poor ownership or unselective queries. I choose the smallest structure that makes execution explicit for the org's complexity.

For bypass, I require a governed reason, narrow scope, auditability, and a safe default. A permanent org-wide “disable all triggers” switch can create corrupt data while appearing to solve deployment or loading problems. A controlled custom permission or configuration tied to an approved process is safer, but the skipped invariant still needs reconciliation.
</div>

## Transaction and order-of-execution questions {#transaction-behavior}

### 5. “No SOQL inside loops” is not enough. How do you bulkify the whole transaction?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I design from the full input collection. First I filter records to the state transitions that matter. Then I collect unique keys in Sets, query each required data set once, index results in Maps, calculate changes in memory, and perform DML on collections outside loops.

But I also inspect the shared transaction. Ten handlers with one query each, two Flows with repeated Gets, and a managed package can still exceed limits even though no individual method queries inside a loop. I remove duplicate data access, keep queries selective, avoid updating records whose values did not change, and choose one owner for repeated cross-object work.

I test realistic data distribution, not just 200 identical records. The difficult case is often 200 children across a few hot parents, records with and without related data, or a batch that activates several automation paths at once.
</div>

Salesforce's [Bulk Apex Triggers](https://trailhead.salesforce.com/content/learn/modules/apex_triggers/apex_triggers_bulk) guidance emphasizes processing every context record and using collection-based SOQL and DML. The [Apex governor limits reference](https://developer.salesforce.com/docs/platform/salesforce-app-limits-cheatsheet/guide/salesforce-app-limits-platform-apexgov.html) explains why the complete transaction must stay within shared limits.

### 6. How do you detect a meaningful field change without processing every update?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I compare the new record with `Trigger.oldMap` and gate on the business transition, not merely on `Trigger.isUpdate`. If fulfillment starts only when Stage moves to Closed Won, the condition must check the old and new Stage values. I also filter null foreign keys and collect unique related IDs before querying.

```apex
public class OpportunityChangeSelector {
    public static Set<Id> newlyWonAccountIds(
        List<Opportunity> currentRecords,
        Map<Id, Opportunity> priorById
    ) {
        Set<Id> accountIds = new Set<Id>();

        for (Opportunity current : currentRecords) {
            Opportunity prior = priorById.get(current.Id);
            Boolean becameClosedWon =
                current.StageName == 'Closed Won' &&
                prior.StageName != 'Closed Won';

            if (becameClosedWon && current.AccountId != null) {
                accountIds.add(current.AccountId);
            }
        }
        return accountIds;
    }
}
```

This change gate prevents ordinary unrelated updates from starting work. It is not, by itself, a complete duplicate-prevention strategy: re-entry, retries, and concurrent transactions may still repeat a side effect. For an irreversible action, I add a durable idempotency key or unique business record.
</div>

### 7. A trigger fires twice in one save. How do you diagnose and control re-entry?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I map the order of execution and identify the DML that starts the second save cycle. Workflow field updates, Flows, roll-up activity, other triggers, and related-record updates can all produce additional automation. I inspect the field transition and transaction log rather than immediately adding a static flag.

A single static Boolean is usually too blunt for mature code. It can suppress legitimate work for different records or later operations in the same transaction. A transaction-scoped `Set<Id>` can be appropriate when the rule is truly “once per record per transaction,” but I prefer making the logic idempotent: update only when the desired value differs, act only on a real state transition, and enforce durable uniqueness for external or cross-transaction side effects.

The protection must match the failure boundary. Static state helps only inside one Apex transaction; it does nothing when an integration retries the request tomorrow.
</div>

### 8. How do Flow and Apex share the order of execution and governor budget?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I treat them as one automation system. Before-save record-triggered Flows run before before triggers. After triggers run before after-save record-triggered Flows. DML started by any layer can begin another save sequence, and synchronous automation contributes to the same transaction limits.

When both technologies touch the same object, I inventory the fields and related records each one owns. I remove circular updates and make entry conditions narrow. For CPU or query failures, I profile the entire transaction; optimizing the line named in the exception may not be enough if earlier Flow or package work already consumed most of the budget.

During design review, I draw the save path using actual automation names and state transitions. Memorizing a numbered list is less useful than being able to predict which automation can re-enter the record and where the transaction can fail.
</div>

Use Salesforce's maintained [process-order guidance](https://help.salesforce.com/s/articleView?id=000005694&language=en_US&type=1) as the source of truth rather than relying on an old diagram copied into project documentation.

## Reliability and concurrency questions {#reliability-concurrency}

### 9. When should a trigger use `addError()` versus throwing an exception?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I use `addError()` for a record-level business rule when the user or caller should receive an actionable validation message tied to that record. I throw an exception for an unexpected condition where continuing would leave the transaction inconsistent. I do not catch an exception only to write `System.debug()` and allow corrupt or incomplete data to commit.

I also clarify the caller's all-or-none behavior. A bulk API or `Database` operation can permit partial success, so some records may commit while failed records are returned to the caller. Trigger logic must not assume one invocation equals one permanently successful batch. Salesforce can retry portions of partial-success work inside the transaction, which is another reason static guards and side effects need careful design.

For supportability, errors expose a stable business message to users and retain technical context in an approved logging channel without leaking secrets or sensitive record data.
</div>

### 10. How do you prevent `UNABLE_TO_LOCK_ROW` in trigger-driven updates?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I identify the records that become contention points. A common pattern is many child transactions updating the same Account, parent of a master-detail relationship, ownership record, or sharing-related object. Bulkifying the DML reduces statements but does not remove concurrency if parallel transactions still request the same locks.

I group work by parent, update each parent at most once, process IDs in a consistent order, and avoid unnecessary parent writes. For data loads, I reduce parallelism or partition batches so transactions do not share parent records. If the outcome can be eventually consistent, I move the aggregate or downstream work to a durable asynchronous process that can retry with monitoring.

I do not add an immediate blind retry inside the trigger. That holds the original transaction open and can worsen contention. The recovery strategy belongs at a boundary where failure can be observed and replayed safely.
</div>

Salesforce's enterprise-scale guide explains that [simultaneous updates to parents and children—or many children with the same parent—can cause record-locking failures](https://developer.salesforce.com/docs/platform/draes/guide/draes-object-relationships-record-level-locking.html).

### 11. A record change must call an external API. What belongs in the trigger?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

The trigger should identify eligible records and enqueue a bounded unit of asynchronous work, not perform the callout directly and not enqueue one job per record. A Queueable that implements `Database.AllowsCallouts` can requery committed state, use a Named Credential, send an idempotency key, classify the response, and write durable success or failure status.

I pass stable identifiers or an immutable request reference instead of assuming the sObject snapshot will still represent current truth when the job runs. I define what happens when the originating transaction rolls back, the remote system times out after accepting the request, the job is retried, or a record changes again before the callout begins.

Finally, I design operations: correlation IDs, attempt count, bounded backoff, a failed-work queue, manual replay, and reconciliation with the remote system. “Put it in Queueable” is only the transport choice, not the reliability design.
</div>

Salesforce's trigger guidance requires [callouts started from triggers to run asynchronously and demonstrates Queueable with `Database.AllowsCallouts`](https://trailhead.salesforce.com/content/learn/modules/apex_triggers/apex_triggers_intro). For idempotency and reconciliation patterns, see the SFX [Salesforce integration interview guide](/blog/salesforce-integration-interview-questions/).

### 12. A trigger updates a User and a business record and gets `MIXED_DML_OPERATION`. What is your solution?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I identify the setup-object and non-setup-object operations. Objects such as User, UserRole, Group, and GroupMember affect access configuration; combining their DML with ordinary business-record DML in the same transaction can produce mixed-DML failures.

I separate the operations into different transaction boundaries, commonly by moving one side into asynchronous Apex. Then I design for eventual consistency: store enough state to retry, make the second transaction idempotent, monitor failures, and avoid telling the user that provisioning succeeded before it actually did.

I do not apply `@future` mechanically to hide the error. Queueable is usually easier to observe and extend, but the important choice is the business boundary and recovery model. If access provisioning fails, who owns the alert and what compensating action is safe?
</div>

Salesforce describes the setup/non-setup restriction and common causes in its current [Mixed DML guidance](https://help.salesforce.com/s/articleView?id=000315345&language=en_US&mode=1&type=1).

## Security and testing questions {#security-testing}

### 13. Do Apex triggers automatically respect the user's object, field, and record access?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I never answer this with a blanket yes. I define the intended execution mode for each operation and review the handler class's sharing declaration and database access mode. Record sharing, object permissions, and field permissions are separate layers. A `with sharing` class addresses record-level sharing behavior; it does not by itself prove object- and field-level authorization.

Some trigger automation is deliberately privileged business logic—for example, maintaining a controlled audit record. Other logic acts on user-supplied fields or exposes results back to a UI and should enforce user access. I make that decision explicit with supported user-mode operations or `Security.stripInaccessible()` where appropriate, and I test using least-privileged personas.

The senior question is not only “Can the code run?” It is “Whose authority should this business action use, and can an untrusted input make the trigger read or modify data beyond that authority?”
</div>

Salesforce's [Secure Apex Classes](https://developer.salesforce.com/docs/platform/lwc/guide/apex-security) guidance separates record sharing from object- and field-level enforcement and documents explicit access-mode options.

### 14. What does a production-grade trigger test suite contain?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

It asserts business outcomes, not only code coverage. I include single-record and bulk operations; insert, update, delete, and undelete contexts that the trigger supports; relevant and irrelevant field changes; mixed valid and invalid records; missing related data; re-entry; duplicate prevention; least-privileged users; and interaction with asynchronous jobs.

For bulk tests, I use a realistic distribution of related records and assert the final database state. I use `Test.startTest()` and `Test.stopTest()` around the action whose limits or queued work I want to isolate. I avoid `SeeAllData=true`, build test data through factories, and assert that no unnecessary duplicates or updates were produced.

I also add regression tests for the production failure that motivated a fix. If the incident involved 200 Opportunities sharing ten Accounts plus an after-save Flow, a one-record trigger test is not evidence that the fix works.
</div>

Salesforce recommends covering positive, negative, bulk, and single-record behavior rather than optimizing only for the deployment percentage in [Testing Your Apex Code](https://developer.salesforce.com/docs/platform/aura-platform/guide/apps-packaging-tests.html).

## Production debugging question {#production-debugging}

### 15. Production reports `Too many SOQL queries: 101`. How do you diagnose it as a senior developer?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I capture the failing operation, user or integration path, batch size, record IDs or data shape, timestamp, and complete exception details. Then I read the whole debug log and execution tree. The line where the limit is exceeded is not necessarily the component that consumed most queries; triggers, Flows, managed packages, and helper classes share the transaction.

I count entry points and re-entry, map queries to handlers, identify SOQL in loops, and look for the same selector being called repeatedly. I inspect whether unrelated record updates activate broad automation, whether recursion causes another save cycle, and whether several “bulkified” components each spend a small but unsustainable part of the budget.

The repair may be collection-based data access, query reuse, tighter change gates, fewer redundant DML updates, a better ownership boundary, or moving non-critical work after commit. I reproduce the original batch and data relationships, assert the business result, and compare limits before and after. Finally, I add monitoring or structured logs so support can identify the same transaction shape without enabling unrestricted debug logs in production.
</div>

## Quick revision sheet {#quick-revision}

| Senior interview scenario | Start with | Strong follow-up |
|---|---|---|
| Trigger or Flow? | Business invariant and owner | Volume, support model, failure behavior |
| Before or after? | Same-record change versus related work | Avoid unnecessary second DML |
| Multiple triggers on one object | Order isn't guaranteed | One explicit org-owned entry point |
| Bulkification | Full collection and full transaction | Shared Flow, package, CPU, query, and DML budget |
| Detecting changes | `Trigger.oldMap` versus current values | Process only meaningful transitions |
| Recursion | Find the DML that re-enters | Idempotency beats a global static Boolean |
| Flow and Apex together | Map order of execution | Assign field and outcome ownership |
| Record validation | `addError()` for actionable record rules | Define partial-success behavior |
| Row locking | Identify hot parents | Partition concurrency and remove needless writes |
| External API | Bounded Queueable work | Idempotency, retries, monitoring, reconciliation |
| Mixed DML | Separate setup and business transactions | Design eventual consistency and recovery |
| Trigger security | Explicit authority and access mode | Test least-privileged personas |
| Trigger testing | Assert outcomes under realistic bulk data | Re-entry, async, negative, and regression cases |
| Production limit incident | Inspect the complete transaction | Reproduce the original batch and automation path |

The senior pattern is consistent: reduce ambiguity. One owner, one explicit transaction design, bounded work, idempotent side effects, observable failures, and tests that reproduce production conditions.

Working through a senior Salesforce developer interview or a difficult trigger incident? [Contact SFX Support](/contact/) or use [Ask Krrish](/chatbot/) to break down the scenario.

## Sources

- [Get Started with Apex Triggers — Salesforce Trailhead](https://trailhead.salesforce.com/content/learn/modules/apex_triggers/apex_triggers_intro)
- [Bulk Apex Triggers — Salesforce Trailhead](https://trailhead.salesforce.com/content/learn/modules/apex_triggers/apex_triggers_bulk)
- [Process Order for Salesforce Automation Rules and Apex Triggers — Salesforce Help](https://help.salesforce.com/s/articleView?id=000005694&language=en_US&type=1)
- [Apex Governor Limits — Salesforce Developers](https://developer.salesforce.com/docs/platform/salesforce-app-limits-cheatsheet/guide/salesforce-app-limits-platform-apexgov.html)
- [Record-Level Locking — Salesforce Architects](https://developer.salesforce.com/docs/platform/draes/guide/draes-object-relationships-record-level-locking.html)
- [Secure Apex Classes — Salesforce Developers](https://developer.salesforce.com/docs/platform/lwc/guide/apex-security)
- [Testing Your Apex Code — Salesforce Developers](https://developer.salesforce.com/docs/platform/aura-platform/guide/apps-packaging-tests.html)
- [Mixed DML Operation — Salesforce Help](https://help.salesforce.com/s/articleView?id=000315345&language=en_US&mode=1&type=1)
- [Developer Best Practices Checklist — Salesforce Developers Blog](https://developer.salesforce.com/blogs/2022/01/drive-consistency-and-grow-developer-skills-with-a-developer-best-practices-checklist)
