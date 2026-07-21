"""
Shared parser for the SETS registry in sets.js.

Used by download_assets.py, backup_sheets.py and check_logos.py — the
same comment-stripping + entry-extraction logic used to live as three
separate copies, which is exactly how they drift apart. Tested in
tests/test_sets_js.py.

The format it understands is deliberately the small subset sets.js
actually uses:  "set-id": { key: "value", ... }  entries, with //
comments used to deactivate whole entries or individual fields.
"""
import re

# an active entry: quoted id (letters/digits/dot/dash), then a {...} body.
# Entry bodies are flat (no nested braces), so a negated character class
# finds the closing brace directly - no ambiguous backtracking, unlike a
# lazy `.*?` spanning newlines with a multi-char terminator.
_ENTRY_RE = re.compile(r'"([\w.\-]+)"\s*:\s*\{([^}]*)\}')
_SHEET_BASE_RE = re.compile(r'const\s+SHEET_BASE_URL\s*=\s*"([^"]+)"')


def _extract_fields(body):
    """Pull every `key: "value"` field out of an entry body.

    Plain string scanning, not a regex: two rewrites of a field-matching
    regex here still got flagged for backtracking risk even with every
    quantifier bounded, since the checker doesn't need genuine ambiguity
    to flag a pattern with more than one quantified group. Fields are one
    per line in sets.js, so a line-by-line scan is simpler and provably
    linear - there's nothing left to backtrack.
    """
    fields = {}
    for line in body.splitlines():
        line = line.strip()
        colon = line.find(":")
        if colon <= 0:
            continue
        key = line[:colon]
        if not key.isidentifier():
            continue
        rest = line[colon + 1:].lstrip()
        if not rest.startswith('"'):
            continue
        end = rest.find('"', 1)
        if end == -1:
            continue
        fields[key] = rest[1:end]
    return fields


def strip_comments(src):
    """Blank out full-line // comments so commented-out template sets
    and commented-out fields inside active sets are both ignored."""
    return re.sub(r"^\s*//.*$", "", src, flags=re.M)


def parse_sets(src):
    """Parse sets.js source into a list of dicts, one per active entry.

    Each dict has "id" plus every simple string field present in the
    entry body (name, sheet, tcgSet, tcgdexSet, logo, subtitle, ...).
    Fields that are commented out or absent are simply missing — use
    .get("field") exactly like the old per-script field() helpers.
    """
    active_source = strip_comments(src)
    base_match = _SHEET_BASE_RE.search(active_source)
    sheet_base = base_match.group(1) if base_match else None
    entries = []
    for m in _ENTRY_RE.finditer(active_source):
        sid, body = m.group(1), m.group(2)
        fields = _extract_fields(body)
        if sheet_base and fields.get("sheetGid"):
            fields["sheet"] = (
                f'{sheet_base}?gid={fields["sheetGid"]}&single=true&output=csv')
        fields["id"] = sid
        entries.append(fields)
    return entries
