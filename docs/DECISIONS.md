# Decisions log

Why things are the way they are. Newest at the bottom. Each entry: what the founder said (their words, often Hinglish), what we decided, and why. Rules that came out of these are in `docs/RULES.md`.

## Brand and direction

**B-01 · 25 Nov 2026 · Salesforce + AI only, inbound only.**
SFX focuses only on Salesforce + AI and grows through SEO, tools and daily solution posts. No cold outreach.
Why: the founder can't keep up with cold outreach and wants work to come in through authority.

**B-02 · 25 Nov 2026 · Paid business, not a "free community".**
All "free forever", volunteer and non-commercial wording removed; CTAs go to `/services/`. Never claim a partner status.

**B-03 · 25 Nov 2026 · Solve, don't plug tools.**
"Don't write like 'use SFX Debug Log Analyzer'... usse solve thodi hoga." Posts give the full fix. (27 Nov: five old posts still plugged Ask Krrish or the analyzer. They were found by `check-rules` and fixed.)

**B-04 · 25 Nov 2026 · Every change reviewed twice before it goes live.**
Claude (or Gemini) reviews, then ChatGPT confirms. An override is allowed only after 2 to 3 rounds and only when official docs prove ChatGPT wrong.

**B-05 · 27 Nov 2026 · Brand search.**
"sfx and salesforce search kare to hame hi aana chahiye, why SFX Connect?" Added `alternateName` and `sameAs` to the schema. Still to do: AppExchange Consulting listing and a LinkedIn company page (founder).

## Design (how the current theme was chosen)

**D-01 · 27 Nov 2026 · First newsletter layout rejected.**
A light layout with a "30-second version" box. Founder: "padhna nahi... UI bhi achchha nahi hai."

**D-02 · 27 Nov 2026 · Three mockups rejected as dated.**
- A: an Inshorts-style single card.
- B: a group chat where Claude, ChatGPT and Gemini argue.
- C: a printed-magazine brief.
Founder: "theme to achchhi nahi hai... modern dino me kya sach me tum ye use karoge?" Lesson: gimmicks look old; plain and premium looks modern.

**D-03 · 27 Nov 2026 · Chosen: dark minimal, Vercel/Linear style.**
"Jo best lage wo choose karo." We chose black, one clean font, one accent colour, and no gradients or shadows, because our readers are developers and admins who use those products every day.

**D-04 · 27 Nov 2026 · Typography copied from Vercel.**
"Fonts Vercel ke zyada achchhe hai... readability achchhi hai." Geist + Geist Mono, 18px/28px body, #ededed on black, h1 weight 500 with tight letter-spacing.

**D-05 · 27 Nov 2026 · The summary box killed curiosity.**
"Wo 30 second version padhne par main kyun nahi ruka?" Because it answered everything. Replaced it with teasers that withhold the answer, a stakes-driven lead, and the AI debate placed after the story.

**D-06 · 27 Nov 2026 · Blog banner removed.**
"Itni gandi image... review me se kaise pass hui?" The review gate only reads text and never sees images. Hero banners are now opt-in (`show_hero`); the cover stays only as the social (OG) image. Any image shown on a page needs a human or browser look.

**D-07 · 27 Nov 2026 · Pricing calculator rewritten.**
"Readability bahot bekar hai... fonts aur sab kuch... chhota likho, kam likho, par achchha likho." Moved to the clean dark system (`clean.css`) and cut the copy by about half, keeping one honest note. The result is big and sticky, with a sticky result bar on phones.

**D-08 · 27 Nov 2026 · One design system for the whole site.**
The site had three looks (starfield, light blog, dark news). New and reworked pages use `clean.css`; the starfield is being retired page by page.

## Review

**R-01 · 27 Nov 2026 · Review like a real reader, again and again.**
"Review pe zyada dhyan do, chhoti chhoti cheezon pe... koi insaan kidhar rukta hai... koi book hai to usey refer karlo... fake na lage koi bhi review... har cheez review ho, baar baar."
Built `reader-review.py` and `REVIEW-reader.md`, based on Krug, Heath, Zinsser, Ogilvy, Butterick, *Refactoring UI* and NN/g. It scores 10 things including the exact point where readers stop. Any score under 7 blocks the push. Any fake-looking review or rating is a FAIL.

**R-02 · 27 Nov 2026 · Measure, don't guess.**
The reviewer judged font size from scaled-down screenshots and called 17px text "12px". It now receives the browser's real computed font sizes and contrast ratios.

**R-03 · 27 Nov 2026 · Stop point depends on the page type.**
A calculator succeeds when people get the answer and leave with a next step; an article succeeds when people read to the end. The rubric now says so.

**R-04 · 27 Nov 2026 · Instructions must be enforced, not remembered.**
"Jo bhi main instruction deta hoon kya tum uska check karte ho?" Honest answer: not all of them. They lived in Claude's memory and a few prompts, and ChatGPT and Gemini never saw most of them.
Now:
- They are written in `docs/RULES.md`, which every agent reads (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`).
- The machine-checkable ones run in `scripts/check-rules.py` on every push and in GitHub Actions before every deploy.
- The rest go to the gate and the reader review.

## Site structure

**S-01 · 27 Nov 2026 · `/interview-prep/` retired.**
"Isey hata hi dena chahiye." It had 0 clicks from 17 impressions in 90 days and duplicated `/salesforce-interview-questions/`. It now redirects there.

**S-02 · 27 Nov 2026 · Remove what nobody uses.**
"Jo use ke nahi hai..." Next up:
- `/Second-Generation-Packaging/` → `/salesforce-packaging/`;
- `/resources/` → `/learning/`;
- noindex `/login/`;
- decide on `/contributors/`.

## Gate findings (kept here so they are not re-litigated)

**G-01 · 28 Nov 2026 · News pages emit no FAQ schema.** FAQ content is not shown on news issues, and Google's guidelines say structured data must describe visible content, so the FAQPage JSON-LD was removed from `news-post`.

**G-02 · 28 Nov 2026 · The 27 Nov AI Weekly keeps its 7 items.** It went live before the 8 to 12 item rule existed; the rule applies to new issues.

**G-03 · 28 Nov 2026 · Campaign and services pages are always dark.** Both layouts load `sfx-dark.css` last, so their text colours live there; `campaign.css` keeps the light defaults.
