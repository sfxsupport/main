# SFX rules

The founder's standing instructions for sfxsupport.com, in one place. Every AI agent (Claude, ChatGPT/Codex, Gemini/Antigravity) and every human contributor follows these. When a rule and an older file disagree, this file wins.

**Checked by** says what enforces each rule:
- `check-rules`: `scripts/check-rules.py`, run by `push-live.sh` and by GitHub Actions before every deploy. A FAIL blocks the deploy.
- `gate`: `~/sfx-daily/review-gate.sh`. Claude (or Gemini) reviews the diff, then ChatGPT confirms. This file is part of the gate prompt.
- `reader`: `~/sfx-daily/reader-review.py`. Screenshots plus measured font sizes and contrast, scored with `REVIEW-reader.md`. Any score under 7 blocks the push.
- `human`: no machine can judge it yet. The founder or Claude must look.

## 0. How a new instruction becomes a rule

When the founder gives an instruction that should hold beyond today:
1. Add it to the right section below, with a "Checked by" entry.
2. Add the reason, the date and the founder's words to `docs/DECISIONS.md`.
3. If a machine can check it, add a check to `scripts/check-rules.py`, or a line to `REVIEW.md` or `REVIEW-reader.md`. Then run `python3 scripts/check-rules.py --all` and fix what it finds.
4. Say so in the reply, including which rules can only be checked by a human.

An instruction that lives only in chat or in one agent's memory is not enforced.

## 1. Brand and claims

| # | Rule | Checked by |
|---|------|------------|
| 1.1 | SFX is a paid Salesforce + AI solutions business. No "free", "community", "volunteer", "non-commercial" or "personal capacity" wording about SFX's own offers. (Talking about Salesforce's free credits is fine.) | check-rules R1, gate |
| 1.2 | Never claim SFX is a Salesforce, Anthropic, OpenAI or Google partner. "Independent, not a Salesforce partner" is the honest line. | check-rules R2, gate |
| 1.3 | The public founder and author is **Abhay Nama**. "Ask Krrish" is only a product name. | check-rules R3 |
| 1.4 | Contact: WhatsApp 9414849173, calls 7611896026. No other phone numbers. | check-rules R11 |
| 1.5 | No personal email addresses, API keys or tokens in the site. | check-rules R7, R8 |
| 1.6 | Truth only: no invented numbers, clients, ratings, savings, testimonials or reviews. Every review, rating or quote must be real, named and checkable, or it does not go on the site. | gate, reader (trust) |
| 1.7 | Focus: Salesforce + AI only (Agentforce, Prompt Builder, Models API, Data Cloud RAG, MCP, LLMs from Apex, AI cost). | gate, human |
| 1.8 | We want to be the first result for "SFX Salesforce". Keep `alternateName` and `sameAs` in the Organization schema. | gate |

## 2. Content

| # | Rule | Checked by |
|---|------|------------|
| 2.1 | Solve the reader's problem on the page: full code, metadata, steps and test commands ("Solution kit"). Never answer with "use SFX Debug Log Analyzer" or "ask Ask Krrish". CTAs go to `/services/`. | check-rules R4 (posts), gate |
| 2.2 | Code claimed as tested must be tested in the dummy org `khemjiorgs`, recorded in `tested_on`. | human |
| 2.3 | Technical facts are checked against official Salesforce docs. One LLM's word is not enough, especially for prices. | gate |
| 2.4 | Write short. "Chhota likho, kam likho, par achchha likho." Cut repeated caveats; one honest note beats three. | reader (read), gate |
| 2.5 | Sound like a person. No machine tells ("delve", "seamless", "leverage", "unlock", "in today's fast-paced world", "it's not just X, it's Y"). Few em dashes. | check-rules W1/W2 (warn), reader (human) |
| 2.6 | Titles say the specific thing (the news itself, the error itself, the finding). No generic or keyword-stuffed titles. | reader (title) |
| 2.7 | Copyright: own words; at most one quote under 15 words per piece, with attribution. | gate |
| 2.8 | Sources are real pages that were opened, with dates. No `vertexaisearch` redirect links. | check-rules R6, gate |

