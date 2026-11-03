---
layout: blog-post
sfx_blog: true
featured: false
title: "12 Salesforce Deployment Interview Questions: Validation to Rollback"
seo_title: "Salesforce Deployment Interview Questions (2026)"
description: "Prepare for Salesforce deployment interviews with 12 scenarios on dependencies, tests, validation, quick deploy, destructive changes, rollback, and monitoring."
date: 2026-10-27 08:00:00 +0530
last_modified_at: 2026-10-27 08:00:00 +0530
permalink: /blog/salesforce-deployment-interview-runbook/
primary_category: "Deployment"
series: "Salesforce Interview Questions"
categories:
  - interview-prep
  - deployment
  - devops
  - architecture
tags:
  - Salesforce deployment interview questions
  - Salesforce CLI
  - Metadata API
  - Validate Deployment
  - Quick Deploy
  - Apex Tests
  - Destructive Changes
  - Salesforce Rollback
reading_time: "17 min read"
og_type: article
extra_css:
  - /assets/css/blog.css
toc:
  - id: answer-framework
    label: "Answer framework"
  - id: artifact-dependencies
    label: "Artifact and dependencies"
  - id: validation-tests
    label: "Validation and tests"
  - id: production-release
    label: "Production release"
  - id: recovery-verification
    label: "Recovery and verification"
  - id: design-exercise
    label: "Release runbook exercise"
  - id: cli-example
    label: "Salesforce CLI example"
  - id: quick-revision
    label: "Quick revision"
---

A production deployment contains a new custom field, Apex, a record-triggered Flow, a Lightning web component, and a permission set. The validation passed on Friday. During Saturday's release, the component deployment succeeds—but users cannot see the component, the Flow starts duplicate work, and a data backfill fails halfway.

Calling the release “successful” because the deployment status is Succeeded misses the real outcome. A strong Salesforce deployment interview answer explains the exact artifact, dependencies, tests, activation sequence, data operations, observability, recovery decision, and business verification.

These 12 scenario-based Salesforce deployment interview questions cover source control, manifests, dependency order, profiles and permission sets, validate-only deployments, Apex test levels, quick deploy, destructive changes, feature activation, rollback, and post-release checks.

For broader preparation across Admin, Security, Flow, Apex, Deployment, and Integration, start with [18 scenario-based Salesforce interview questions](/blog/salesforce-interview-questions-scenario-based/). For release-specific automation risks, continue with [12 Salesforce Flow interview scenarios](/blog/salesforce-flow-interview-scenarios/).

## A strong deployment answer framework {#answer-framework}

For any release scenario, answer in this order:

1. **Define the release artifact.** Identify every metadata component, deletion, permission change, data migration, configuration step, and external dependency.
2. **Establish the source of truth.** Name the commit, branch or tag, manifest, API version, build result, and approvals that define exactly what is being released.
3. **Map dependencies and sequence.** Separate prerequisites, deployable metadata, activations, data changes, and post-deployment steps.
4. **Validate in a target-like environment.** Exercise the same artifact, tests, permissions, volume, and integrations expected in production.
5. **Pre-validate production.** Use a validate-only deployment with the intended test level and preserve the eligible job ID when quick deploy is planned.
6. **Define stop and recovery conditions.** Decide who can halt the release, when to roll forward, when to redeploy the prior version, and how data is restored or reconciled.
7. **Prove the business outcome.** Verify least-privileged users, automation, integrations, monitoring, and key data—not only the deployment status.

> A deployment transports metadata. A release safely changes a working system and proves that the business process still works.

Salesforce's [Deployment Best Practices](https://help.salesforce.com/s/articleView?id=platform.deploy_best_practices.htm&language=en_US&type=5) guidance emphasizes governance, dependency order, controlled production changes, and careful treatment of profiles, permission sets, and sharing logic.

## Release artifact and dependencies {#artifact-dependencies}

### 1. What do you check before choosing Change Sets, Salesforce CLI, DevOps Center, or a packaging approach?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I start with the delivery model, not the tool name. I ask whether source control is authoritative, how many teams contribute, which metadata types are involved, whether environments use source tracking, whether releases must be repeatable across several orgs, and whether the solution is an internal application or a versioned product.

