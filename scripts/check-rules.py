#!/usr/bin/env python3
"""SFX rules check: the founder's standing instructions as machine checks.

Every rule here is written down in docs/RULES.md (the "Checked by" column says check-rules).
Rules that need judgement (tone, readability, facts) are left to the review gate and the reader review.

  python3 scripts/check-rules.py --all            # whole site (GitHub Actions runs this before every deploy)
  python3 scripts/check-rules.py --diff BASE      # only lines added since BASE, plus WARN-level style checks

Exit 1 if any FAIL. WARNs are printed but do not block.
"""
import os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {".git", "node_modules", "_site", ".jekyll-cache", "vendor", "scripts", "docs", "_drafts", ".github", "src"}
SKIP_FILES = {"AGENTS.md", "CLAUDE.md", "GEMINI.md", "README.md", "package-lock.json", "Gemfile.lock"}  # rule docs quote the banned words
TEXT_EXT = (".html", ".md", ".yml", ".yaml", ".txt", ".xml", ".json")
OK_PHONES = {"9414849173", "7611896026"}  # WhatsApp, calls

# (id, level, pattern, message, path filter)
RULES = [
    ("R1-no-free", "FAIL", r"(?i)\b(free forever|free community|community[- ]driven initiative|community initiative|non[- ]commercial|volunteer[- ]run|run by volunteers|in (my|our) personal capacity|100% free|always free)\b",
     "SFX is a paid business: no free/community/volunteer wording about SFX", None),
    ("R2-no-partner", "FAIL", r"(?i)(\b(SFX|SFX Support) (is|are) (an? )?(official |certified |registered )?(salesforce|anthropic|openai|google)[\w ]{0,20}partner|\b(official|certified|registered|authorised|authorized) (salesforce|anthropic|openai|google) (consulting )?partner\b(?! tier)|\bpartnered with (salesforce|anthropic|openai|google)\b)",
     "never claim to be a Salesforce/Anthropic/OpenAI/Google partner (saying 'not a ... partner' is fine)", None),
    ("R3-founder", "FAIL", r"Krrish Joshi", "the public founder/author is Abhay Nama", None),
    ("R4-no-tool-plug", "FAIL", r"(?i)(debug log analyzer|ask krrish)", "posts must solve the problem themselves, not point to SFX tools", r"^_posts/"),
    ("R5-retired-url", "FAIL", r"/interview-prep/", "/interview-prep/ is retired; link /salesforce-interview-questions/", r"^(?!interview-prep/)"),
    ("R6-no-vertex-links", "FAIL", r"vertexaisearch\.cloud\.google\.com", "Gemini grounding redirect links are not real sources", None),
    ("R7-personal-email", "FAIL", r"[A-Za-z0-9._%+-]+@(gmail|yahoo|hotmail|outlook)\.com", "no personal email addresses on the site", None),
    ("R8-secrets", "FAIL", r"(sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{35}|gh[pous]_[A-Za-z0-9]{30,}|xox[bp]-[A-Za-z0-9-]{20,})", "looks like an API key or token", None),
]
PARTNER_OK = re.compile(r"(?i)(not|isn't|is not|never|no)\b[^.]{0,40}partner|independent")
PHONE = re.compile(r"(?:tel:\+?(?:91)?|wa\.me/(?:91)?|api\.whatsapp\.com/send\?phone=(?:91)?)([6-9]\d{9})")

# WARN-level: style rules, checked on new lines only (--diff)
TELLS = ["delve", "paradigm shift", "unprecedented", "seamless", "robust", "leverage", "fast-paced", "game-changer",
         "game changer", "unlock the", "elevate", "empower", "cutting-edge", "revolutioniz", "in today's fast", "in today's world", "in today's digital", "it's not just",
         "harness the", "tapestry", "embark", "realm of", "pivotal", "synergy", "holistic", "transformative", "ever-evolving"]

def files_all():
    for d, dirs, fs in os.walk(ROOT):
        dirs[:] = [x for x in dirs if x not in SKIP_DIRS and not x.startswith(".")]
        for f in fs:
            if f.endswith(TEXT_EXT) and f not in SKIP_FILES:
                p = os.path.join(d, f)
                yield os.path.relpath(p, ROOT), open(p, errors="ignore").read().split("\n")

def added_lines(base):
    out = subprocess.run(["git", "-C", ROOT, "diff", "-U0", f"{base}...HEAD"], capture_output=True, text=True).stdout
    cur, res = None, {}
    for line in out.split("\n"):
        if line.startswith("+++ "):
            cur = line[6:] if line.startswith("+++ b/") else None
        elif line.startswith("+") and cur and not line.startswith("+++"):
            res.setdefault(cur, []).append(line[1:])
    return res

def skip(path):
    parts = path.split("/")
    return any(p in SKIP_DIRS for p in parts[:-1]) or parts[-1] in SKIP_FILES or not path.endswith(TEXT_EXT + (".css",))

def front_matter(text):
    m = re.match(r"---\n(.*?)\n---\n(.*)", text, re.S)
    return (m.group(1), m.group(2)) if m else ("", text)

