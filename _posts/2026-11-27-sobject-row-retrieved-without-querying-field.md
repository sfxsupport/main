---
layout: blog-post
sfx_blog: true
featured: false
title: "SObject Row Retrieved Without Querying the Field: Fix"
seo_title: "SObject Row Retrieved Without Querying the Field: Fix"
description: "Fix SObject row was retrieved via SOQL without querying the requested field by selecting the missing field on the record your Apex code reads."
date: 2026-11-27 10:58:00 +0530
last_modified_at: 2026-11-27 10:58:00 +0530
permalink: /blog/sobject-row-retrieved-without-querying-field/
primary_category: "Salesforce Troubleshooting"
series: "Apex runtime errors"
categories:
  - salesforce-ai
tags:
  - SObject row was retrieved via SOQL without querying the requested field
  - Salesforce Apex
  - SOQL
  - Apex runtime errors
  - Visualforce
  - Salesforce debugging
reading_time: "9 min read"
og_type: article
author_name: "Abhay Nama"
author_url: "https://www.linkedin.com/in/abhay-nama-0739793a7/"
image: /assets/images/blog/sobject-row-retrieved-without-querying-field.jpg
image_alt: "Salesforce Apex SOQL query showing a missing field and its fix"
proficiency: "Intermediate"
answer: "This error means Apex tried to read a field that was not loaded on a particular SOQL record. Usually, the field or relationship path is missing from that record’s SELECT list. Find the failing access and the query that produced that exact instance, then select the required field and test the affected callers."
faq:
  - q: "Why do I get this error when the field has a value in Salesforce?"
    a: "A database value does not automatically populate every Apex record instance. Add the field to the SELECT list of the query that produced the instance your code reads."
  - q: "Does selecting AccountId also load Account.Name?"
    a: "No. Select Account.Name explicitly when Apex needs to read the parent Account’s name."
  - q: "Why does a Visualforce extension throw this error without an explicit SOQL query?"
    a: "A standard controller loads fields based on the page and its controller configuration. Reference the field in the page, use addFields before loading for a dynamic Visualforce binding, or use an explicit query."
  - q: "Can I use FIELDS(ALL) to fix the error in Apex?"
    a: "No. Salesforce does not support FIELDS(ALL) or FIELDS(CUSTOM) in Apex SOQL. Select the fields your code needs."
  - q: "Does getPopulatedFieldsAsMap show every field selected by SOQL?"
    a: "No. Queried fields with null values can be absent from the map, so it is not a definitive list of selected fields."
extra_css:
  - /assets/css/blog.css
toc:
  - id: meaning
    label: "What the error means"
  - id: causes
    label: "Common causes"
  - id: fix
    label: "How to fix it"
  - id: code
    label: "Apex example and tests"
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

Apex developers usually see this exception in a debug log, test failure, or Visualforce page. It can also reach a Flow, API client, LWC, Agentforce action, or deployment test result when that operation invokes the failing Apex.