For a source-driven team, Salesforce CLI or DevOps Center can support reviewable artifacts and automated validation. Change Sets can work for a smaller org-to-org administrative release, but I still need a documented component list and repeatable pre- and post-deployment steps. Unlocked or managed packages may be appropriate when versioning, dependency management, or distribution justifies that lifecycle.

The interview point is traceability: can the team recreate exactly what was tested, identify who approved it, and promote the same artifact without manually rebuilding the selection?
</div>

### 2. Why is “deploy everything changed in the sandbox” risky?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

A shared sandbox can contain unrelated work, experiments, admin changes, incomplete dependencies, and changes already made in another branch. Deploying every detected difference expands the blast radius and makes review, testing, and recovery harder.

I define a release manifest or package boundary from reviewed source control. Before promotion, I inspect the deployment preview, ignored files, deletions, target-org differences where source tracking is available, and any manual production changes recorded in Setup Audit Trail.

I do not resolve a conflict by automatically overwriting the org. First I determine which version is authoritative, reconcile it in source control, rerun tests, and regenerate the artifact. A clean command is not more important than preserving the correct behavior.
</div>

Salesforce CLI's [`project deploy preview`](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_project_deploy_preview.html) command lists the components to deploy or delete, potential conflicts in source-tracked orgs, and files excluded by `.forceignore`.

### 3. How do you handle dependencies in a deployment containing objects, Apex, LWC, Flow, permissions, and sharing?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I build a dependency map from references, not from file timestamps. A component can compile only when the fields, classes, labels, named credentials, custom metadata, record types, or other resources it references exist in the target org.

A practical sequence begins with foundational object metadata, then code and user-interface components, then automation, permissions, and sharing where the feature permits that separation. I also identify circular or same-transaction dependencies that must be deployed together.

The metadata sequence is only part of the release. Named credential principals, certificates, connected-app policies, endpoint allowlists, users, queues, custom-setting values, and environment-specific custom metadata can require controlled setup. I never copy a production secret into source or assume a successful metadata validation proves an external dependency is configured.
</div>

Salesforce's [deployment dependency guidance](https://help.salesforce.com/s/articleView?id=platform.deploy_best_practices.htm&language=en_US&type=5) recommends establishing objects before components that reference them, then handling profiles, permission sets, and sharing after their related metadata exists.

### 4. Why are profiles and permission sets frequent sources of deployment surprises?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

Their retrieved metadata is context-sensitive. The permissions represented can depend on which objects, fields, classes, tabs, applications, and other components were included in the retrieval. A partial artifact can therefore omit an intended setting, while a large profile deployment can change more access than the feature requires.

I prefer focused permission sets for additive feature access and include the referenced components in the same reviewed release boundary. I compare the target result, not just the XML diff: which persona can read, create, edit, delete, execute, or view each relevant object, field, Apex class, Flow, tab, and app?

I test a least-privileged user after deployment. A System Administrator smoke test cannot prove that permissions were transported correctly, and a visible page does not prove field- or record-level access is correct.
</div>

