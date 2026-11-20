# SFX website changes

## Before and after

| Observed issue | Implemented fix | Buyer outcome |
| --- | --- | --- |
| Homepage primarily described free learning | New development-led homepage with dedicated learning/community path | Understand that paid development is available |
| Dim navigation and supporting copy | Readable navy/blue design, consistent buttons and focus indicators | Read the offer and find the next step |
| Different navigation across main pages | Shared responsive header and footer; links from Travel Manager into development services | Move between services, products, training, and community |
| Contact page explicitly excluded consulting | Project enquiry with service, company, budget, timing, email and optional phone | Explain a commercial requirement |
| Product work not packaged as delivery evidence | Forge and Travel Manager case studies clearly identified as internal products | Inspect relevant capability without fabricated client claims |
| Broad technical topics without a bounded purchase | Fix & Improve engagement plus feature/integration and agency support options | Understand a practical first purchase |
| Paid course and free residency appeared contradictory | Clear explanation that these are separate programmes; prices and schedules retained | Choose the appropriate learning route |
| Contact intent confused with actual enquiries | CTA interest events separate from API-confirmed, nonduplicate lead conversions | Diagnose conversion with fewer false positives |
| No short-term acquisition workflow | 15-day plan, researched starting points, messages, tracker, and scope template | Turn the site into a destination for active outreach |

## Scope and preserved systems

The main website uses the existing GitHub Pages/Jekyll deployment. No new host, database, advertising account, or payment provider is introduced. The project form uses the existing Contact product and `/api/leads` contract. Training forms, Travel Manager demo links, and public resource URLs remain in place. Learning content is not removed. No invented customer logos, certifications, testimonials, revenue, uptime, or project results are added.

Forge and Grove applications are separate repositories and deployments. This release updates how they are presented and linked from the main website, and adds development-service routes to their own public landing pages. Grove also clarifies the separate live course. Authenticated application workflows and production database schemas are unchanged. Travel Manager keeps its existing product layout and gains a Salesforce services cross-link.

## Local validation

Build: `PATH=/opt/homebrew/opt/ruby/bin:$PATH bundle exec jekyll build --destination /private/tmp/sfx-client-launch-preview`

Form behaviour: `node --test scripts/studio-form.test.cjs`

JavaScript syntax: `node --check assets/js/studio.js`

Whitespace: `git diff --check`

Browser QA: new home, contact and training pages; navigation, mobile layout, and form states. The test harness stubs the form API only in the temporary preview directory; it does not create fake production leads. All QA pages stay outside the repository/build source.

## Release and rollback

Publish via the existing `gh-pages` branch and `Deploy Jekyll site to Pages` workflow. Verify its successful deployment and the public homepage/services/contact paths. Keep the launch commit SHA for rollback. If rollback is needed, revert that single launch commit in a new commit and run the existing deployment; do not reset or force-push unrelated history.

## Remaining owner actions

Set actual delivery availability and price only after scoping; record the technical walkthrough; personalise and send outreach; review the lead inbox and sales tracker daily; validate measurement in your own analytics account. A website redesign cannot guarantee a client by a particular date.