## What does “SObject row was retrieved via SOQL without querying the requested field” mean?
{: #meaning}

Apex tried to read a field that was not loaded on the particular record instance it received. Add the field—or the full relationship path—to the query that produced that instance.

In the example above, the suffix `Case.Status` identifies the unavailable field. The value may exist in the database, but a SOQL result contains the fields selected for that result; a separate query for the same record does not fill in an earlier instance. Formula fields must also be selected before Apex reads them.

**Fast diagnosis:** Find the first relevant line in the stack trace, identify the variable being read there, and trace that variable back to its source. Compare every field read by that code with the source query’s `SELECT` list. If the source is a Visualforce standard controller, check its loaded fields instead of looking only for an explicit query.

A catch block may log the message without the `System.SObjectException` prefix. The field named at the end is still the useful starting point.

## Why do I get “SObject row was retrieved via SOQL without querying the requested field”?
{: #causes}

The immediate cause is a field access on a record that does not have that field loaded. These are practical places to investigate; Salesforce does not publish incidence data establishing their frequency.

| Cause | How to confirm | Fix |
| --- | --- | --- |
| Field omitted from `SELECT` | Compare the failing field with the query that created the instance. | Select the field, including any formula field the code reads. |
| Parent relationship field omitted | The query selects `AccountId`, but the code reads `Account.Name`. | Select the complete path, such as `Account.Name`. |
| Visualforce standard controller did not load a field | An extension reads a field from `getRecord()` that is not referenced or added to the controller. | Reference it in the page or query explicitly; for a dynamic Visualforce binding, `addFields()` is also an option. |
| Dynamic query or binding omitted a field | Inspect the final generated query or dynamic field name used at runtime. | Include the required field in the actual query or, for a dynamic Visualforce binding, add it to the standard controller. |
| A different partial record reached a helper, batch, or test | Trace the failing instance through its callers, not just another query for the same ID. | Update each caller’s field list or bulk-requery the necessary records. |

The [Salesforce SOQL results guide](https://developer.salesforce.com/docs/platform/apex-dev/references/apex-dev/langcon-apex-soql-working-with-results.html) describes working with queried records.

## How do I fix “SObject row was retrieved via SOQL without querying the requested field”?
{: #fix}

Start at the failing read, then correct the source of that specific record. Run the failing path again and check for other fields read by the same helper.

1. **Find the field and line.** In a development org, open **Setup → Debug Logs**, create a trace flag for the user running the operation, and reproduce it. Open the resulting log and find the exception and stack trace. A test failure may show the relevant class and line directly.

2. **Trace the record instance.** At that line, identify the variable before the field access. Follow it through method parameters, collections, batch scope, or controller calls until you find where it was queried or loaded. A test might construct one partial record while production code uses a different query.

3. **Add the field to the source query.** If the code reads `caseRecord.Status`, include `Status` in the query that populated `caseRecord`. Check all branches and helpers that consume the result. Use the field’s API name, not its label: find it under **Setup → Object Manager → Case → Fields & Relationships**.

4. **Select the full relationship path.** Selecting `AccountId` loads the ID, not the parent’s name. Select `Account.Name` if code reads it. For a custom lookup, use the relationship name and field, such as `Ticket__r.SomeField__c`; confirm the relationship name in the lookup field’s details. Also handle a null lookup before dereferencing the parent.

5. **Check Visualforce and dynamic fields.** In **Setup → Visualforce Pages**, inspect the page and its extension; in **Setup → Apex Classes**, inspect the extension code. A standard controller loads fields referenced by the page. For an extension-only field, reference it in markup, including a hidden component if appropriate, or issue an explicit query. For dynamic Visualforce bindings, `addFields()` can add fields before the controller loads the record. Dynamic field names must be included in the actual query or, for a dynamic Visualforce binding, the controller field list. Log generated field names cautiously: avoid exposing sensitive record data.

6. **Retest the actual callers.** Cover the original entry point and any other caller passing records to the same helper. If a requery is needed, collect IDs and retrieve records in one query outside loops. Make sure the replacement records, rather than the original partial instances, reach the helper.

For a standard controller used with a dynamic Visualforce binding, the ordering matters. This extension adds `Status` before retrieving the record:

```apex
public with sharing class CasePageExtension {
    public Case caseRecord { get; private set; }
    public String fieldName { get; private set; }

    public CasePageExtension(ApexPages.StandardController controller) {
        fieldName = 'Status';
        controller.addFields(new List<String>{ fieldName });
        caseRecord = (Case) controller.getRecord();
    }
}
```

A page using this extension can reference the field dynamically:

```html
<apex:page standardController="Case" extensions="CasePageExtension">
    <apex:outputText value="{!caseRecord[fieldName]}" />
</apex:page>
```

Salesforce documents `addFields()` for controllers used by dynamic Visualforce bindings. Call it before the record is loaded. If calling it outside the constructor, call `reset()` directly before `addFields()`; **reset discards pending changes**. `addFields()` affects the standard controller’s record, not a separate SOQL query written in the extension. An Apex test that constructs a standard controller with an in-memory record can fail when it calls `addFields()`; account for that behavior when designing the test instead of skipping the production path. See the [StandardController reference](https://developer.salesforce.com/docs/platform/apex-ref/references/apex-ref/apex-pages-standardcontroller.html) and [dynamic Visualforce guidance](https://developer.salesforce.com/docs/platform/salesforce-pages-developers-guide/guide/pages-dynamic-vf-sample-standard.html).

A field-access failure is a separate concern from selecting the field. Check the intended user’s object and field access, and the query’s execution mode. Salesforce documents version-dependent database operation defaults, including user-mode defaults starting with API version 67.0; verify the version and explicit access mode in the code you are changing. See [versioned behavior changes](https://developer.salesforce.com/docs/platform/apex-ref/references/apex-ref/versioned-behavior-changes.html). Do not grant broader access solely to silence the exception.

## What Apex code fixes the missing SOQL field?
{: #code}

The broken example reads `Industry` after selecting only `Id` and `Name`. The fixed class selects `Industry` on the same Account instances it returns, and its test verifies both a populated and a null value.

**Bad pattern:**

```apex
Account accountRecord = [
    SELECT Id, Name
    FROM Account
    LIMIT 1
];

// Throws if a record is returned: Industry was not selected.
String industry = accountRecord.Industry;
```

**Fixed pattern:** Save this as `AccountFieldReader.cls`.

```apex
public with sharing class AccountFieldReader {
    public static List<Account> loadAccounts(Set<Id> accountIds) {
        if (accountIds == null || accountIds.isEmpty()) {
            return new List<Account>();
        }

        return [
            SELECT Id, Name, Industry
            FROM Account
            WHERE Id IN :accountIds
            WITH USER_MODE
        ];
    }

    public static Map<Id, String> industriesById(Set<Id> accountIds) {
        Map<Id, String> industries = new Map<Id, String>();

        for (Account accountRecord : loadAccounts(accountIds)) {
            industries.put(accountRecord.Id, accountRecord.Industry);
        }

        return industries;
    }
}
```

The helper accepts a set of IDs and performs one query for the set. `WITH USER_MODE` enforces the running user’s record, object, and field access; the query returns matching records visible to that user and can fail if the user lacks access to a queried object or field. Run the example and its test as a user with read access to Account, `Name`, and `Industry`.

Save this as `AccountFieldReaderTest.cls`:

```apex
@IsTest
private class AccountFieldReaderTest {
    @IsTest
    static void readsSelectedIndustryIncludingNull() {
        Account populated = new Account(
            Name = 'Field Reader Populated',
            Industry = 'Technology'
        );
        Account blank = new Account(
            Name = 'Field Reader Blank'
        );
        insert new List<Account>{ populated, blank };

        Test.startTest();
        Map<Id, String> result = AccountFieldReader.industriesById(
            new Set<Id>{ populated.Id, blank.Id }
        );
        Test.stopTest();

        System.assertEquals(2, result.size(), 'Both accounts should be returned');
        System.assertEquals(
            'Technology',
            result.get(populated.Id),
            'The selected industry should be available'
        );
        System.assert(
            result.containsKey(blank.Id),
            'The account with a null industry should still be returned'
        );
        System.assertEquals(null, result.get(blank.Id));
    }

    @IsTest
    static void handlesEmptyInput() {
        Test.startTest();
        Map<Id, String> result = AccountFieldReader.industriesById(
            new Set<Id>()
        );
        Test.stopTest();

        System.assertEquals(0, result.size(), 'Empty input should return no rows');
    }

    @IsTest
    static void handlesNullInput() {
        Test.startTest();
        Map<Id, String> result = AccountFieldReader.industriesById(null);
        Test.stopTest();

        System.assertEquals(0, result.size(), 'Null input should return no rows');
    }
}
```

The test creates its own data and asserts the returned values. Org-specific validation rules or automation can require additional test data. This example has not been tested in your org.

## How can I reproduce the SOQL missing-field error safely?
{: #reproduce}

Use a Developer Edition org and test data to reproduce the exception without changing production records. The following anonymous Apex catches the expected exception so you can inspect its message.

1. In Lightning Experience, open **Setup gear icon → Developer Console**, then **Debug → Open Execute Anonymous Window**.
2. Run the following code. It inserts a temporary Account, queries a partial instance, and rolls the insert back.
3. Open the execution log and search for `EXPECTED`.

```apex
Savepoint checkpoint = Database.setSavepoint();

try {
    Account created = new Account(
        Name = 'SOQL Missing Field Reproduction',
        Industry = 'Technology'
    );
    insert created;

    Account partialAccount = [
        SELECT Id, Name
        FROM Account
        WHERE Id = :created.Id
    ];

    try {
        System.debug(partialAccount.Industry);
        System.debug('Unexpected: no exception was thrown');
    } catch (System.SObjectException expected) {
        System.debug('EXPECTED: ' + expected.getMessage());
    }
} finally {
    Database.rollback(checkpoint);
}
```

The logged message should identify `Account.Industry`. To verify the fix, add `Industry` to that query’s `SELECT` list and run the code again: the value should be logged instead of the expected exception. Validation rules and automation in an org can affect the insert; use a clean Developer Edition or adapt the test record to its requirements.

## How do I prevent this Apex SOQL error?
{: #prevent}

Treat the fields a method reads as part of its input contract. Keep each caller’s query aligned with that contract and test the paths that supply records.

- Review field reads in helpers, formulas, relationship traversals, serializers, and page extensions when changing a query. A formula field is still a field that must be selected.
- For dynamic SOQL, compare the final generated field list with the names passed to `get()` or used by downstream code. Validate dynamic field names against an allowed set.
- Test both populated and null values. Do not use `getPopulatedFieldsAsMap()` as a definitive query checklist: queried null fields can be absent from the map. See the [SObject methods reference](https://developer.salesforce.com/docs/platform/apex-ref/references/apex-ref/apex-methods-system-sobject.html).
- Bulkify any necessary requery. The normal per-transaction SOQL limits are **100 synchronous and 200 asynchronous**, with documented exceptions. See [Apex governor limits](https://developer.salesforce.com/docs/platform/apex-dev/references/apex-dev/apex-gov-limits.html).
- Select needed fields explicitly. Salesforce does not support `FIELDS(ALL)` or `FIELDS(CUSTOM)` in Apex SOQL; other supported query contexts have bounded-result requirements. See the [FIELDS reference](https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-fields.html).

If adding queries exposes a separate limit problem, use the [Salesforce Too Many SOQL Queries 101 diagnosis and fix](/blog/salesforce-too-many-soql-queries-101/). For choices about where the automation should live, see [Flow or Apex?](/blog/salesforce-flow-vs-apex-decision-guide/).

Need this fixed in your org? [SFX can build it](/services/) with a written scope and fixed quote.

## What related Salesforce errors should I check?
{: #related-errors}

These errors have different causes, so check the exception type before applying the missing-field fix.

### No rows for assignment to an SObject

```text
System.QueryException: List has no rows for assignment to SObject
```

**Cause:** A single-record assignment received no rows.

**Fix:** Use a list when zero results are expected and handle the empty result.

### More than one row for assignment to an SObject

```text
System.QueryException: List has more than 1 row for assignment to SObject
```

**Cause:** A single-record assignment received multiple rows.

**Fix:** Refine the filter or handle a list.

### Query too complicated

```text
QUERY_TOO_COMPLICATED
```

**Cause:** The query may exceed Salesforce’s query complexity constraints.

**Fix:** Review and simplify the query; see [SOQL and SOSL limits](https://developer.salesforce.com/docs/platform/salesforce-app-limits-cheatsheet/guide/salesforce-app-limits-platform-soslsoql.html).

See Salesforce’s [built-in exception reference](https://developer.salesforce.com/docs/platform/apex-dev/references/apex-dev/apex-exception-builtin.html) for exception types.

## Which official Salesforce sources explain this error?
{: #official-sources}

These references cover record access, standard controllers, query options, and limits:

- [Working with SOQL query results](https://developer.salesforce.com/docs/platform/apex-dev/references/apex-dev/langcon-apex-soql-working-with-results.html)
- [StandardController methods](https://developer.salesforce.com/docs/platform/apex-ref/references/apex-ref/apex-pages-standardcontroller.html)
- [Dynamic Visualforce bindings with standard controllers](https://developer.salesforce.com/docs/platform/salesforce-pages-developers-guide/guide/pages-dynamic-vf-sample-standard.html)
- [SOQL FIELDS function](https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-fields.html)
- [Apex governor limits](https://developer.salesforce.com/docs/platform/apex-dev/references/apex-dev/apex-gov-limits.html)

## Solution kit
{: #solution-kit}

Add the two classes above and their metadata files to an existing Salesforce CLI project. Use a Developer Edition org for the example, and replace `my-dev-org` with your authorised org alias.

```text
force-app/main/default/classes/AccountFieldReader.cls
force-app/main/default/classes/AccountFieldReader.cls-meta.xml
force-app/main/default/classes/AccountFieldReaderTest.cls
force-app/main/default/classes/AccountFieldReaderTest.cls-meta.xml
```

Use this content for **each** of the two `.cls-meta.xml` files:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>66.0</apiVersion>
    <status>Active</status>
</ApexClass>
```

From the project root, deploy these two classes and run the test:

```bash
sf project deploy start \
  --source-dir force-app/main/default/classes/AccountFieldReader.cls \
  --source-dir force-app/main/default/classes/AccountFieldReaderTest.cls \
  --target-org my-dev-org
```

```bash
sf apex run test \
  --class-names AccountFieldReaderTest \
  --result-format human \
  --wait 10 \
  --target-org my-dev-org
```

If the test is still running when the wait expires, use the returned test run ID to retrieve the result. The [Salesforce CLI test reference](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_apex_run_test.html) documents the command and required permissions.
