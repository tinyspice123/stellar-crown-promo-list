#!/usr/bin/env python3
"""Re-key a local image manifest to the current wording in a sheet export.

Usage: python scripts/sync_manifest.py path/to/sheet.csv stellar-crown
Add --check to report drift without changing manifest.txt.
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_data import (canonical_manifest_text, find_column,
                           normalized_key)


def resolve_file_within(root: Path, candidate: Path, label: str) -> Path:
    """Resolve an existing file and reject paths escaping the repository."""
    base = root.resolve()
    resolved = candidate.resolve(strict=True)
    if not resolved.is_relative_to(base) or not resolved.is_file():
        raise ValueError(f"{label} must be a file inside {base}")
    return resolved


def read_sheet_cards(path: Path) -> list[tuple[str, str, str]]:
    text = path.read_text(encoding="utf-8-sig")
    dialect = csv.Sniffer().sniff(text[:4096], delimiters=",\t")
    rows = list(csv.reader(text.splitlines(), dialect))
    header_index = next((index for index, row in enumerate(rows[:5])
                         if find_column(row, "card") is not None), -1)
    if header_index < 0:
        raise ValueError("no Card header in the first five rows")
    header = rows[header_index]
    card_i = find_column(header, "card")
    number_i = find_column(header, "number", "no.")
    variant_i = find_column(header, "variant", "stamp")
    if None in (card_i, number_i, variant_i):
        raise ValueError("sheet must contain Card, Number and Variant columns")
    result = []
    for row in rows[header_index + 1:]:
        values = [row[index].strip() if index < len(row) else ""
                  for index in (card_i, number_i, variant_i)]
        if values[0]:
            result.append(tuple(values))
    return result


def variant_similarity(left: str, right: str) -> float:
    left_tokens = set(canonical_manifest_text(left).split())
    right_tokens = set(canonical_manifest_text(right).split())
    union = left_tokens | right_tokens
    return len(left_tokens & right_tokens) / len(union) if union else 1.0


def matching_sheet_row(card: str, number: str, variant: str,
                       rows: list[tuple[str, str, str]]):
    old_key = normalized_key(card, number, variant)
    exact = [row for row in rows if normalized_key(*row) == old_key]
    if len(exact) == 1:
        return exact[0]
    prefix = normalized_key(card, number, "").rsplit("|", 1)[0]
    candidates = [row for row in rows
                  if normalized_key(row[0], row[1], "").rsplit("|", 1)[0] == prefix]
    ranked = sorted(((variant_similarity(variant, row[2]), row) for row in candidates),
                    key=lambda item: item[0], reverse=True)
    if not ranked or ranked[0][0] < 0.65:
        return None
    runner_up = ranked[1][0] if len(ranked) > 1 else 0
    return ranked[0][1] if ranked[0][0] - runner_up >= 0.15 else None


def synchronized_lines(manifest: Path, sheet_rows: list[tuple[str, str, str]]):
    lines = []
    errors = []
    for line_number, raw in enumerate(manifest.read_text(encoding="utf-8-sig").splitlines(), 1):
        if not raw.strip():
            continue
        parts = raw.split("|")
        if len(parts) != 4:
            errors.append(f"line {line_number}: malformed manifest entry")
            continue
        card, number, variant, filename = parts
        match = matching_sheet_row(card, number, variant, sheet_rows)
        if match is None:
            errors.append(
                f"line {line_number}: no unambiguous sheet row for {card} | {number} | {variant}")
            continue
        lines.append("|".join((*match, filename)))
    return lines, errors


def sync_manifest(sheet: Path, set_id: str, root: Path, check: bool = False) -> tuple[int, int]:
    if re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", set_id) is None:
        raise ValueError("set ID must contain only lowercase letters, numbers and hyphens")
    safe_sheet = resolve_file_within(root, sheet, "sheet")
    manifest_candidate = root / "public" / "img" / set_id / "manifest.txt"
    try:
        manifest = resolve_file_within(root, manifest_candidate, "manifest")
    except FileNotFoundError as error:
        raise FileNotFoundError(f"manifest not found: {manifest_candidate}") from error
    new_lines, errors = synchronized_lines(manifest, read_sheet_cards(safe_sheet))
    if errors:
        raise ValueError("\n".join(errors))
    old_lines = [line for line in manifest.read_text(encoding="utf-8-sig").splitlines()
                 if line.strip()]
    changed = sum(old != new for old, new in zip(old_lines, new_lines))
    if len(old_lines) != len(new_lines):
        changed += abs(len(old_lines) - len(new_lines))
    if changed and not check:
        manifest.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
    return len(new_lines), changed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sheet", type=Path)
    parser.add_argument("set_id")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    try:
        entries, changed = sync_manifest(args.sheet, args.set_id, root, args.check)
    except (OSError, ValueError, csv.Error) as error:
        print(f"Manifest sync failed: {error}", file=sys.stderr)
        return 1
    action = "would update" if args.check else "updated"
    print(f"Manifest valid: {entries} entries; {action} {changed}")
    return 1 if args.check and changed else 0


if __name__ == "__main__":
    raise SystemExit(main())
