---
layout: blog-post
sfx_blog: true
featured: false
title: "Why Can This Salesforce User See the Record? A Security Troubleshooting Map"
seo_title: "Salesforce Record Access Troubleshooting Guide"
description: "Trace unexpected Salesforce record access through permissions, OWD, hierarchy, sharing, teams, territories, implicit access, and restrictions."
date: 2026-10-31 08:00:00 +0530
last_modified_at: 2026-10-31 08:00:00 +0530
permalink: /blog/why-salesforce-user-can-see-record/
primary_category: "Security"
series: "Real-World Salesforce Problem Solving"
categories:
  - security
  - admin
  - problem-solving
tags:
  - Salesforce Record Access
  - Salesforce Security
  - Sharing Hierarchy
  - UserRecordAccess
  - Organization-Wide Defaults
  - Permission Sets
  - Restriction Rules
  - Salesforce Troubleshooting
reading_time: "18 min read"
og_type: article
extra_css:
  - /assets/css/blog.css
toc:
  - id: incident-scenario
    label: "Start with the incident"
  - id: access-layers
    label: "The effective-access model"
  - id: object-permissions
    label: "Check object permissions"
  - id: sharing-hierarchy
    label: "Use Sharing Hierarchy"
  - id: grant-map
    label: "Trace every record grant"
  - id: query-evidence
    label: "Query the evidence"
  - id: false-leads
    label: "Avoid common false leads"
  - id: restrictions-code
    label: "Restrictions and code"
  - id: worked-example
    label: "Worked Opportunity example"
  - id: remediation
    label: "Remediate and verify"
  - id: incident-checklist
    label: "Incident checklist"
  - id: sources
    label: "Official sources"
---

An Opportunity is owned by the West sales team. Opportunity organization-wide defaults are **Private**, yet a sales representative in the East region can open the record and edit the amount. The administrator checks one sharing rule, cannot find the user's name, and concludes that Salesforce is ignoring OWD.

That conclusion is premature. Private is a baseline, not proof that only the owner has access. The user might have `View All Records`, sit above the owner in the role hierarchy, belong to a group used by a sharing rule, be an Opportunity Team member, inherit access through Enterprise Territory Management, receive a manual or programmatic share, or reach the data through code running in an elevated context.

The safe response is not to delete sharing rules until the symptom disappears. It is to identify the exact user, record, operation, and access path; correct the narrowest responsible grant; and prove that required access still works.

This guide provides that investigation map. For the underlying design concepts, see the SFX [Salesforce Security and Sharing guide](/security-sharing/). If you are preparing for an interview, pair it with [12 Salesforce Security interview questions on sharing models](/blog/salesforce-security-interview-sharing-model/).

