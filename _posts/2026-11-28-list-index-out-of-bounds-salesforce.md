---
layout: blog-post
sfx_blog: true
featured: false
title: "List Index Out of Bounds: 0 in Apex: Cause and Fix"
seo_title: "List Index Out of Bounds: 0: Apex Fix"
description: "Fix List index out of bounds: 0 in Salesforce Apex by finding the empty list, checking the query, and handling missing records safely."
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
reading_time: "10 min read"
og_type: article
author_name: "Abhay Nama"
author_url: "https://www.linkedin.com/in/abhay-nama-0739793a7/"
image: /assets/images/blog/list-index-out-of-bounds-salesforce.jpg
image_alt: "SFX Salesforce Troubleshooting banner showing the error: System.ListException: List index out of bounds: 0"
proficiency: "Intermediate"
answer: "System.ListException: List index out of bounds: 0 means Apex tried to read the first element of an empty list. A SOQL query returning no rows is the most common cause. Find the list at the failing line, check why it is empty, and handle the zero-result case before accessing index 0."
faq:
  - q: "What does List index out of bounds: 0 mean in Apex?"
    a: "Apex tried to access index 0 in a list that has no elements. Check the specific list at the line named in the stack trace."
  - q: "How do I fix List index out of bounds: 0 after a SOQL query?"
    a: "Check whether the query returned any rows before accessing the first result. Also check its filters, bind values, data, and execution context; decide what the application should do when no record exists."
  - q: "Why does List index out of bounds: 0 occur in an Apex test?"
    a: "The test may not create a record that matches the query, or the record may lack a required relationship or field value. Create matching test data and add a separate assertion for the no-match path."
  - q: "Does LIMIT 1 prevent List index out of bounds: 0?"
    a: "No. LIMIT 1 allows a query to return zero or one row, so the result can still be empty."
  - q: "Is an empty query result the same as a null list?"
    a: "No. A SOQL query assigned to a list returns an empty list when no rows match. A null reference is a separate condition and can cause a NullPointerException."
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

This error comes from Apex and can reach an admin, developer, tester, or user through a Flow, API response, deployment test, Lightning Web Component (LWC), or Agentforce action that invokes Apex. Find the Apex stack trace and start with the class and line number; the surface displaying the message may not be where the faulty list is created.

