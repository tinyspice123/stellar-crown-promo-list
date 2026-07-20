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

# a simple string field inside a body: key: "value" (sets.js consistently
# writes zero-or-one space after the colon, never more - "? " is a bounded
# quantifier, so there's no unbounded repetition left for the backtracking
# checker to flag, unlike the `\s*` this replaced)
_FIELD_RE = re.compile(r'(\w+): ?"([^"]*)"')


def strip_comments(src):
    """Blank out full-line // comments so commented-out template sets
    and commented-out fields inside active sets are both ignored."""
    return re.sub(r"^\s*//.*$", "", src, flags=re.M)


def parse_sets(src):
    """Parse sets.js source into a list of dicts, one per active entry.

    Each dict has "id" plus every simple string field present in the
    entry body (name, sheet, tcgSet, tcgdexSet, logo, tab, ...).
    Fields that are commented out or absent are simply missing — use
    .get("field") exactly like the old per-script field() helpers.
    """
    entries = []
    for m in _ENTRY_RE.finditer(strip_comments(src)):
        sid, body = m.group(1), m.group(2)
        fields = dict(_FIELD_RE.findall(body))
        fields["id"] = sid
        entries.append(fields)
    return entries