## Start with the incident, not the configuration
{: #incident-scenario}

Before changing access, record four facts:

1. **Which user?** Capture the affected user's ID, license, active permission-set assignments, permission-set groups, profile, role, territories, queues, teams, and public-group membership.
2. **Which record?** Capture the record ID, object, owner, parent Account where relevant, record type, and any recent ownership change. Do not paste customer data or production IDs into public tickets.
3. **Which operation succeeded?** “Can see it” is ambiguous. Did the user find it in a list view, open the record URL, query it through an API, edit a field, delete it, transfer it, or access it through a custom component?
4. **In which execution path?** Standard Lightning, Experience Cloud, an integration, Flow, Apex, and a managed package can enforce access differently. Record the exact path and time.

Reproduce with the affected persona or a controlled test user that has the same assignments. An administrator is a poor proxy because `View All Data`, `Modify All Data`, and object-level overrides can hide the real behavior. Preserve screenshots of **Sharing Hierarchy**, the user's **View Summary**, and query results before making changes.

This evidence separates three incidents that sound similar:

- The user has legitimate record access, but the business no longer wants that grant.
- The standard Salesforce security model denies access, but custom code exposes the data.
- The user cannot truly access the record; a list, cache, related record, search result, or scoping configuration created a misleading symptom.

## Use the effective-access model
{: #access-layers}

A useful mental model is:

> Effective record access = object capability + at least one record-level grant − an applicable restriction, evaluated in the context of the channel that performs the operation.

The layers are evaluated together:

| Layer | Question | Typical evidence |
|---|---|---|
| License and object permission | May this user read or change this object at all? | User **View Summary**, profile, permission sets, permission-set groups |
| Field-level security | May the user read or update this field? | Field access in **View Summary**, Permission Set summaries |
| Baseline record access | What access exists before exceptions? | Internal/external OWD, ownership |
| Additional grants | Which path opens this particular record? | Hierarchy, rules, teams, territories, manual shares, groups, implicit access, Apex shares |
| Restrictions | Does a restriction rule filter a record that was otherwise granted? | Active restriction rules and their user/record criteria |
| Execution context | Does the code or automation enforce the same controls? | Apex sharing declaration, user/system context, SOQL/DML mode, API user |

The order prevents a common mistake: spending hours on sharing rules when a permission set grants `View All Records`. It also prevents the reverse mistake—removing object `Read` when only one overly broad record grant needs correction.

Salesforce describes record access as a **grant-then-restrict** model. OWD establishes a baseline, ownership and sharing mechanisms grant more access, and restriction rules can filter access for supported use cases. A user can receive the same record from several paths; removing one path does not remove the others.

## Check object permissions first
{: #object-permissions}

Open the user's record in Setup, select **View Summary**, and inspect the object's effective permissions. The summary can show which profile, permission set, or permission-set group grants an object permission.

Pay special attention to these permissions:

- **Read** allows the user to read the object, but it still respects record sharing.
- **Edit**, **Delete**, and other CRUD permissions define possible operations; they do not independently grant every record.
- **View All Records** bypasses record sharing for that object and grants read access to every record of it.
- **Modify All Records** bypasses record sharing for that object and grants broad administrative access to its records.
- **View All Fields** is about fields. It does not provide access to records that sharing denies.
- **View All Data** and **Modify All Data** are global permissions and should be treated as privileged administrative grants.

If `View All Records` explains the incident, do not immediately remove the entire permission set. First determine why it was assigned, which other permissions it carries, whether the grant came from a permission-set group, and which supported users rely on it. The narrow fix might be a new least-privilege permission set, removal of one group assignment, or replacement of a global grant with a targeted sharing mechanism.

Also inspect temporary access: session-based permission sets, delegated administration, automated user provisioning, group membership rules, and recent changes in identity or HR-driven assignments. An access review that examines only the profile will miss the additive permissions Salesforce encourages administrators to manage through permission sets and permission-set groups.

## Use Sharing Hierarchy on the record
{: #sharing-hierarchy}

For supported objects in Lightning Experience, open the record's action menu and select **Sharing Hierarchy**. Locate the user and choose **View** to see why Salesforce says the user has access.

Depending on the object and configuration, the reason can point to:

- ownership;
- an administrator or broad object permission;
- the role hierarchy;
- a sharing rule;
- a team or territory;
- a portal or Experience Cloud relationship;
- another supported sharing source.

Treat this screen as a starting point, not an exhaustive audit report. Salesforce can show the most permissive reason when several grants exist. A user can also be absent because public OWD already grants access, because of the user's external-user model, or because the access is being supplied by an execution path rather than the standard record-sharing calculation.

If a restriction rule applies, Sharing Hierarchy can help show that a user is blocked even though a sharing source granted the record. That distinction matters: the share may be working correctly while the restriction intentionally prevents visibility.

Capture the reason and continue to the underlying configuration. “Sharing rule” is not yet the root cause. Identify the exact rule, target public group or role, the user's membership path, and whether its criteria still match the business requirement.

## Trace every record-level grant
{: #grant-map}

If the broad permissions do not explain access, work down this list.

### 1. Organization-wide defaults and ownership

Confirm both internal and external OWD where the object supports separate defaults. `Public Read/Write` or `Public Read Only` can make individual share rows irrelevant. For `Controlled by Parent`, inspect the parent's access model instead of debugging the child in isolation.

Confirm the current owner and recent ownership changes. Ownership itself grants access, and an owner can be a queue on supported objects. A stale ticket or screenshot that names the previous owner can send the investigation in the wrong direction.

### 2. Role hierarchy

Check whether the user is above the owner or above a user/group that received access. Standard objects grant upward access through the hierarchy. For custom objects, **Grant Access Using Hierarchies** can be disabled, so verify the object's setting rather than assuming all objects behave alike.

Roles should model record visibility, not simply mirror the organization chart. If an unexpected role relationship is the cause, assess all records affected before moving a user or role.

### 3. Sharing rules and nested group membership

Inspect owner-based and criteria-based sharing rules. Then expand the target completely:

- roles and subordinates;
- public groups;
- nested public groups;
- territories and subordinates where used;
- internal versus external groups.

The user's name does not need to appear in the rule. A group can contain another group, and a role-based target changes when the user moves roles. Document the membership chain that connects the user to the rule.

### 4. Teams, territories, and manual sharing

For Accounts, Opportunities, and Cases, inspect the supported team features. A default Account Team can add members when an Account is created or when a user applies it. Opportunity Teams can grant access independently of an owner-based rule.

If Enterprise Territory Management is active, inspect territory assignment and the access level configured for the object's territory model. Do not confuse a territory used for forecasting with a role used for management access.

Check the record's manual shares. They are record-specific and can be easy to overlook. Also record who created the share and whether an ownership change or automation should remove it.

### 5. Implicit access and parent-child relationships

Salesforce provides implicit sharing for some standard-object relationships. For example, access to a child Opportunity, Case, or Contact can provide implicit read access to its parent Account. Conversely, Account ownership can provide access to certain related records.

That means an Account investigation may need to start with a child record, while a Case investigation may need to include its parent Account. Implicit sharing does not apply to custom objects in the same way, so do not generalize this explanation to every lookup or master-detail relationship.

### 6. Apex managed sharing and package automation

Custom objects can have Apex sharing reasons, and code can create share rows on supported objects. Inspect triggers, Flows that invoke Apex, scheduled jobs, managed packages, and provisioning integrations that write share records or group membership.

Ask three operational questions: What creates the share? What removes it when the business relationship ends? What monitoring catches failures or stale grants? A perfectly valid share row can still be a security defect if its lifecycle has no revocation path.

## Query the evidence
{: #query-evidence}

Use Salesforce Inspector, Workbench, Developer Console, or another approved query tool with a user authorized to investigate security. Keep production IDs out of screenshots and public issue trackers.

### Check the user's computed access

`UserRecordAccess` answers whether one user has specific operations on a record:

```sql
SELECT RecordId,
       HasReadAccess,
       HasEditAccess,
       HasDeleteAccess,
       HasTransferAccess,
       MaxAccessLevel
FROM UserRecordAccess
WHERE UserId = '005000000000000'
  AND RecordId = '006000000000000'
```

This is useful for confirming the symptom and for regression checks, but it is not a full explanation of the grant. It also does **not** account for access blocked by a restriction rule. A result of `HasReadAccess = true` therefore does not prove the user can retrieve the record in a channel where a restriction rule applies.

### Inspect explicit share rows

For an Opportunity, query its share object:

```sql
SELECT UserOrGroupId,
       OpportunityAccessLevel,
       RowCause
FROM OpportunityShare
WHERE OpportunityId = '006000000000000'
```

For a custom object, the pattern is:

```sql
SELECT ParentId,
       UserOrGroupId,
       AccessLevel,
       RowCause
FROM Project__Share
WHERE ParentId = 'a00000000000000'
```

`RowCause` identifies why Salesforce created the row, such as owner, manual sharing, a rule, a team, or an Apex sharing reason. If `UserOrGroupId` points to a group, resolve the group and its nested membership rather than assuming it is a direct user grant.

Share-object queries are also not exhaustive. Broad permissions, public OWD, hierarchy access, and some implicit access are evaluated outside a simple explicit-share-row search. Use the query alongside Sharing Hierarchy, effective permissions, and configuration evidence.

## Avoid common false leads
{: #false-leads}

Several configurations affect presentation or working scope but are not record security boundaries.

| False lead | What it actually controls | Security implication |
|---|---|---|
| Page layout | Which UI components and fields are displayed on that layout | Hiding a field on a layout does not replace field-level security |
| Record type | Business process, picklist values, and page-layout assignment | It does not secure individual records |
| List-view filter | Which records the list returns | A user may still open any record allowed by sharing |
| Scoping rule | The default subset shown in supported list views, reports, and searches | It helps users focus; it does not restrict access |
| Search visibility | Which results appear in a search experience | Absence from search is not proof that the record is inaccessible |
| Sharing rule deletion | Removes one grant path | Another grant can preserve the same access |

Test direct record navigation, SOQL in the intended user context, edit/delete behavior, and the actual business channel. A record missing from a list view is not a negative security test. A record visible in a list view is not proof that every field and operation is allowed.

Field-level security is another separate layer. A user might legitimately open an Opportunity but should not see `Margin__c`. Fix that with field permissions, not by revoking all record access. Conversely, field access does not grant the underlying record.

## Account for restriction rules and code context
{: #restrictions-code}

Restriction rules filter records that users would otherwise receive through OWD or sharing. They are appropriate when a supported population must see a subset of already-granted records, such as contractors limited to records for their region.

During troubleshooting, remember:

- `UserRecordAccess` does not include restriction-rule filtering.
- Restriction rules do not apply to every object, edition, license, or execution context. Confirm current product support for the exact scenario.
- `View All Records`, `Modify All Records`, `View All Data`, and `Modify All Data` can override restrictions in the documented cases. Treat these as privileged grants.
- System-mode automation can behave differently from the standard user experience.

Custom Apex deserves a separate test. An Apex class can enforce record sharing or run with elevated record access depending on its sharing declaration and call chain. Record sharing alone also does not automatically prove CRUD and field-level security are enforced. Secure code should make its access model explicit and use appropriate user-mode operations or security checks for the task.

For an incident, compare two paths with the same persona:

1. Can the user open the standard Lightning record page?
2. Can the user obtain the same record only through a custom component, Flow, API, or Apex service?

If only the second succeeds, do not weaken OWD or add a restriction rule. Review that execution path, its integration user, Apex sharing declaration, CRUD/FLS enforcement, and returned fields. The defect may be data exposure by code rather than a Salesforce sharing calculation.

## Worked example: the East representative
{: #worked-example}

Return to the original incident: Opportunity OWD is Private, the West team owns the record, and an East representative can edit it.

### Evidence

- The representative's object summary shows Opportunity `Read` and `Edit`, but not `View All Records` or `Modify All Records`.
- Sharing Hierarchy reports access through a criteria-based sharing rule named **Open Strategic Deals to Deal Desk**.
- The rule shares Opportunities where `Strategic_Review__c = true` with the public group **Deal Desk Collaborators** as Read/Write.
- The East representative is not directly in that group. Their role is included in **Regional Sales Collaborators**, which is nested inside **Deal Desk Collaborators**.
- The representative temporarily helped Deal Desk three months ago. The nested group was never cleaned up.

### Root cause

Salesforce is honoring OWD. Private established the baseline, and the sharing rule correctly opened the record to its target. The security defect is stale nested-group membership, not the OWD setting or the sharing-rule engine.

### Narrow remediation

Remove the obsolete membership after approval from the business and group owner. Do not delete the sharing rule; active Deal Desk users still require it. Add an owner and expiry review for elevated group membership so temporary assignments do not become permanent.

### Verification

Test with four personas:

| Persona | Expected result after the fix |
|---|---|
| Opportunity owner | Can read and edit the record |
| West manager above the owner | Retains the designed hierarchy access |
| Active Deal Desk collaborator | Retains the sharing-rule access |
| East representative removed from the group | Cannot open the direct URL, query the record, or edit it |

Re-run `UserRecordAccess`, review Sharing Hierarchy, and test the standard and custom channels used by the representative. Also search for any second grant—such as team membership or a manual share—before closing the incident.

## Remediate the source and verify the boundary
{: #remediation}

Choose the narrowest correction that removes the unjustified access without breaking legitimate work:

- remove an obsolete user, role, territory, team, or group membership;
- narrow a sharing rule's criteria or target;
- replace `View All Records` with a purpose-specific sharing mechanism;
- remove an expired manual or Apex-managed share;
- correct share-lifecycle automation;
- add a supported restriction rule when the design truly requires filtering an already-granted population;
- correct the execution context and CRUD/FLS enforcement in custom code.

Avoid broad emergency changes unless the exposure is active and material. Changing OWD, reorganizing roles, or deleting a widely used rule can trigger recalculation and affect many users. If immediate containment is required, document the temporary control, approver, affected users, expiry time, rollback plan, and follow-up root-cause work.

Verification should include positive and negative cases:

1. **Positive access:** every persona that must work with the record can still read and update only the intended fields.
2. **Negative access:** the affected user cannot retrieve the record by direct URL, API/SOQL, report, list, search, related list, or custom UI where those paths apply.
3. **Operation checks:** test read, edit, delete, transfer, and share separately when relevant.
4. **Relationship checks:** test parent and child records for implicit access.
5. **Context checks:** test Lightning, Experience Cloud, integrations, Flow, and Apex services used by the business.
6. **Lifecycle checks:** prove the grant is added and removed when its business condition starts and ends.

Record the evidence, configuration owner, approved access matrix, test personas, and next review date. A good incident response explains not only why access existed today, but how the organization will prevent or detect the same stale grant later.

## Salesforce record-access incident checklist
{: #incident-checklist}

Use this compact runbook during a production investigation:

- [ ] Confirm the exact user, record, operation, channel, and time.
- [ ] Reproduce with the affected persona; do not use an administrator as the proxy.
- [ ] Review effective object and field permissions in **View Summary**.
- [ ] Check `View All Records`, `Modify All Records`, `View All Data`, and `Modify All Data`.
- [ ] Confirm internal/external OWD, owner, parent record, and recent ownership changes.
- [ ] Review **Sharing Hierarchy** and capture the stated reason.
- [ ] Trace roles, nested groups, sharing rules, teams, territories, manual shares, and implicit access.
- [ ] Query `UserRecordAccess` and the object's share rows; understand their limitations.
- [ ] Review restriction rules, Apex sharing, user/system execution context, and the integration user.
- [ ] Exclude page layouts, record types, list filters, and scoping rules as security boundaries.
- [ ] Correct the narrowest source of excess access.
- [ ] Test positive and negative personas in every relevant channel.
- [ ] Document evidence, approval, rollback, ownership, and the next access review.

Need help tracing an unexpected Salesforce grant in a production org? Contact SFX Support at [founders@sfxsupport.com](mailto:founders@sfxsupport.com), call [+91-9414849173](tel:+919414849173), or [message us on WhatsApp](https://wa.me/919414849173).

## Official Salesforce sources
{: #sources}

- [Who Has Access to Account Records?](https://help.salesforce.com/s/articleView?id=faq_record_access.htm&language=en_US&type=5)
- [View User Record Access](https://help.salesforce.com/s/articleView?id=platform.viewing_which_users_have_access_lex.htm&language=en_US&type=5)
- [Troubleshoot Object and Record Access Issues](https://help.salesforce.com/s/articleView?id=000232310&language=en_US&type=1)
- [Salesforce Platform Sharing Architecture](https://architect.salesforce.com/docs/architect/fundamentals/guide/platform-sharing-architecture)
- [UserRecordAccess Object Reference](https://developer.salesforce.com/docs/platform/field-reference/references/field-reference/salesforce-field-reference-userrecordaccess.html)
- [Object Permissions](https://help.salesforce.com/s/articleView?id=sf.users_profiles_object_perms.htm&language=en_US&type=5)
- [Restriction Rule Considerations](https://help.salesforce.com/s/articleView?id=sf.security_restriction_rule_considerations.htm&language=en_US&type=5)
- [Scoping Rules](https://help.salesforce.com/s/articleView?id=sf.security_scoping_rule.htm&language=en_US&type=5)
- [Control Who Sees What](https://help.salesforce.com/s/articleView?id=platform.security_data_access.htm&language=en_US&type=5)
- [Well-Architected: Trust](https://architect.salesforce.com/docs/architect/well-architected/guide/trust.html)