## 3. News (`/news/`)

| # | Rule | Checked by |
|---|------|------------|
| 3.1 | News lives in `/news/`, not in the blog (`sfx_news: true`, `sfx_blog: false`). | gate |
| 3.2 | Daily format: `today` teasers (curiosity, not summaries) → hook → `## The story` (no verdict) → `<!-- ai-panel -->` → `## Do this` ending in **Our read:** → `## Quick hits` → `## Sources` with dates. No FAQ in the body. | check-rules R9/R10, gate (`REVIEW-aidaily.md`) |
| 3.3 | AI panel: real answers from Claude, ChatGPT and Gemini (`make-takes.py`), same facts, same `ai_question`, labelled as AI opinion with the own-company bias note. Never write a model's take by hand. | gate, human |
| 3.4 | AI Daily never skips: new story, else trending, else a fresh angle. | pipeline (`run-news.sh`) |
| 3.5 | Weekly issues: 8 to 12 items, 3 short lines each, 500 to 800 words. | gate (`REVIEW-news.md`) |

## 4. Design and readability (details in `docs/DESIGN.md`)

| # | Rule | Checked by |
|---|------|------------|
| 4.1 | One look: dark, Vercel/Linear style, Geist, bright text on black. New and reworked pages use `layout: default` + `body_class: sfx-clean` + `/assets/css/clean.css`. News uses `news.css`. The old starfield (`HomePageFinalTest`) is being retired. | check-rules D3 (warn), reader (ui) |
| 4.2 | Body text 16 to 18px. Nothing under 14px except icons. Text contrast at least 4.5:1, aim for 7:1. No dark-grey text on black. | check-rules D1/D2 (warn), reader (measured) |
| 4.3 | First screen says what this is, who it is for and why to stay. The answer or the hook comes first. | reader (first, lead) |
| 4.4 | Readers must have a reason to keep going: no summary that answers everything up front, no repeated example. Tools: answer fast, then one obvious next step. | reader (stop) |
| 4.5 | Works on a 390px phone: no tiny text, no sideways scroll, results visible without hunting. | reader (mobile, measured) |
| 4.6 | Images: the gate never sees images. Blog hero banners are off (`show_hero` opt-in). Any image shown on a page must be looked at by a human or Claude in the browser before push. | check-rules D4 (warn), human |
| 4.7 | Show the founder locally before anything visual goes live (`http://127.0.0.1:8766`). | human |

## 5. Site structure

| # | Rule | Checked by |
|---|------|------------|
| 5.1 | Remove pages that nobody uses, and redirect them to the page that replaced them. `/interview-prep/` → `/salesforce-interview-questions/` (retired 27 Nov 2026). | check-rules R5 |
| 5.2 | Redirect pages: `layout: null`, `sitemap: false`, canonical + meta refresh + JS redirect. Remove them from `sitemap.xml` and from navigation. | gate |
| 5.3 | No empty, "coming soon" or placeholder sections on live pages. | reader (ui) |

## 6. Process and safety

| # | Rule | Checked by |
|---|------|------------|
| 6.1 | Push only with `~/sfx-daily/push-live.sh` (rules check → gate → reader review → push). Never `git push` straight. | process |
| 6.2 | A ChatGPT FAIL can be overridden only after 2 to 3 fix rounds, only when official docs prove it wrong, and it must be logged in `~/sfx-daily/logs/overrides.md`. | human |
| 6.3 | Never touch `~/sfx-client-launch` or `~/Downloads/SFXSupportProdcutionV4` (including its `.git`). | human |
| 6.4 | Never enter passwords, payment details or Ads budgets; never accept terms; never post outside the site without the founder's yes. No fake test leads. | human |
| 6.5 | Never edit a shell script while it is running; run a copy. | human |
| 6.6 | Save Claude usage: research, drafts and first reviews go to Gemini (Antigravity) and ChatGPT (Codex). Claude settles disputes and does final checks. | process |
| 6.7 | Install no third-party skills or scripts. | human |
