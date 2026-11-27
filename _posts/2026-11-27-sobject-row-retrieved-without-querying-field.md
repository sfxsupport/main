---
layout: blog-post
sfx_blog: true
featured: false
title: "SObject Row Retrieved Without Querying the Field: Fix"
seo_title: "SObject Row Retrieved Without Querying Field: Fix"
description: "Fix SObject row was retrieved via SOQL without querying the requested field by adding the missing field to the query for the failing record."
date: 2026-11-27 10:10:00 +0530
last_modified_at: 2026-11-27 10:10:00 +0530
permalink: /blog/sobject-row-retrieved-without-querying-field/
primary_category: "Salesforce Troubleshooting"
series: "Apex runtime errors"
categories:
  - salesforce-ai
tags:
  - SObject row was retrieved via SOQL without querying the requested field
  - Apex
  - SOQL
  - Salesforce troubleshooting
  - Visualforce
  - Salesforce development
reading_time: "9 min read"
og_type: article
author_name: "Abhay Nama"
author_url: "https://www.linkedin.com/in/abhay-nama-0739793a7/"
image: /assets/images/blog/sobject-row-retrieved-without-querying-field.jpg
image_alt: "Salesforce Apex SOQL missing field error and query fix"
proficiency: "Intermediate"
answer: "This exception means Apex tried to read a field that was not loaded on the specific sObject record being accessed. The usual cause is a missing field or relationship path in the SOQL SELECT list. Trace that record to its query, add the required fields, and rerun the failing operation and tests."
faq:
  - q: "How can I check whether an sObject field was loaded in Apex?"
    a: "Use the sObject isSet() method to check whether a field was selected by a SOQL query or assigned on that instance. It does not check whether the current user has permission to access the field."
  - q: "Why does this error occur when the field has a value in Salesforce?"
    a: "A value in the database does not mean the field was loaded into a particular Apex sObject instance. The SOQL query must select the field before the code reads it."
  - q: "Does selecting AccountId also load Account.Name?"
    a: "No. AccountId loads the lookup ID; select Account.Name separately to read the parent account's name."
  - q: "How do I fix this error in a Visualforce standard controller extension?"
    a: "For a static field, reference it in the page markup or explicitly query it in the extension. For dynamic bindings using the standard controller's default query, call addFields before the record loads."
  - q: "Can I use FIELDS(ALL) to fix the error in Apex?"
    a: "No. Salesforce does not support FIELDS(ALL) or FIELDS(CUSTOM) in Apex SOQL. Select the fields your code needs explicitly."
extra_css:
  - /assets/css/blog.css
