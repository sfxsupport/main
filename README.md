# sfxsupport.com

Source for **sfxsupport.com**, the site of SFX Support. We publish working Salesforce + AI solutions, tools and daily news. The founder is Abhay Nama.

## Start here

| File | What it is |
|---|---|
| `docs/RULES.md` | Every standing rule, and what enforces each one. |
| `docs/DESIGN.md` | The look: dark, Geist, readable. Tokens, type scale, layouts. |
| `docs/DECISIONS.md` | Why things are the way they are, including the themes tried and rejected. |
| `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` | Instructions for the AI agents that work on the site. |
| `scripts/check-rules.py` | The rules a machine can check. |

## Run locally

```sh
export PATH=/opt/homebrew/opt/ruby/bin:$HOME/.gem/sfx/bin:$PATH GEM_HOME=$HOME/.gem/sfx
bundle exec jekyll build -d /tmp/sfx-site && cd /tmp/sfx-site && python3 -m http.server 8766
```

## Ship a change

1. Commit on `ads/landing-conversion`.
2. Run `python3 scripts/check-rules.py --diff origin/gh-pages`.
3. Run `~/sfx-daily/push-live.sh`. It checks the rules, runs the two-model review gate and the reader review, then pushes to `gh-pages`.
4. GitHub Actions checks the rules again, then builds and deploys.

Nothing goes live without passing all of these.