def check_news(path, text, issues):
    fm, body = front_matter(text)
    if "sfx_news: true" not in fm:
        return
    if "## Sources" not in body and len(re.findall(r"\]\(https?://(?!sfxsupport\.com)", body)) < 5:
        issues.append(("FAIL", path, 0, "R9-news-sources", "news posts end with a dated ## Sources list"))
    if re.search(r"^today:", fm, re.M) and not re.search(r"^series:.*Weekly", fm, re.M):
        for need, why in (("<!-- ai-panel -->", "daily issue needs the <!-- ai-panel --> marker after The story"),
                          ("## Do this", "daily issue needs a ## Do this section"),
                          ("## Quick hits", "daily issue needs ## Quick hits")):
            if need not in body:
                issues.append(("FAIL", path, 0, "R10-daily-format", why))
        if not re.search(r"^ai_question:", fm, re.M):
            issues.append(("FAIL", path, 0, "R10-daily-format", "daily issue needs an ai_question"))
        if re.search(r"(?im)^##\s*(faq|frequently asked)", body):
            issues.append(("FAIL", path, 0, "R10-daily-format", "no FAQ section in the body of a daily issue (FAQ lives in front matter only)"))

def scan(path, lines, issues):
    for rid, lvl, pat, msg, pfilter in RULES:
        if pfilter and not re.search(pfilter, path):
            continue
        rx = re.compile(pat)
        for i, l in enumerate(lines, 1):
            if rx.search(l):
                if rid == "R2-no-partner" and PARTNER_OK.search(l):
                    continue
                if rid == "R8-secrets" and re.search(r"apiKey:\s*\"AIza", l) and "firebase" in "\n".join(lines).lower():
                    continue  # Firebase web config keys are public by design (access is enforced by Firebase rules)
                issues.append((lvl, path, i, rid, msg + f"  | {l.strip()[:110]}"))
    for i, l in enumerate(lines, 1):
        for num in PHONE.findall(l):
            if num not in OK_PHONES:
                issues.append(("FAIL", path, i, "R11-phone", f"phone {num} is not SFX's (WhatsApp 9414849173, calls 7611896026)"))

def style_warns(path, lines, issues):
    joined = "\n".join(lines)
    if path.endswith(".css"):
        for i, l in enumerate(lines, 1):
            sel = l.split("{")[0]
            for px in ([] if re.search(r"(\bi\b|code|::?before|::?after)", sel) and "content:\"0\"" not in l else re.findall(r"font(?:-size)?\s*:[^;]*?\b(\d+(?:\.\d+)?)px", l)):
                if float(px) < 14:
                    issues.append(("WARN", path, i, "D1-min-font", f"{px}px text; minimum is 14px (body 16-18px)"))
            if re.search(r"(^|[;{\s])color\s*:\s*#[3-6][0-9a-f]{2}([0-9a-f]{3})?\b", l, re.I):
                issues.append(("WARN", path, i, "D2-contrast", "dark-grey text colour; on black it fails contrast (use #a1a1a1 or lighter)"))
        return
    low = joined.lower()
    for t in TELLS:
        if t in low:
            issues.append(("WARN", path, 0, "W1-machine-tell", f"'{t}' reads like machine writing"))
    if "—" in joined:
        issues.append(("WARN", path, 0, "W2-em-dash", f"{joined.count('—')} em dashes; use a comma, colon or full stop"))
    if re.search(r"^layout:\s*HomePageFinalTest", joined, re.M):
        issues.append(("WARN", path, 0, "D3-old-theme", "new/changed page on the starfield layout; use layout: default + body_class: sfx-clean"))
    if re.search(r"^show_hero:\s*true", joined, re.M):
        issues.append(("WARN", path, 0, "D4-hero", "hero banner on: the gate never sees images, so a human must look at it"))

def main():
    a = sys.argv[1:]
    issues = []
    if a[:1] == ["--diff"] and len(a) > 1:
        for path, lines in added_lines(a[1]).items():
            if skip(path):
                continue
            if not path.endswith(".css"):
                scan(path, lines, issues)
            style_warns(path, lines, issues)
            full = os.path.join(ROOT, path)
            if path.startswith("_posts/") and os.path.exists(full):
                check_news(path, open(full).read(), issues)
    elif a[:1] == ["--all"]:
        for path, lines in files_all():
            scan(path, lines, issues)
            if path.startswith("_posts/"):
                check_news(path, "\n".join(lines), issues)
    else:
        print(__doc__); return 2
    fails = [x for x in issues if x[0] == "FAIL"]
    for lvl, path, line, rid, msg in sorted(issues, key=lambda x: (x[0] != "FAIL", x[1], x[2])):
        print(f"{lvl} {path}:{line} [{rid}] {msg}")
    print(f"rules check: {len(fails)} FAIL, {len(issues) - len(fails)} WARN (rules: docs/RULES.md)")
    return 1 if fails else 0

if __name__ == "__main__":
    sys.exit(main())