toc:
  - id: meaning
    label: "What the error means"
  - id: causes
    label: "Common causes"
  - id: fix
    label: "Step-by-step fixes"
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
System.SObjectException: SObject row was retrieved via SOQL without querying the requested field: Case.Status
```

This Apex runtime exception can appear in a debug log, test failure, or Visualforce page. Developers and admins may also see it surfaced by a Flow, API call, LWC, Agentforce action, or deployment test when that operation invokes failing Apex.

## What does “SObject row was retrieved via SOQL without querying the requested field” mean?
{: #meaning}

Apex tried to read a field that was not loaded on the particular sObject instance it received. In the example above, the unavailable field is `Case.Status`: find the code that reads it and the query that produced **that Case instance**.

For a quick fix, add the missing field to that query’s `SELECT` list. If the code reads a parent field, select the full path, such as `Account.Name`, rather than only `AccountId`.

A field can have a value in Salesforce and still be unavailable on a partial query result. A queried field whose value is null is different: it was selected and can be read; its value is simply null. The exception can also appear without the `System.SObjectException` prefix when code catches and logs only the message.

## Why do I get “SObject row was retrieved via SOQL without querying the requested field”?
{: #causes}

The usual cause is a missing field in the query that produced the failing record. Relationship paths, controller-managed queries, and records passed between methods make the source less obvious.

This table is a practical troubleshooting order, not a measured frequency ranking; Salesforce does not publish incidence data for these causes.

| Cause | How to confirm | Fix |
| --- | --- | --- |
| Field omitted from `SELECT` | Compare the exception suffix and failing line with the query that loaded that instance. | Select the field, including formula fields that code reads. |
| Parent field omitted | The query selects `AccountId`, but code reads `Account.Name`. | Select the full relationship path. |
| Visualforce standard controller did not load a field | An extension reads `getRecord()`, but its field is absent from page markup. | Reference the static field in markup or query it explicitly. For dynamic bindings, use `addFields()`. |
| Dynamic query or binding omits a field | Compare the final runtime field list with the `get()` call or dynamic page binding. | Add the field or path to the generated query, or use `addFields()` for a dynamic standard-controller binding. |
| A different partial record reaches a helper, batch, or test | Trace the exact record through callers; another query may select the field but return a different instance. | Update each caller’s query or bulk-requery by ID before reading. |

## How do I fix “SObject row was retrieved via SOQL without querying the requested field”?
{: #fix}

Start with the exception’s field suffix and stack-trace line, then follow the affected record back to where it was loaded. Change that record’s source, verify field access, and rerun the original failing path.

### 1. Find the field and the query

In **Setup → Debug Logs**, add a trace flag for the user running the failing operation, reproduce it, and open the resulting log. Find the exception and the Apex stack trace. If a test failed during deployment, inspect the test failure details and stack trace instead.

At the reported line, identify the variable being read. Follow it through method parameters, collections, batch inputs, and caller queries. If the suffix says `Case.Status`, look for a read of `Status` on that Case. Add `Status` to the `SELECT` list that created that instance.

If you need to confirm a custom field’s API name, open **Setup → Object Manager → the object → Fields & Relationships**, then open the field. Use its API name in the query, not its display label. A formula field must also be selected if Apex reads it.

### 2. Select the relationship path

Selecting a lookup ID does not load its parent’s fields. For example, a Contact query used by code reading both the lookup and parent name needs both fields:

```sql
SELECT Id, AccountId, Account.Name
FROM Contact
```

For a custom relationship, a read such as `Ticket__r.Subject__c` requires that relationship path in the query. Confirm the relationship name in the lookup field’s details under **Setup → Object Manager → the child object → Fields & Relationships**.

If no parent is assigned, reading a selected relationship expression such as `contact.Account.Name` as a value returns null; handle that result as needed. Assigning through a null relationship can throw a `NullPointerException`. See [Salesforce’s relationship field guidance](https://developer.salesforce.com/docs/platform/apex-dev/references/apex-dev/langcon-apex-sobjects-field-relationships.html).

### 3. Fix a Visualforce standard controller

If an extension gets its record from `ApexPages.StandardController.getRecord()`, there may be no SOQL statement in your extension to edit. The standard controller loads fields referenced by the page’s markup.

For a static field used only by the extension, add a reference to the page, or have the extension explicitly query the record with the fields it needs. Salesforce documents this hidden reference pattern:

```xml
<apex:outputText value="{!Case.Status}" rendered="false"/>
```

Place it inside the page using the Case standard controller. Check the actual page and extension in **Setup → Visualforce Pages** and **Setup → Apex Classes**.

For a **dynamic Visualforce binding** using the standard controller’s default query, add fields before the record loads, normally in the extension constructor:

```apex
public CaseExtension(ApexPages.StandardController controller) {
    if (!Test.isRunningTest()) {
        controller.addFields(new List<String>{ 'Status' });
    }
    Case currentCase = (Case) controller.getRecord();
}
```

The guard allows tests to instantiate a standard controller with an in-memory record. In those tests, supply `Status` on the Case passed to the controller; the guard does not load the field for you.

If you must add dynamic fields later, Salesforce requires `reset()` immediately before `addFields()`. Resetting discards pending changes to the controller record, so do not use it casually on an edit page. `addFields()` changes the standard controller’s default query; it does **not** change a SOQL query written in your extension. See the [StandardController reference](https://developer.salesforce.com/docs/platform/apex-ref/references/apex-ref/apex-pages-standardcontroller.html) and [dynamic Visualforce guidance](https://developer.salesforce.com/docs/platform/salesforce-pages-developers-guide/guide/pages-dynamic-vf-sample-standard.html).

### 4. Check dynamic queries and passed records

For dynamic SOQL, inspect the final field list generated for the failing request and compare it with every later `get()` or relationship read. Build the list from trusted, validated field names; bind user-supplied values rather than concatenating them into query conditions.

If a helper accepts an sObject, document its required fields and update **every caller** that supplies queried records. If callers cannot guarantee those fields, collect the record IDs and query the required fields once outside loops. Use the newly queried instances in the helper.

A query elsewhere that includes the field does not populate an already existing instance. Likewise, a test’s inserted record and a later, separately queried record are different instances.

### 5. Check permissions and rerun

Adding a field can expose a separate permission error. Confirm the running user has the necessary object and field access in **Setup → Permission Sets → the relevant permission set → Object Settings → the object**. Change access only when the user’s role requires it.

User-mode queries enforce object and field permissions. Database operations default to user mode for code compiled at API version 67.0 and later; older code can have different defaults. Check the class API version and intended access model instead of switching to elevated access simply to suppress an error. See [Salesforce’s version 67.0 release guidance](https://developer.salesforce.com/blogs/2026/06/the-salesforce-developers-guide-to-the-summer-26-release).

Rerun the exact failing operation and its tests, including the affected user context and any path that passes a different partial record.

## What Apex code fixes a missing SOQL field?
{: #code}

The bad pattern selects a Contact’s lookup ID but then reads a parent field that was not selected. The fixed class selects both the lookup and the parent name, and handles Contacts without an Account.

The following is a **bad pattern for illustration**. Do not deploy it as the fix:

```apex
List<Contact> contacts = [
    SELECT Id, AccountId
    FROM Contact
    WHERE AccountId != null
    LIMIT 1
];

