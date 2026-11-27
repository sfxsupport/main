# AGENTS.md: sfxsupport.com

For every AI agent working in this repo (ChatGPT/Codex, Gemini/Antigravity, Claude) and for human contributors.

**Read first:** `docs/RULES.md` (the rules), `docs/DESIGN.md` (how pages look), `docs/DECISIONS.md` (why). If anything here conflicts with an older file, `docs/RULES.md` wins.

## What this is

sfxsupport.com is a Jekyll site on GitHub Pages for **SFX Support**, a paid Salesforce + AI solutions business. The founder is Abhay Nama. The goal is to be the first result for Salesforce + AI problems through working solutions, tools and daily news.

## Hard rules (a FAIL if broken)

1. No "free", "community", "volunteer" or "non-commercial" wording about SFX. Never claim to be a Salesforce, Anthropic, OpenAI or Google partner.
2. Truth only. No invented numbers, clients, ratings, testimonials or reviews. Facts must match official docs, and sources must be real, dated pages.
3. Solve the problem on the page (full code, steps, tests). Never "use the SFX Debug Log Analyzer" or "ask Ask Krrish". CTAs go to `/services/`.
4. Public founder and author: Abhay Nama. Phones: WhatsApp 9414849173, calls 7611896026. No personal emails, keys or tokens.
5. Readable: body text 16 to 18px, nothing under 14px, text contrast 4.5:1 or better, works at 390px. New pages use `layout: default` + `body_class: sfx-clean` + `/assets/css/clean.css`, not the starfield layout.
6. Write short and like a person. No "delve", "seamless", "leverage" or "unlock". Few em dashes. Specific titles.
7. Retired URLs stay retired (`/interview-prep/` → `/salesforce-interview-questions/`).

## Before you hand back a change

```sh
python3 scripts/check-rules.py --all                 # must print 0 FAIL
python3 scripts/check-rules.py --diff origin/gh-pages # read the WARNs too
```

Then push only through `~/sfx-daily/push-live.sh`. It runs the rules check, the review gate (Claude or Gemini, then ChatGPT) and the reader review (screenshots plus measured typography), and pushes only if all pass. GitHub Actions runs `check-rules.py --all` again before deploying.

## When the founder gives a new standing instruction

Add it to `docs/RULES.md` and `docs/DECISIONS.md`. If a machine can check it, add the check to `scripts/check-rules.py`, `~/sfx-daily/REVIEW.md` or `~/sfx-daily/REVIEW-reader.md`. A rule that only lives in chat is not enforced.

## Layout of the repo

- `_layouts/`: `default` (site shell), `news-post`, `blog-post`, `HomePageFinalTest` (old starfield, retiring).
- `_posts/`: blog posts and news issues (`sfx_news: true`).
- `assets/css/clean.css` (tools, learning, company pages) and `assets/css/news.css` (news).
- `agentforce-pricing-calculator/`, `salesforce-interview-questions/`, `services/`, `learning/`, `news/`: main pages.
- `scripts/check-rules.py`: the rules as code. `docs/`: rules, design and decisions. Both are excluded from the built site.
- Pipelines (daily posts, news, review) live outside the repo in `~/sfx-daily` (see its README).
