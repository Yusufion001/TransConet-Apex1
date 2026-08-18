from pathlib import Path
import re
import shutil
from datetime import datetime

ROOT = Path("src")
BACKUP = Path("scripts/zod-backup")
REPORT = Path("ZOD_INTEGRATION_REPORT.md")

BACKUP.mkdir(parents=True, exist_ok=True)

# Routes that require provider/domain-specific handling and must NOT
# be automatically rewritten.
MANUAL_ROUTES = {
    "src/payments/payment.routes.ts:/webhook",
    "src/verification/youverify/youverify.webhook.routes.ts:/webhook",
    "src/verification/verification.routes.ts:/start",
}

# Existing validator files are never overwritten.
VALIDATOR_FILES = sorted(ROOT.rglob("*.validators.ts"))

report = []
changed = []
skipped = []
warnings = []

def backup(path: Path):
    rel = path.relative_to(ROOT)
    target = BACKUP / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        shutil.copy2(path, target)

def add_report(text=""):
    report.append(text)

add_report("# TransConet-Apex1 — Zod Integration Report")
add_report("")
add_report(f"Generated: {datetime.now().isoformat()}")
add_report("")
add_report("## Existing validator files")
for p in VALIDATOR_FILES:
    add_report(f"- `{p}`")

add_report("")
add_report("## Automatic integration policy")
add_report("")
add_report("- Existing validators are never overwritten.")
add_report("- Existing `.parse()` / `.safeParse()` usage is preserved.")
add_report("- Provider-specific webhook routes are skipped.")
add_report("- Verification start is skipped until its exact domain schema is defined.")
add_report("- Generic `req.body` spreads are not automatically rewritten.")
add_report("- Every automatic change is backed up before modification.")

# ---------------------------------------------------------------------------
# Inventory all route files and identify write endpoints.
# ---------------------------------------------------------------------------

route_pattern = re.compile(
    r'router\.(post|put|patch|delete)\s*\(',
    re.IGNORECASE,
)

for path in sorted(ROOT.rglob("*.routes.ts")):
    text = path.read_text(errors="ignore")
    lines = text.splitlines()

    matches = list(route_pattern.finditer(text))

    for match in matches:
        line_no = text.count("\n", 0, match.start()) + 1

        after = text[match.end():match.end() + 500]
        route_match = re.search(r'["`]([^"`]+)["`]', after)
        route = route_match.group(1) if route_match else "<dynamic>"

        key = f"{path}:{route}"

        # Locate handler block approximately.
        start_line = line_no - 1
        end_line = len(lines)

        for i in range(start_line + 1, len(lines)):
            if re.search(
                r'^\s*router\.(get|post|put|patch|delete)\s*\(',
                lines[i],
                re.IGNORECASE,
            ):
                end_line = i
                break

        block = "\n".join(lines[start_line:end_line])

        has_body = "req.body" in block
        has_params = "req.params" in block
        has_query = "req.query" in block
        has_zod = bool(
            re.search(r'\.parse\s*\(', block)
            or re.search(r'\.safeParse\s*\(', block)
            or re.search(r'validateBody\s*\(', block)
            or re.search(r'validateParams\s*\(', block)
            or re.search(r'validateQuery\s*\(', block)
        )

        add_report("")
        add_report(
            f"### `{path}` — `{match.group(1).upper()} {route}`"
        )
        add_report(
            f"- Line: `{line_no}`"
        )
        add_report(
            f"- Body: `{has_body}`"
        )
        add_report(
            f"- Params: `{has_params}`"
        )
        add_report(
            f"- Query: `{has_query}`"
        )
        add_report(
            f"- Zod already present: `{has_zod}`"
        )

        if key in MANUAL_ROUTES:
            skipped.append(key)
            add_report("- **ACTION: MANUAL REVIEW REQUIRED**")
            continue

        if has_zod:
            skipped.append(key)
            add_report("- ACTION: already validated / middleware detected")
            continue

        if has_body:
            warnings.append(key)
            add_report(
                "- ACTION: body detected but no safe automatic schema mapping; "
                "requires domain-specific validator."
            )
        elif has_params:
            warnings.append(key)
            add_report(
                "- ACTION: params detected; UUID/schema validation requires "
                "domain-specific confirmation."
            )
        elif has_query:
            warnings.append(key)
            add_report(
                "- ACTION: query detected; requires query schema."
            )
        else:
            add_report(
                "- ACTION: no request body/params/query detected; "
                "no automatic Zod change made."
            )

# ---------------------------------------------------------------------------
# Final summary.
# ---------------------------------------------------------------------------

add_report("")
add_report("## Summary")
add_report("")
add_report(f"- Routes inspected: {len(matches) if 'matches' in locals() else 0}")
add_report(f"- Existing validator files: {len(VALIDATOR_FILES)}")
add_report(f"- Skipped/already validated/manual: {len(skipped)}")
add_report(f"- Routes requiring domain-specific integration: {len(warnings)}")
add_report(f"- Files automatically changed: {len(changed)}")
add_report("")
add_report("## Important")
add_report("")
add_report(
    "This master audit intentionally does NOT invent validation rules. "
    "Routes whose input shape cannot be safely inferred are reported for "
    "domain-specific schema creation instead."
)

REPORT.write_text("\n".join(report) + "\n")

print("=" * 80)
print("TRANSCONET-APEX1 MASTER ZOD INTEGRATION AUDIT")
print("=" * 80)
print(f"Validator files found : {len(VALIDATOR_FILES)}")
print(f"Manual/skipped routes : {len(skipped)}")
print(f"Needs domain schemas  : {len(warnings)}")
print(f"Files changed         : {len(changed)}")
print(f"Report                : {REPORT}")
print(f"Backups               : {BACKUP}")
print("=" * 80)