if (!contacts.isEmpty()) {
    // AccountId does not load Account.Name.
    System.debug(contacts[0].Account.Name);
}
```

Create `ContactAccountReader.cls` with this fixed implementation:

```apex
public with sharing class ContactAccountReader {
    public static Map<Id, String> accountNames(Set<Id> contactIds) {
        Map<Id, String> namesByContact = new Map<Id, String>();

        if (contactIds == null || contactIds.isEmpty()) {
            return namesByContact;
        }

        for (Contact contact : [
            SELECT Id, AccountId, Account.Name
            FROM Contact
            WHERE Id IN :contactIds
            WITH USER_MODE
        ]) {
            String accountName = contact.AccountId == null
                ? null
                : contact.Account.Name;
            namesByContact.put(contact.Id, accountName);
        }

        return namesByContact;
    }
}
```

The method returns one map entry per accessible, matching Contact. A Contact without an Account has a null value; an ID that is not returned by the query has no map entry. The query runs once for the supplied set, not once per Contact. `WITH USER_MODE` makes the intended access enforcement explicit.

Create `ContactAccountReaderTest.cls` with these tests. The first test reproduces the missing relationship field and checks the fixed result; the second checks the null relationship and empty and null inputs.

```apex
@IsTest
private class ContactAccountReaderTest {
    @IsTest
    static void missingParentFieldAndFixedQuery() {
        Account account = new Account(Name = 'Example Account');
        insert account;

        Contact contact = new Contact(
            LastName = 'Example Contact',
            AccountId = account.Id
        );
        insert contact;

        Contact partial = [
            SELECT Id, AccountId
            FROM Contact
            WHERE Id = :contact.Id
        ];

        Boolean exceptionSeen = false;
        try {
            String ignored = partial.Account.Name;
        } catch (System.SObjectException ex) {
            exceptionSeen = true;
            System.assert(
                ex.getMessage().contains('without querying'),
                'Expected the missing queried field message.'
            );
        }
        System.assert(exceptionSeen, 'The partial record should fail.');

        Test.startTest();
        Map<Id, String> result = ContactAccountReader.accountNames(
            new Set<Id>{ contact.Id }
        );
        Test.stopTest();

        System.assertEquals(1, result.size());
        System.assertEquals('Example Account', result.get(contact.Id));
    }

