# CLAUDE.md: sfxsupport.com

@AGENTS.md
@docs/RULES.md
@docs/DESIGN.md

## Claude-specific

- The founder writes in Hinglish and often asks "sach batao, kya tum ise padhoge?" Answer honestly, based on evidence (screenshots, measured numbers, reader-review scores), not reassurance.
- Show visual changes locally first: build to the scratchpad and serve on `http://127.0.0.1:8766`, then check in Chrome at 1366px and 390px. Look at every image yourself; the gate can't.
- Run the reader review on any page you change: `python3 -I ~/sfx-daily/reader-review.py --site <built site> /path/`. Fix the findings and run it again until it PASSes. Don't stop at the first PASS if the founder's own complaint isn't fixed yet.
- Save Claude usage: research, drafts and first reviews go to Gemini (`~/sfx-daily/ai.py gemini`) and ChatGPT (`ai.py chatgpt`). Claude settles disputes against official docs.
- When the founder gives a new standing instruction, update `docs/RULES.md`, `docs/DECISIONS.md` and, where possible, `scripts/check-rules.py` in the same turn, and tell them which parts only a human can check.
- Commit identity: `git -c user.name="SFX Support" -c user.email="sfxsupport@users.noreply.github.com"`. Never push except through `~/sfx-daily/push-live.sh`.
