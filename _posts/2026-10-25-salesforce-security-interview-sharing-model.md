---
layout: blog-post
sfx_blog: true
featured: false
title: "12 Salesforce Security Interview Questions on Sharing Models"
description: "Prepare for Salesforce Security interviews with 12 scenario questions on OWD, roles, sharing rules, teams, restriction rules, and access testing."
date: 2026-10-25 08:00:00 +0530
last_modified_at: 2026-10-25 08:00:00 +0530
permalink: /blog/salesforce-security-interview-sharing-model/
primary_category: "Security"
series: "Salesforce Interview Questions"
categories:
  - interview-prep
  - security
  - admin
  - architecture
tags:
  - Salesforce Security interview questions
  - Salesforce sharing model
  - Organization-Wide Defaults
  - Role Hierarchy
  - Sharing Rules
  - Restriction Rules
  - Apex Managed Sharing
  - Record Access
reading_time: "16 min read"
og_type: article
extra_css:
  - /assets/css/blog.css
toc:
  - id: answer-framework
    label: "Answer framework"
  - id: baseline-hierarchy
    label: "OWD and role hierarchy"
  - id: sharing-mechanisms
    label: "Sharing mechanisms"
  - id: restrictions-edges
    label: "Restrictions and edge cases"
  - id: troubleshooting
    label: "Access troubleshooting"
  - id: design-exercise
    label: "Sharing-model design exercise"
  - id: verification
    label: "Production verification"
  - id: quick-revision
    label: "Quick revision"
---

A sales manager reports that one representative can open a confidential Opportunity owned by another region. Opportunity organization-wide defaults are Private, so the team assumes Salesforce has ignored the security model.

That conclusion is too early. Private is only the baseline. The user may have access through the role hierarchy, a sharing rule, an Opportunity Team, a territory, a manual share, an object-level `View All` permission, or privileged Apex. The right interview answer does not guess which feature is broken. It traces every possible access path, identifies the grant, evaluates whether the grant is justified, and tests the correction with the affected persona.

These 12 Salesforce Security interview questions focus on that reasoning. They cover organization-wide defaults (OWD), roles, public groups, sharing rules, teams, territories, restriction rules, programmatic sharing, external users, and verification.

For a broader practice set across Admin, Flow, Apex, Deployment, and Integration, start with [18 scenario-based Salesforce interview questions](/blog/salesforce-interview-questions-scenario-based/). For a visual overview of the access layers, use the SFX [Salesforce Security and Sharing guide](/security-sharing/).

## A strong sharing-model answer framework {#answer-framework}

For any record-access scenario, work through seven questions in order:

1. **Can the user access the object?** Check the license, object permissions, and any `View All` or `Modify All` grant.
2. **Which records should be visible by default?** Set the internal and external OWD independently where the object supports it.
3. **Does management visibility match ownership?** Use the role hierarchy only when access should open upward from record owners.
4. **Which repeatable exceptions are required?** Compare owner-based rules, criteria-based rules, public groups, teams, territories, and other supported declarative mechanisms.
5. **Is the exception broad or record-specific?** A sharing rule solves a pattern; a team or manual share solves collaboration around selected records.
6. **Must already-granted access be filtered?** Evaluate a restriction rule only for supported objects and use cases.
7. **How will you prove and operate the design?** Test positive and negative personas, trace effective access, monitor recalculation, and document who owns each rule.

> OWD answers, “What can a user access without an additional grant?” A complete design must also explain every way access is opened, filtered, bypassed, tested, and removed.

Salesforce's [Manage User Access](https://help.salesforce.com/s/articleView?id=xcloud.security_user_access_overview.htm&language=en_US&type=5) guidance describes the same layered model: object and field permissions establish capability, while sharing determines access to individual records.

## OWD and role hierarchy {#baseline-hierarchy}

### 1. Opportunity OWD is Private. What does that guarantee—and what does it not guarantee?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

Private establishes the most restrictive default for users who do not own a record. It does not mean “only the owner can ever see it.” Access can still come from the role hierarchy, sharing rules, teams, territories, manual sharing, implicit sharing, programmatic sharing, or broad permissions such as `View All` and `Modify All`.

I would choose OWD from the most restrictive legitimate baseline and then open access deliberately. If only sales representatives and their management chain should see Opportunities by default, Private is a sensible starting point. Cross-functional access for Deal Desk should then have an explicit, reviewable grant rather than a more permissive OWD for everyone.