    @IsTest
    static void handlesContactWithoutAccountAndEmptyInput() {
        Contact contact = new Contact(LastName = 'No Account');
        insert contact;

        Test.startTest();
        Map<Id, String> result = ContactAccountReader.accountNames(
            new Set<Id>{ contact.Id }
        );
        Map<Id, String> emptyResult = ContactAccountReader.accountNames(
            new Set<Id>()
        );
        Map<Id, String> nullResult = ContactAccountReader.accountNames(null);
        Test.stopTest();

        System.assert(result.containsKey(contact.Id));
        System.assertEquals(null, result.get(contact.Id));
        System.assertEquals(0, emptyResult.size());
        System.assertEquals(0, nullResult.size());
    }
}
```

These examples use standard Account and Contact fields. They have not been run in an org for this article; validation rules, automation, and user permissions in your org can require changes to test data or access.

## How can I reproduce the SOQL missing-field error safely?
{: #reproduce}

Use a Developer Edition org and the test class above. The test creates its own records, catches the expected exception, and asserts that the corrected query returns the parent name.

1. Create the two class files and their metadata files listed in the solution kit.
2. Authenticate a Developer Edition org with Salesforce CLI and give it the alias `dev-ed`.
3. From the Salesforce project directory, run the deployment and test commands in the solution kit.
4. Confirm the test passes. The caught exception demonstrates the bad query; the assertion on `Example Account` verifies the fixed query.

If the test fails before reaching the assertions, inspect its failure details for org-specific validation, automation, or permissions. Do not reproduce the failure against production records.

## How do I prevent this SOQL missing-field error?
{: #prevent}

Treat each query’s selected fields as part of the contract between the caller and the code that reads the result. Test that contract wherever records cross a method or component boundary.

- Review direct fields, formula fields, and relationship paths whenever a helper gains a new field read.
- Test the actual queried instance, including records with and without optional parent relationships.
- Keep queries outside loops. Salesforce’s usual per-transaction SOQL limits are 100 for synchronous Apex and 200 for asynchronous Apex, with documented exceptions; see [Apex governor limits](https://developer.salesforce.com/docs/platform/apex-dev/references/apex-dev/apex-gov-limits.html).
- Select the fields required by the use case. `FIELDS(ALL)` and `FIELDS(CUSTOM)` are not supported in Apex SOQL; see the [FIELDS reference](https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-fields.html).
- Do not use `getPopulatedFieldsAsMap()` as a definitive list of queried fields: queried null fields can be absent. See the [sObject reference](https://developer.salesforce.com/docs/platform/apex-ref/references/apex-ref/apex-methods-system-sobject.html).
- Test user-mode access with a representative user when the code is intended to respect that user’s permissions.

If a bulk requery causes a query-limit failure, use the [SOQL 101 production diagnosis guide](/blog/salesforce-too-many-soql-queries-101/) to trace queries across the transaction. For more on collection-based queries and transaction-wide debugging, see the [Apex trigger troubleshooting guide](/blog/salesforce-apex-trigger-interview-questions-6-years-experience/).

## What errors are related to a missing SOQL field?
{: #related-errors}

These errors need different fixes, even though they can occur near the same query.

### No rows for assignment

```text
System.QueryException: List has no rows for assignment to SObject
```

**Cause:** A query assigned to a single sObject found no matching row.

**Fix:** Check the filter, or query into a list and handle an empty result.

### Multiple rows for assignment

```text
System.QueryException: List has more than 1 row for assignment to SObject
```

**Cause:** A query assigned to a single sObject found multiple rows.

**Fix:** Correct the filter or query into a list and handle the results.

### Query too complicated

```text
QUERY_TOO_COMPLICATED
```

**Cause:** The query may be too complex.

**Fix:** Review the generated query and the relevant [SOQL limits](https://developer.salesforce.com/docs/platform/salesforce-app-limits-cheatsheet/guide/salesforce-app-limits-platform-soslsoql.html).

## Which official Salesforce sources explain this error?
{: #official-sources}

Salesforce’s references cover the controller behavior, field selection, security, and limits used in this fix:

- [Built-in Apex exceptions](https://developer.salesforce.com/docs/platform/apex-dev/references/apex-dev/apex-exception-builtin.html)
- [StandardController class](https://developer.salesforce.com/docs/platform/apex-ref/references/apex-ref/apex-pages-standardcontroller.html) and [dynamic Visualforce bindings](https://developer.salesforce.com/docs/platform/salesforce-pages-developers-guide/guide/pages-dynamic-vf-sample-standard.html)
- [SOQL FIELDS function](https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-fields.html)
- [Apex governor limits](https://developer.salesforce.com/docs/platform/apex-dev/references/apex-dev/apex-gov-limits.html)
- [Salesforce CLI deployment](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_project_deploy_start.html) and [Apex test commands](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_apex_run_test.html)

Need this fixed in your org? [SFX can build it](/services/) with a written scope and fixed quote.

## Solution kit
{: #solution-kit}

Add the following four files to an existing Salesforce DX project. Copy the two Apex classes from the code section above.

```text
force-app/main/default/classes/ContactAccountReader.cls
force-app/main/default/classes/ContactAccountReader.cls-meta.xml
force-app/main/default/classes/ContactAccountReaderTest.cls
force-app/main/default/classes/ContactAccountReaderTest.cls-meta.xml
```

Use this same metadata content for **each** `.cls-meta.xml` file. API version 67.0 requires an org that supports it.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>67.0</apiVersion>
    <status>Active</status>
</ApexClass>
```

With the Developer Edition org authenticated as `dev-ed`, run these commands from the project root:

```bash
sf project deploy start \
  --source-dir force-app/main/default/classes/ContactAccountReader.cls \
  --source-dir force-app/main/default/classes/ContactAccountReaderTest.cls \
  --target-org dev-ed

sf apex run test \
  --class-names ContactAccountReaderTest \
  --target-org dev-ed \
  --result-format human \
  --wait 10
```

If the test command returns a test run ID before results are ready, use the [CLI test result command](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_apex_get_test.html), replacing the placeholder with that ID:

```bash
sf apex get test --test-run-id <test-run-id> --target-org dev-ed