## What does List index out of bounds: 0 mean?
{: #meaning}

Apex tried to access the first element of a list that contains no elements. Indexes start at zero, so an empty list has no valid index at all.

For a list with `n` elements, valid indexes run from `0` through `n - 1`. The number in the exception is the index Apex attempted to access. A zero in the message identifies the requested index; it does not identify which query or list is responsible.

A SOQL query assigned to a list can return zero rows. That result is an **empty list**, not a null list. According to [Salesforce Help](https://help.salesforce.com/s/articleView?id=000385743&language=en_US&type=1), a query returning no records is the most common cause of this error.

**Quick fix:** locate the exact list at the failing line, check why it is empty, and guard the access. Decide whether no result should return an empty state or stop the operation with a useful error. `LIMIT 1` only sets a maximum; it does not guarantee a result.

## Why do I get List index out of bounds: 0?
{: #causes}

The immediate cause is always an attempt to read index `0` from an empty list. The reason that list is empty depends on the data and execution path.

| Cause | How to confirm | Fix |
| --- | --- | --- |
| SOQL returns no rows | Check the query, bind values, filters, and row count in the failing transaction. | Correct the data or query if needed, then handle zero rows before indexing. |
| Test data is missing or does not match | Compare the test fixture with every query condition and required relationship. | Create matching records inside the test and test the no-match case separately. |
| The running user sees different records | Run or trace the same operation in the failing user and access context. | Correct intended access, or handle a legitimate absence of visible records. |
| Code filters, clears, or never populates the list | Check its size immediately before the failing line and trace every mutation on that path. | Correct the control flow and handle an empty list where it is valid. |
| A child or derived collection is empty | Identify the exact child list, parsed collection, or method return being indexed. | Validate that collection and fix missing source data or input. |

Salesforce identifies empty SOQL results as the most common cause. The other rows are troubleshooting possibilities, not a verified prevalence ranking.

## How do I fix List index out of bounds: 0?
{: #fix}

Use the stack trace to identify the exact list, then check the data and access context that produced it. Add a guard only after deciding what the application should do when the list has no matching item.

### 1. Find the failing access

Open the error details or test failure and note the first relevant Apex class or trigger and line number. If a Flow, LWC, API request, or Agentforce action shows the error, follow the exception back to the Apex it called.

For a reproducible action, capture a log:

1. In **Setup**, enter **Debug Logs** in Quick Find and open **Debug Logs**.
2. Create a debug level with **Apex Code** set to **Finest**. Set **Workflow** to **Finer** when investigating a Flow.
3. Create a trace flag for the user performing the action, with an active start and expiration time and that debug level.
4. Reproduce the action, return to **Setup → Debug Logs**, and open the resulting log.

Search for the exception and stack trace. For a query, inspect the corresponding `SOQL_EXECUTE_END` event for its row count. Salesforce describes these steps and events in its [debug logging guide](https://help.salesforce.com/s/articleView?id=000392579&language=en_US&type=1). Use a narrow trace window and avoid logging sensitive values unnecessarily.

At the failing line, distinguish the collection from nearby objects. In an expression that reads the first child of a parent, the parent may exist while its child list is empty. If you can change the code in a development environment, log the relevant list’s size immediately before the access. Do not assume an earlier size check still applies after a method filters or clears the list.

### 2. Fix a query that returns no rows

Compare each filter and bind value with the actual records. Check IDs, status values, relationships, and whether the record exists at the time the query runs. A record created later in the transaction cannot satisfy an earlier query.

If zero matches are expected, return an empty result or another documented outcome. If a match is required, stop with a clear business error that identifies what is missing. Do not create a placeholder record or remove a filter merely to suppress the exception.

When selecting one of several possible records, use an explicit `ORDER BY` that matches the business rule. Without it, “first” does not define which matching record your application needs.

### 3. Fix a failing test or deployment

Open the failure’s class and line, then inspect the query at that line. Create the records the test needs, including fields and relationships used by the query. A test record can exist and still fail to match a status, parent ID, or other condition.

Prefer isolated test data over relying on existing org records or adding `SeeAllData=true` as a shortcut. Add assertions for both a matching record and no matching record. The example below does both. If a deployment fails because an existing test throws this error, repair the fixture or the production logic based on the intended behavior, then rerun the relevant tests.

### 4. Check record visibility and execution mode

If the same inputs work for one user but not another, reproduce the operation as the affected user and inspect the query’s execution context. Review the class sharing declaration, explicit query access mode, applicable sharing and restriction rules, and the user’s intended access.

API version matters. Salesforce states that database operations default to user mode in Apex API version 67.0 and later; in version 66.0 and earlier, the default is system mode. Explicit access modes and sharing declarations also matter. Object or field permission problems can raise an access error instead of returning an empty list. See [Salesforce’s access-mode documentation](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexref/apex_classes_enforce_usermode.htm).

Grant access only when the user is supposed to have it. For a deeper investigation, use the [record visibility troubleshooting map](/blog/why-salesforce-user-can-see-record/).

### 5. Trace lists built in memory

If the list is not the direct result of SOQL, trace its source and changes. Check branches that populate it, filters that remove items, calls to `clear()`, and methods that return collections. For child query results or parsed input, inspect the specific collection at the failing expression.

If the stack trace points into a managed package and you cannot inspect the code, collect the operation, inputs, user context, timestamp, and log. Check the product’s documentation and contact its support team. A generic Apex guard cannot be applied to code you cannot edit.

## What Apex code fixes List index out of bounds: 0?
{: #code}

The unsafe pattern reads the first result without checking whether one exists. The fixed class returns `null` for no match, and its caller must handle that outcome.

### Bad pattern

This example is for explanation and reproduction; do not deploy it as the fix.

```apex
List<Account> accounts = [
    SELECT Id, Name
    FROM Account
    WHERE Name = 'A name that does not exist'
    LIMIT 1
];

// Throws ListException if the query returns no rows.
Account firstAccount = accounts[0];
```

### Fixed class

Save this as `AccountLookup.cls`. This example looks up an account by ID, so at most one record can match. Returning `null` is a deliberate contract for this example; a required account may instead need a clear business exception.

```apex
public with sharing class AccountLookup {
    public static Account findById(Id accountId) {
        if (accountId == null) {
            return null;
        }

        List<Account> accounts = [
            SELECT Id, Name
            FROM Account
            WHERE Id = :accountId
            LIMIT 1
        ];

        if (accounts.isEmpty()) {
            return null;
        }

        return accounts[0];
    }
}
```

A caller must check the return value before reading fields:

```apex
Account found = AccountLookup.findById(accountId);
if (found == null) {
    // Show an appropriate no-result message or stop the operation.
} else {
    System.debug(found.Name);
}
```

This class uses `with sharing` and is supplied with API version `66.0` metadata below. In that version, the query defaults to system mode; the sharing declaration still affects record-level access. Adapt the access mode and behavior to the security requirements of your application.

### Test class

Save this as `AccountLookupTest.cls`. The test creates its own matching account, checks a real no-match case after deleting it, and checks a null input.

```apex
@IsTest
private class AccountLookupTest {
    @IsTest
    static void findsMatchingAccount() {
        Account account = new Account(Name = 'Lookup test account');
        insert account;

        Test.startTest();
        Account found = AccountLookup.findById(account.Id);
        Test.stopTest();

        System.assertNotEquals(null, found, 'Expected a match.');
        System.assertEquals(account.Id, found.Id);
        System.assertEquals('Lookup test account', found.Name);
    }

    @IsTest
    static void returnsNullWhenAccountDoesNotMatch() {
        Account account = new Account(Name = 'Deleted lookup account');
        insert account;
        Id deletedId = account.Id;
        delete account;

        Test.startTest();
        Account found = AccountLookup.findById(deletedId);
        Test.stopTest();

        System.assertEquals(null, found, 'Expected no match.');
    }

    @IsTest
    static void returnsNullForNullId() {
        Test.startTest();
        Account found = AccountLookup.findById(null);
        Test.stopTest();

        System.assertEquals(null, found, 'Expected no match.');
    }
}
```

Normal SOQL excludes the deleted account, so the second test exercises an empty query result. If your org has account validation rules or automation, the fixture may need additional fields or setup. These examples have not been run in an org for this post.

## How do I reproduce List index out of bounds: 0 safely?
{: #reproduce}

Run a small anonymous Apex example in a Developer Edition org to see the exception without changing records. Then deploy and run the fixed example’s tests in that development org.

1. Open your Developer Edition org and launch **Developer Console** from the Setup menu.
2. In Developer Console, choose **Debug → Open Execute Anonymous Window**.
3. Enter the following code and execute it:

```apex
List<String> values = new List<String>();
System.debug(values[0]);
```

4. Inspect the execution result or log for the list exception. This example performs no database writes.
5. Create the files in the solution kit, deploy them to the development org, and run `AccountLookupTest`. Confirm that all three tests pass.

The reproduction proves what happens when an empty list is indexed. It does not prove that a production query has the same cause; use the production stack trace and context to establish that.

## How do I prevent List index out of bounds: 0?
{: #prevent}

Define what an empty result means at each boundary and test it. Validate the actual index being accessed, including after a list has been changed.

- Use `isEmpty()` before reading index `0`. For any index `i`, require `i >= 0` and `i < items.size()`.
- Check the index in the expression itself. A loop condition that validates `i` does not automatically validate `i + 1`.
- Prefer a `for` loop over list elements when you do not need an index. An empty list then produces zero iterations.
- Give callers a clear contract for no match, and make them handle it.
- Test matching, missing, filtered-out, and relevant visibility cases. Include relationships and filters in test fixtures.
- Keep SOQL outside loops when processing collections. An index guard fixes this exception but does not fix inefficient query placement. See [Salesforce Too Many SOQL Queries 101](/blog/salesforce-too-many-soql-queries-101/).

For a Flow that calls Apex, inspect the Flow error details and the invoked method’s contract. If no record is an acceptable outcome, design the Flow’s next step around that outcome. If the record is required, surface a useful error instead of silently continuing.

## Related errors
{: #related-errors}

Similar messages point to different failing operations. Check the exception type and requested index before applying a fix.

- `System.ListException: List index out of bounds: -1`: Apex attempted to use a negative index.
- `System.NullPointerException: Attempt to de-reference a null object`: code dereferenced a null reference. This is different from indexing an empty list.
- `System.QueryException: List has no rows for assignment to SObject`: a SOQL query assigned directly to a single sObject returned no rows. A list query with an explicit empty-result check is one way to handle an optional match.

For another common query-related failure, see [SObject Row Retrieved Without Querying the Field](/blog/sobject-row-retrieved-without-querying-field/).

## Official sources
{: #official-sources}

These Salesforce sources support the diagnosis and deployment steps. Links were opened on 28 November 2026.

- [Apex: How to Fix “System.ListException: List index out of bounds”](https://help.salesforce.com/s/articleView?id=000385743&language=en_US&type=1): empty query results and checking list size.
- [Capture and read Salesforce debug logs](https://help.salesforce.com/s/articleView?id=000392579&language=en_US&type=1): trace setup and query row-count events.
- [Set an access mode for database operations](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexref/apex_classes_enforce_usermode.htm): user mode, system mode, and API version behavior.
- [Built-in Apex exceptions](https://developer.salesforce.com/docs/platform/apex-dev/references/apex-dev/apex-exception-builtin.html): exception types.
- [Run Apex tests with Salesforce CLI](https://developer.salesforce.com/docs/platform/sfdx-dev/guide/sfdx-dev-testing.html) and [deploy project metadata](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_project_deploy_start.html): test and deployment workflow.

Need this fixed in your org? [SFX can build it](/services/) with a written scope and fixed quote.

## Solution kit
{: #solution-kit}

The complete example needs two Apex files and their metadata files in an existing Salesforce DX project. Deploy it first to a Developer Edition org or sandbox; adapt the lookup and its security contract before using it in application code.

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