Salesforce documents how dependent permissions can be enabled together in [Permission Dependencies and Alignment](https://help.salesforce.com/s/articleView?id=platform.users_perm_dependencies.htm&language=en_US&type=5). Include those effects in access review rather than treating each checkbox as independent.

## Validation and Apex tests {#validation-tests}

### 5. What is the difference between a sandbox dry run and a production validate-only deployment?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

A sandbox dry run checks the artifact against a development or test environment without committing the metadata. It is valuable for dependency, compilation, and test feedback, but it does not prove the production org has the same configuration, data shape, installed packages, limits, or test behavior.

A production validation checks the deployment against the actual target org and runs the selected tests without saving the components. If it succeeds with the required tests and coverage, the returned job ID can qualify for a later quick deploy.

I use both. Target-like sandbox testing gives the team room for regression, user acceptance, integration, performance, and data-migration rehearsal. Production validation catches target-specific metadata and test problems close to release. Neither replaces post-deployment business verification.
</div>

The current Salesforce CLI reference says `sf project deploy validate` is intended for production. For a sandbox validation with tests, it recommends `sf project deploy start --dry-run --test-level RunLocalTests`; see [`project deploy validate`](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_project_deploy_validate.html).

### 6. RunLocalTests or RunSpecifiedTests—which would you choose?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I choose from release risk and coverage semantics. `RunLocalTests` runs local tests while excluding tests that originate from installed managed packages, and it is the normal production default when Apex is included. It provides broad regression evidence across the org's code.

`RunSpecifiedTests` can shorten a targeted deployment, but the named tests must cover each deployed class and trigger to the required individual level. That is different from meeting one overall org-wide percentage. I maintain an explicit mapping from changed behavior to tests and include downstream callers, sharing, asynchronous jobs, and failure paths—not only tests whose names match the classes.

I do not use coverage as the quality target. Assertions must prove business outcomes, bulk behavior, permissions, negative cases, and error handling. High line coverage can still miss a broken release.
</div>

Salesforce describes the current test-level behavior and coverage rules in the [`project deploy start` reference](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_project_deploy_start.html).

### 7. Production validation succeeded. Can you assume Saturday's quick deploy will succeed?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

No. I first confirm the validation is still eligible, the exact artifact and target org are unchanged, no intervening deployment disqualified it, and the release remains within the validity window. I store the validation job ID with the commit, manifest checksum, test result, target org, time, and approver.

A quick deploy skips rerunning tests because they ran during the qualifying validation; it does not repeat the analysis against a newly assembled artifact. If the source changed after validation, I build a new artifact and validate again.

I also keep the release window long enough for post-deployment steps and verification. Saving test time is useful, but a quick metadata deploy does not make data migration, permission assignment, cache behavior, integration activation, or smoke testing instantaneous.
</div>

Salesforce states that a qualifying validation job ID remains valid for 10 days, while `--use-most-recent` searches only a shorter recent window. Review the exact behavior in [`project deploy quick`](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_project_deploy_quick.html) and [Monitor Deployments](https://help.salesforce.com/s/articleView?id=platform.deploy_monitoring.htm&language=en_US&type=5).

## Production release control {#production-release}

### 8. How do you deploy a breaking schema change safely?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I use an expand-and-contract sequence. First add the new field or structure and deploy code that can tolerate both old and new representations. Backfill data in controlled batches, reconcile the result, switch readers and writers, observe the system, then remove the obsolete component in a later release.

I do not combine “create replacement, migrate all data, cut over every consumer, and delete the old field” into one irreversible window unless the risk is exceptionally well understood. Reports, integrations, formulas, Flow versions, validation rules, permission sets, managed packages, and external exports may still reference the old component.

The destructive step needs explicit approval, dependency evidence, a metadata backup, a data retention decision, and a tested recovery path. A `destructiveChanges` manifest is an execution mechanism, not a safety assessment.
</div>

Salesforce CLI supports separate pre- and post-destructive manifests in validation and deployment. The [validation command reference](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_project_deploy_validate.html) documents these options and warns that purge-on-delete changes recoverability.

### 9. What belongs in a deployment runbook besides the metadata command?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

The runbook names the owner, approver, target org, artifact, start time, maintenance or communication plan, prechecks, exact commands, expected durations, stop conditions, dependencies, data steps, activation sequence, verification queries, monitoring, and recovery actions.

I distinguish four kinds of work:

1. **Metadata:** objects, code, Flow, UI, permissions, sharing, and deletions.
2. **Configuration:** environment-specific endpoints, credentials, certificates, feature settings, users, queues, and custom metadata values.
3. **Data:** backfills, transformations, ownership changes, reconciliation, and retry files.
4. **Operations:** pausing integrations, notifying users, activating features, warming caches, monitoring jobs, and handing off to support.

Each manual step needs evidence and a second-person check when the risk justifies it. “Admin will configure production afterward” is not a controlled release step.
</div>

### 10. How would you reduce user impact during a large release?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I minimize the work that must occur in the visible cutover. Validate production beforehand, use quick deploy when eligible, stage backward-compatible metadata, rehearse data scripts, and keep feature activation separate from transport where possible.

A custom permission, custom metadata flag, permission-set assignment, or another governed switch can let the team deploy dormant functionality and enable it for a pilot population after checks. The switch itself must be secure, versioned or documented, tested in both states, and included in recovery.

For long-running sharing recalculations, field-type conversions, test execution, or data migrations, I choose a low-traffic window and communicate expected behavior. I do not disable validation or automation casually; any temporary bypass needs an owner, expiry, audit trail, and explicit re-enable verification.
</div>

## Recovery and post-deployment verification {#recovery-verification}

### 11. The deployment succeeded, but users report errors. Do you roll back immediately?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I triage impact first: which users and transactions fail, whether data integrity or security is at risk, and whether a feature flag, permission correction, configuration repair, or small forward fix is safer than a full metadata reversal.

If the impact is severe or still growing, I stop dependent jobs and integrations, disable the affected feature through the approved control, preserve logs and deployment IDs, and invoke the incident owner. The recovery choice must consider metadata, data, and external side effects separately.

A failed validate-only deployment changes no metadata. A failed deployment may be rolled back by the deployment service depending on its options and state. But after a successful release, “rollback” usually means deploying a tested last-known-good metadata version or a forward fix. That does not automatically undo emails, callouts, data changes, queued jobs, deleted data, or actions completed by external systems.
</div>

Salesforce explains deployment queue, test, commit, cancellation, and finalization behavior in [Take a Deep Dive into Metadata API Deployments](https://developer.salesforce.com/blogs/2025/09/take-a-deep-dive-into-metadata-api-deployments). Design recovery around the committed state and side effects rather than assuming one universal undo button.

### 12. What do you verify after a successful deployment?

<div class="interview-answer" markdown="1">
<span class="answer-label">Strong answer</span>

I verify the deployment record and component counts, then prove the feature with representative personas. I check active Flow and Apex behavior, permission assignments, page and app visibility, sharing, scheduled or asynchronous work, integrations, and key business data.

I run a small set of production-safe smoke tests with known test records, inspect logs and failed jobs, verify alerts, and reconcile any migration counts and totals. Negative tests matter: an unauthorized user must remain blocked, duplicate automation must not run, and an excluded record must stay unchanged.

Finally, I confirm temporary controls were restored, support has the release notes and known-error guidance, dashboards are quiet, and the rollback or forward-fix decision window has an accountable owner. The release closes only when the agreed monitoring period and business acceptance are complete.
</div>

[Monitor Deployments](https://help.salesforce.com/s/articleView?id=platform.deploy_monitoring.htm&language=en_US&type=5) shows component, test, coverage, warning, and status information. It is necessary evidence, but it must be combined with application-level verification.

## Design exercise: release a new renewal workflow {#design-exercise}

An interviewer asks you to plan this production release:

- Add renewal fields to Opportunity and a new `Renewal_Request__c` object.
- Deploy Apex that calculates entitlement dates.
- Deploy a record-triggered Flow that creates the request.
- Show a Lightning web component to Renewal Managers.
- Grant access through a permission set.
- Backfill open Opportunities.
- Remove an obsolete field after migration.

A defensible runbook separates the work into phases:

| Phase | Actions | Evidence or stop condition |
|---|---|---|
| Artifact | Freeze reviewed commit, manifest, destructive manifest, scripts, and checksums | No unreviewed file or manual component selection |
| Preflight | Confirm target org, audit trail, licenses, dependencies, backups, integration owners, and release communications | Stop on unexpected production change or missing prerequisite |
| Rehearsal | Deploy the same artifact to staging; run tests, UAT, volume backfill, permission tests, and rollback rehearsal | Stop on unreconciled counts, regression, or recovery gap |
| Production validation | Validate the production artifact with the intended tests | Preserve successful job ID and complete failure analysis before proceeding |
| Expand deploy | Add fields, object, Apex, Flow inactive where appropriate, LWC, and permission set | Smoke tests pass before enablement |
| Data migration | Backfill bounded batches with an idempotent script and correlation ID | Counts, errors, and business totals reconcile |
| Activation | Assign permission set to pilot users, activate automation, and enable the UI | Pilot positive and negative tests pass |
| Observation | Monitor Flow failures, Apex jobs, integration responses, logs, and business KPIs | Disable feature or invoke recovery on agreed threshold |
| Contract | Delete the old field only in a later approved release after all consumers are removed | Dependency scan, retention approval, and recovery evidence complete |

This design favors a staged cutover over one large transaction. It costs more planning and may require compatibility code, but it creates measurable checkpoints and preserves safer recovery options.

## Example Salesforce CLI validation sequence {#cli-example}

The exact aliases, manifest, test level, and wait time belong in the approved runbook. A modern source-driven sequence can look like this:

```bash
# Inspect the exact UAT payload before touching the org.
sf project deploy preview \
  --manifest manifest/renewal-release.xml \
  --target-org RenewalUAT

# Validate the artifact in a sandbox and run local tests without committing it.
sf project deploy start \
  --dry-run \
  --manifest manifest/renewal-release.xml \
  --test-level RunLocalTests \
  --target-org RenewalUAT

# Validate the frozen artifact against production and retain the returned job ID.
sf project deploy validate \
  --manifest manifest/renewal-release.xml \
  --test-level RunLocalTests \
  --target-org RenewalProduction \
  --wait 60

# During the approved window, deploy that exact successful validation.
sf project deploy quick \
  --job-id 0AfXXXXXXXXXXXXXXX \
  --target-org RenewalProduction
```

The job ID above is a placeholder. Do not copy it, hard-code credentials, or use an org alias without confirming the authenticated target. Store structured command output and the deployment ID with the release evidence, but keep authentication material out of logs and source control.

If the artifact changes after validation, do not quick-deploy the old job merely because it is still eligible. Rebuild, retest, and revalidate the new artifact.

## Quick revision sheet {#quick-revision}

| Interview scenario | Start with | Common weak answer |
|---|---|---|
| Select a deployment tool | Delivery model, traceability, metadata support, and repeatability | “CLI is always better” |
| Shared sandbox has many changes | Reviewed source artifact and manifest | Deploy every detected difference |
| Components reference each other | Dependency map and explicit sequence | Retry until compilation succeeds |
| Move feature access | Focused permission set and persona test | Validate only as System Administrator |
| Validate a sandbox | Dry run with intended tests | Treat sandbox success as production proof |
| Choose production tests | Risk, test mapping, and coverage semantics | Optimize only for fastest run |
| Use quick deploy | Frozen artifact and eligible validation job | Change source after validation |
| Delete or replace a field | Expand, migrate, observe, then contract | Delete during the first cutover |
| Build a runbook | Metadata, configuration, data, and operations | List one deployment command |
| Reduce downtime | Pre-validation, compatibility, staged activation | Disable controls without governance |
| Recover from a bad release | Triage metadata, data, and external side effects | Assume successful deploy has one-click undo |
| Close the release | Persona tests, negative tests, monitoring, and reconciliation | Stop at Succeeded status |

The strongest Salesforce deployment answer sounds like a small operational design review. It names the exact artifact, dependencies, test evidence, failure boundaries, recovery options, and business proof—before anyone clicks Deploy.

If your team needs a safer Salesforce release runbook or interview preparation, [contact SFX Support](/contact/) or use our [Salesforce support assistant](/chatbot/).

## Sources

- [Deployment Best Practices — Salesforce Help](https://help.salesforce.com/s/articleView?id=platform.deploy_best_practices.htm&language=en_US&type=5)
- [Monitor Deployments — Salesforce Help](https://help.salesforce.com/s/articleView?id=platform.deploy_monitoring.htm&language=en_US&type=5)
- [Build and Release Your App with Metadata API — Salesforce DX Developer Guide](https://developer.salesforce.com/docs/platform/sfdx-dev/guide/sfdx-dev-build-mdapi.html)
- [Project Deploy Preview — Salesforce CLI Command Reference](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_project_deploy_preview.html)
- [Project Deploy Validate — Salesforce CLI Command Reference](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_project_deploy_validate.html)
- [Project Deploy Start — Salesforce CLI Command Reference](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_project_deploy_start.html)
- [Project Deploy Quick — Salesforce CLI Command Reference](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_project_deploy_quick.html)
- [Metadata Coverage Report — Salesforce Developers](https://developer.salesforce.com/docs/success/metadata-coverage-report/references/metadata-types/metadata-types.html)
- [Take a Deep Dive into Metadata API Deployments — Salesforce Developers](https://developer.salesforce.com/blogs/2025/09/take-a-deep-dive-into-metadata-api-deployments)
