# SFX design system

One look for the whole site: **dark, quiet, readable**. Think Vercel and Linear docs, not a template with gradients and star fields. Our readers are Salesforce admins and developers who scan a page in 10 seconds and decide whether to stay.

Why this look was chosen, and what was rejected first, is in `docs/DECISIONS.md` (D-01 to D-05).

## Tokens

| Token | Value | Use |
|---|---|---|
| Background | `#000` | page |
| Card | `#0d0d0d`, border `#2a2a2a` | cards, tables, inputs area |
| Ink | `#ededed` | headings, key numbers, body on news |
| Ink 2 | `#d4d4d8` | body text on tool/learning pages |
| Mute | `#a1a1a1` to `#b4b4bc` | labels, captions, dates. **Never darker than `#a1a1a1` for text.** |
| Accent (clean pages) | `#f59e0b` | eyebrow, focus ring, one link per screen |
| Accent (news) | `#a78bfa` | series label |
| Good | `#4ade80` | "cheaper / best" outline only |

## Type

- Fonts: **Geist** for text, **Geist Mono** for labels, code and numbers in labels (Google Fonts).
- Body 17 to 18px, line height 1.55 to 1.65 (news: 18px/28px). Measure 60 to 75 characters (about 648 to 720px).
- Lead paragraph 20 to 22px.
- h1 500 weight, 34 to 56px, letter-spacing about -0.045em, `text-wrap: balance`.
- h2 500 weight, 26 to 32px. h3 600 weight, 18px.
- Minimum 14px for any text (labels, captions, footers, table headers). Icons excepted.
- Contrast at least 4.5:1 (WCAG AA); body text aims for 7:1 or better.

## Layouts

| Page type | Use | Notes |
|---|---|---|
| Tool, calculator, learning, company pages | `layout: default`, `body_class: sfx-clean`, `extra_css: [/assets/css/clean.css]`, content in `<div class="c-page">` | Classes: `c-eyebrow`, `c-lead`, `c-stats`, `c-card`, `c-f` (form field), `c-opt` (result), `c-insight`, `c-sec`, `c-tbl`, `c-faq`, `c-cta`, `c-btn--w/--g`. Example: `/agentforce-pricing-calculator/`. |
| News issue | `layout: news-post` | Left sticky masthead, 648px column, AI panel cards. See `_layouts/news-post.html`. |
| Blog post | `layout: blog-post` | Light theme for now. Hero banner only with `show_hero: true`. |
| Old pages | `layout: HomePageFinalTest` (starfield) | Being retired. Do not use for new pages. |

## Page patterns that work

- **First screen:** eyebrow (what and how fresh), a specific h1, a lead that opens with a concrete situation or the stakes, then the thing itself (the tool, the story).
- **Tools:** inputs left, result right and sticky on desktop; on phones a sticky result bar at the bottom. Rough defaults pre-filled so a result shows at once. One honest note under the result, not three.
- **Articles and news:** teasers that withhold the answer; the verdict comes after the story; "Do this" steps; quick hits; dated sources.
- **Next step:** one primary button (white) and one secondary (outline). Nothing else competes.

## Never

- Star fields, gradients behind text, glass blur, glowing borders.
- Grey text darker than `#a1a1a1` on black; text under 14px.
- A summary box that answers everything before the story starts.
- "Coming soon" boxes, empty sections, placeholder cards.
- AI-generated banners with text in them (the gate cannot see images; they looked cheap).
- Repeating the same example or caveat twice on one page.