The trade-off is operational complexity. A restrictive baseline usually creates more share records, calculations, and troubleshooting paths. I would not make OWD Private merely because it sounds secure; I would derive it from the access matrix, expected data volume, sharing mechanisms, and support model.
</div>

Salesforce documents that the role hierarchy and sharing rules can add access when OWD is Private or Public Read Only, but those mechanisms cannot restrict access below the OWD baseline in [Organization-Wide Sharing Defaults](https://help.salesforce.com/s/articleView?id=sf.security_sharing_owd_about.htm&language=en_US&type=5).

### 2. Should the Salesforce role hierarchy copy the company organization chart?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

Not automatically. The role hierarchy is a record-access structure, not a directory of reporting lines. I model roles around who must see records owned by whom. If two management layers need identical record visibility, duplicating both layers as roles adds maintenance without improving security.

I would ask whether managers should inherit access to records owned by or shared with users below them. If yes, roles can express that upward visibility. If access must move sideways across functions or regions, a sharing rule, team, territory, or public group is usually clearer than distorting the hierarchy.

For custom objects I also check the **Grant Access Using Hierarchies** setting. Standard-object and custom-object behavior is not identical, so I would verify the object's configuration rather than reciting “managers always see everything.”
</div>

Salesforce's [sharing performance guidance](https://help.salesforce.com/s/articleView?id=platform.security_sharing_performance.htm&language=en_US&type=5) recommends avoiding unnecessary roles and keeping the hierarchy shallow instead of reproducing every box in the organization chart.

### 3. Regional managers need their teams' Opportunities, but the CEO should not automatically see a confidential custom object. How would you design it?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I separate the two objects. For Opportunities, Private OWD plus a role hierarchy that matches regional ownership can provide the required management visibility. For the confidential custom object, I evaluate disabling **Grant Access Using Hierarchies**, then grant access only to approved users through a tightly governed mechanism.

I would not solve both requirements with one oversized role tree. The hierarchy may be correct for sales records and wrong for legal, investigation, or compensation data. Object-specific OWD and hierarchy behavior let the model reflect those differences.

I would also check object-level `View All`, `Modify All`, and `Modify All Data`. Disabling hierarchical access on a custom object does not neutralize broad administrative permissions.
</div>

## Sharing mechanisms {#sharing-mechanisms}

### 4. When do you choose an owner-based sharing rule instead of a criteria-based rule?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I use an owner-based rule when access follows who owns the record. For example, Accounts owned by the APAC Sales role and subordinates can be shared read-only with an APAC Finance public group. I use a criteria-based rule when access follows record data, such as Opportunities where `Requires_Legal_Review__c = true` being shared with the Legal Reviewers group.

I prefer the most stable driver. Ownership works well when the ownership model is trustworthy; business criteria work well when a governed field represents the access decision. A text field that users can freely edit is a weak security control, so I would restrict edits, automate its value, or choose a stronger criterion.

Both rule types grant wider access; they do not deny access supplied by OWD or another path. If multiple grants apply, effective access can be more permissive than the access level on the rule being inspected.
</div>

Review current limitations before implementation in Salesforce's [Sharing Rule Considerations](https://help.salesforce.com/s/articleView?id=sf.security_sharing_rule_considerations.htm&language=en_US&type=5).

### 5. Why use a public group in a sharing design?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

A public group gives the sharing rule a stable business audience. The rule can share eligible records to `Deal_Desk_Reviewers`, while administrators manage membership separately. That is easier to explain and audit than duplicating similar rules for individual users.

The group itself does not grant record access. It becomes an access path only when a sharing rule, manual share, folder permission, queue, or another feature references it. I name groups by purpose, document their owner, review nested membership, and avoid using them as an unmanaged substitute for identity governance.

At scale, I consider membership churn and calculation cost. A heavily nested group referenced by many rules can make role or membership changes expensive. I remove redundant paths and test large changes in a representative sandbox.
</div>

Salesforce lists current public-group and hierarchy design recommendations in [Best Practices for Optimizing Sharing Performance](https://help.salesforce.com/s/articleView?id=platform.security_sharing_performance.htm&language=en_US&type=5).

### 6. When would you use a team or manual share instead of a sharing rule?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I use a team when named collaborators have a business relationship to selected records—for example, an account executive, solution engineer, and renewal manager collaborating on one Account or Opportunity. A team makes the participants and their role in the work visible.

Manual sharing is appropriate for a genuine one-off exception, such as giving a specialist access to a single Case. It is not a scalable entitlement process. I would ask who can create and revoke the share, what happens on ownership transfer, and how support teams will find stale exceptions.

A sharing rule is better when the same condition applies repeatedly. If every strategic Opportunity needs Legal access, relying on record owners to remember a manual share is both fragile and hard to audit.
</div>

The [manual sharing guide](https://help.salesforce.com/s/articleView?id=sf.granting_access_to_records_lex.htm&language=en_US&type=5) explains current eligibility and the Sharing Hierarchy view. Salesforce also notes that effective Account Team access can combine hierarchy, rules, permissions, teams, and manual shares in [Account Team Member Access](https://help.salesforce.com/s/articleView?id=sales.accountteam_access.htm&language=en_US&type=5).

### 7. The sales structure is geographic, but account ownership is centralized. Would you force territories into the role hierarchy?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

No. Roles and territories answer different access questions. The role hierarchy usually follows ownership and management visibility. Enterprise Territory Management can express a market assignment that cuts across owners—for example, geography, industry, or named-account coverage.

I would first confirm that the requirement needs territory behavior rather than a small number of sharing rules. Territory management introduces assignment rules, model activation, forecasting implications, and a second hierarchy to operate. It is valuable when territory membership and account coverage are real business concepts, but excessive for a simple exception.

The design must show how role-derived and territory-derived access combine. I would test a representative account that belongs to multiple territories, a user who changes territories, and a record with no territory assignment.
</div>

The Salesforce Architects [Platform Sharing Architecture](https://architect.salesforce.com/docs/architect/fundamentals/guide/platform-sharing-architecture) guide compares roles, territories, teams, implicit access, and Apex managed sharing in an enterprise design.

## Restrictions and edge cases {#restrictions-edges}

### 8. Can a sharing rule be used to hide records from users who already have access?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

No. A sharing rule adds access; it cannot subtract access from OWD, hierarchy, another rule, or a broad permission. I would first find the unwanted grant and remove or narrow it.

For a supported object and a well-defined user population, a restriction rule can filter records the user would otherwise be able to see through sharing. For example, a contractor group may be limited to Tasks for an approved region even if another sharing path exposes more Tasks.

I would verify object support, edition, user criteria, record criteria, other active restriction rules, API and application behavior, and the effect on search, list views, reports, lookups, and automation. A restriction rule is a targeted filter, not a replacement for correct OWD, object permissions, or field security.
</div>

Salesforce explains that restriction rules filter access granted by OWD and other sharing mechanisms in [Create a Restriction Rule](https://help.salesforce.com/s/articleView?id=platform.security_restriction_rule_create.htm&language=en_US&type=5). The same page lists supported objects and current edition-specific limits, which should be checked at design time rather than assumed.

### 9. A user can open a record but cannot see a confidential field. Is the sharing model failing?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

Not necessarily. Record sharing answers which records a user can access. Object permissions answer what operations are allowed on that object, and field-level security answers which fields can be read or edited. Page layouts control presentation but are not a security boundary.

I troubleshoot the symptom at the right layer. If the record does not open, I start with object Read and record access. If the record opens but one field is absent, I inspect field permissions from the profile, permission sets, and permission set groups. If the field is visible but cannot be edited, I check field Edit, object Edit, record edit access, record locking, validation, and business automation.

I avoid granting `View All` or `Modify All` just to make a field visible. Those permissions widen record access and do not replace correct field-level security.
</div>

### 10. How does the design change for external and guest users?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I treat external access as a separate threat model. I begin with the external OWD, the exact Experience Cloud license, whether the license participates in roles, and whether the access pattern should use partner roles, sharing sets, share groups, account relationships, or other supported mechanisms.

I do not assume an internal sharing rule is safe for external audiences. I inspect whether its target includes portal subordinates and test with real external personas. High-volume users do not participate in the full role-based sharing model in the same way as partner users, so license choice affects architecture.

For unauthenticated guests, I use private-by-default access and explicit guest-user sharing only where the business case requires it. I also review object and field permissions, Apex execution context, file exposure, search behavior, and direct-URL negative tests. “The page does not display the field” is not sufficient evidence.
</div>

The Salesforce Architects sharing guide documents the different model used by high-volume external users, and Salesforce's [Record Access Control](https://help.salesforce.com/s/articleView?id=xcloud.shr_record_access.htm&language=en_US&type=5) guidance describes secure guest-user record access.

### 11. When is Apex managed sharing justified?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I use programmatic sharing only when the access requirement is dynamic and cannot be expressed safely with declarative sharing. Examples include a custom assignment engine or an external system that remains the source of truth for access relationships.

The code must manage the full lifecycle: create only the required shares, remain idempotent, update access when the source relationship changes, delete stale shares, handle partial failures, and provide reconciliation. I prefer a named sharing reason where the object and platform capability support it so administrators can understand why the share exists and automation can manage only its own rows.

I also separate the act of creating a share from Apex execution context. `with sharing` controls whether a class respects record sharing during access; it does not automatically enforce object and field permissions, and it does not by itself design a correct sharing lifecycle.
</div>

Salesforce Architects describes appropriate [Apex managed sharing use cases](https://architect.salesforce.com/docs/architect/fundamentals/guide/platform-sharing-architecture), while the Salesforce Secure Coding Guide explains [`with sharing`, `without sharing`, and `inherited sharing`](https://developer.salesforce.com/docs/platform/secure-coding/guide/secure-coding-access-control-protect-from-sharing-violations.html).

## Access troubleshooting {#troubleshooting}

### 12. OWD is Private, but a user can still edit another person's record. How do you find the reason?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I preserve the evidence before changing configuration: user, record, object, required versus observed access, channel, time, and whether the access is read or edit. Then I inspect layers from broadest to most specific.

1. Confirm the user's license and object permissions, especially `View All`, `Modify All`, and `Modify All Data`.
2. Confirm the record owner, queue owner, and OWD for the correct internal or external audience.
3. Check the user's role relative to the owner and the object's hierarchy behavior.
4. Inspect owner-based and criteria-based sharing rules, including public-group membership.
5. Inspect teams, territories, manual shares, implicit parent access, and programmatic shares.
6. Check restriction rules when the problem is missing or unexpectedly filtered visibility.
7. Check whether custom Apex or an integration runs in privileged context and exposes the data through another channel.

I use **User Access Summary** to trace permission sources, and **Sharing Hierarchy** on the record where available to inspect record access. Then I reproduce the behavior with the affected user or an equivalent least-privileged test persona. Removing the first visible share is not enough; another path may still grant equal or greater access.
</div>

[User Access Summary](https://help.salesforce.com/s/articleView?id=platform.users_access_summary.htm&language=en_US&type=5) exposes which profile, permission set, or group grants a permission. Salesforce's manual-sharing documentation explains how **View Sharing Hierarchy** reveals record-level access details.

## Design exercise: regional sales with Deal Desk review {#design-exercise}

An interviewer asks you to design access for this scenario:

- Sales representatives own Opportunities and should not see peer-owned deals by default.
- Regional managers need access to their teams' deals.
- Deal Desk needs read/write access only when an Opportunity requires commercial approval.
- A solution engineer may join selected complex deals.
- External partners must not inherit internal Deal Desk access.
- Audit must be able to explain why a user can see a record.

A defensible first design is:

| Requirement | Candidate mechanism | Reason and trade-off |
|---|---|---|
| Restrictive internal baseline | Opportunity OWD Private | Prevents peer visibility without an explicit path |
| Separate external baseline | External OWD Private | Avoids relying on internal access assumptions for partners |
| Manager visibility | Role hierarchy | Fits upward access when managers align with ownership |
| Deal Desk access | Criteria-based sharing rule to a governed public group | Repeats whenever the approval field becomes true; field changes must be controlled |
| Selected specialists | Opportunity Team | Represents named collaboration on individual deals |
| Partner access | License-appropriate external sharing design | Keeps external identity and sharing behavior explicit |
| Exceptional dynamic rules | Apex managed sharing only if declarative options fail | Adds code, reconciliation, and support cost |

Before approving the design, I would challenge four assumptions:

1. **Who controls the Deal Desk criterion?** If every sales user can set or clear it, the field is also an access-control input and needs governance.
2. **Does the role hierarchy match ownership?** Overlay managers or matrix reporting may need a different mechanism.
3. **What access should disappear?** Define what happens when approval is completed, a team member leaves, the owner changes, or a partner relationship ends.
4. **How large is the sharing calculation?** Estimate record counts, group membership, ownership skew, planned realignments, and peak business periods.

The best interview answer calls this a candidate design, not a final one. The final choice depends on the actual access matrix, licenses, data volume, external-user model, and operating controls.

## Production verification plan {#verification}

Build a small access test matrix before deployment:

| Persona | Test record | Expected result |
|---|---|---|
| Opportunity owner | Own deal | Read and edit |
| Peer representative | Same region, different owner | No access unless another approved path applies |
| Regional manager | Subordinate-owned deal | Required manager access |
| Deal Desk member | Approval required | Read/write through the rule |
| Deal Desk member | Approval not required | No Deal Desk-derived access |
| Solution engineer | Added to team | Team access at the approved level |
| Solution engineer | Removed from team | Team-derived access removed |
| External partner | Internal-only deal | No access |
| Administrator | Any deal | Administrative access, excluded as proof for ordinary users |

For the change itself:

1. Inventory OWD, hierarchy settings, roles, groups, rules, teams, territories, broad permissions, and custom share automation.
2. Test the proposed metadata and representative data volume in a suitable sandbox.
3. Include positive, negative, removal, ownership-transfer, and external-user cases.
4. Review the blast radius before changing a shared group or rule.
5. Deploy during a planned window when the change can trigger substantial recalculation.
6. Monitor sharing calculation and background-job status where applicable.
7. Re-run the access matrix with least-privileged users after calculation completes.
8. Capture the access reason, test evidence, approver, and rollback or remediation decision.

Salesforce warns that OWD changes, role updates, group membership changes, ownership changes, and sharing-rule edits can trigger recalculation. Review [Considerations for Making Sharing Updates](https://help.salesforce.com/s/articleView?id=platform.security_sharing_update_considerations.htm&language=en_US&type=5) before a large production change.

## Quick revision sheet {#quick-revision}

| Interview prompt | Start with | Common weak answer |
|---|---|---|
| Who sees records by default? | Internal and external OWD | “Private means only the owner” |
| Managers need subordinate records | Role hierarchy aligned to ownership | Copy the entire org chart |
| Cross-functional access follows owner | Owner-based sharing rule | Add every user manually |
| Access follows record data | Criteria-based sharing rule | Use an editable field without governance |
| Named people collaborate on selected records | Team | Create an org-wide rule |
| One exceptional record needs access | Manual share | Treat manual sharing as entitlement management |
| Market coverage differs from management | Territories, if the business model justifies them | Distort the role hierarchy |
| Already-granted access must be filtered | Supported restriction-rule use case | Try to use a sharing rule as a deny |
| Declarative sharing cannot express the rule | Apex managed sharing with lifecycle ownership | Insert shares without cleanup or reconciliation |
| A user has unexpected access | Trace every permission and sharing path | Change OWD before finding the grant |

The strongest security answer is not the one with the most Salesforce features. It is the one that states the required access, chooses the smallest sustainable grant, explains the trade-off, and proves both who can and who cannot reach the data.

If your team needs help reviewing an existing model or preparing for a Salesforce Security interview, [contact SFX Support](/contact/) or use our [Salesforce support assistant](/chatbot/).

## Sources

- [Manage User Access — Salesforce Help](https://help.salesforce.com/s/articleView?id=xcloud.security_user_access_overview.htm&language=en_US&type=5)
- [Organization-Wide Sharing Defaults — Salesforce Help](https://help.salesforce.com/s/articleView?id=sf.security_sharing_owd_about.htm&language=en_US&type=5)
- [Sharing Rule Considerations — Salesforce Help](https://help.salesforce.com/s/articleView?id=sf.security_sharing_rule_considerations.htm&language=en_US&type=5)
- [Best Practices for Optimizing Sharing Performance — Salesforce Help](https://help.salesforce.com/s/articleView?id=platform.security_sharing_performance.htm&language=en_US&type=5)
- [Create a Restriction Rule — Salesforce Help](https://help.salesforce.com/s/articleView?id=platform.security_restriction_rule_create.htm&language=en_US&type=5)
- [View a User's Access Summary — Salesforce Help](https://help.salesforce.com/s/articleView?id=platform.users_access_summary.htm&language=en_US&type=5)
- [Considerations for Making Sharing Updates — Salesforce Help](https://help.salesforce.com/s/articleView?id=platform.security_sharing_update_considerations.htm&language=en_US&type=5)
- [Platform Sharing Architecture — Salesforce Architects](https://architect.salesforce.com/docs/architect/fundamentals/guide/platform-sharing-architecture)
- [Protect Your Application from Sharing Violations — Salesforce Secure Coding Guide](https://developer.salesforce.com/docs/platform/secure-coding/guide/secure-coding-access-control-protect-from-sharing-violations.html)
