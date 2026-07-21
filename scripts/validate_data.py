#!/usr/bin/env python3
"""Validate backed-up collection sheets and exact-variant image manifests.

Run from the repository root with:  python scripts/validate_data.py
The checks are deliberately offline so they are deterministic in CI.
"""

from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sets_js import parse_sets


QUANTITY = re.compile(r"^(?:\d+|true|false|yes|no|y|n|x|-|–)$", re.IGNORECASE)
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".svg"}


def normalized_key(card: str, number: str, variant: str) -> str:
    """Return the same logical identity used by the image manifest."""
    stable_number = number.split("(", 1)[0]
    return "|".join(canonical_manifest_text(part)
                    for part in (card, stable_number, variant))


def canonical_manifest_text(value: str) -> str:
    """Ignore cosmetic case, whitespace and punctuation in manifest keys."""
    return " ".join("".join(char if char.isalnum() else " " for char in value.casefold()).split())


def find_column(header: list[str], *needles: str) -> int | None:
    lowered = [value.strip().casefold() for value in header]
    return next((i for i, value in enumerate(lowered)
                 if any(needle in value for needle in needles)), None)


def sheet_columns(path: Path, rows: list[list[str]]) -> tuple[list[str], int, tuple[int, ...]]:
    """Locate and validate the required sheet columns."""
    header_index = next((i for i, row in enumerate(rows[:5])
                         if find_column(row, "card") is not None), -1)
    if header_index < 0:
        return [f"{path}: no Card header in the first five rows"], -1, ()
    header = rows[header_index]
    columns = {
        "card": find_column(header, "card"),
        "number": find_column(header, "number", "no."),
        "variant": find_column(header, "variant", "stamp"),
        "have": find_column(header, "have", "own", "qty", "quantity"),
    }
    errors = [f"{path}: missing {name.title()} column"
              for name, index in columns.items() if index is None]
    if errors:
        return errors, header_index, ()
    return errors, header_index, tuple(columns.values())


def row_value(row: list[str], index: int) -> str:
    return row[index].strip() if index < len(row) else ""


def validate_sheet_row(path: Path, line_number: int, row: list[str],
                       columns: tuple[int, ...], identities: set[str]) -> list[str]:
    """Validate one card row; group headings return no errors or identity."""
    card_i, number_i, variant_i, have_i = columns
    card = row_value(row, card_i)
    if not card:
        return []
    number = row_value(row, number_i)
    variant = row_value(row, variant_i)
    quantity = row_value(row, have_i)
    errors = []
    if not number:
        errors.append(f"{path}:{line_number}: {card!r} has no collector number")
    identity = normalized_key(card, number, variant)
    if identity in identities:
        errors.append(
            f"{path}:{line_number}: duplicate card/number/variant {card!r} / "
            f"{number!r} / {variant!r}")
    identities.add(identity)
    if quantity and not QUANTITY.fullmatch(quantity):
        errors.append(f"{path}:{line_number}: invalid Have value {quantity!r}")
    return errors


def validate_sheet(path: Path) -> tuple[list[str], set[str]]:
    """Validate one CSV backup and return errors plus its card identities."""
    errors: list[str] = []
    with path.open(newline="", encoding="utf-8-sig") as handle:
        rows = list(csv.reader(handle))
    if not rows:
        return [f"{path}: empty CSV"], set()
    errors, header_index, columns = sheet_columns(path, rows)
    if errors:
        return errors, set()
    identities: set[str] = set()
    for line_number, row in enumerate(rows[header_index + 1:], header_index + 2):
        errors.extend(validate_sheet_row(path, line_number, row, columns, identities))
    if not identities:
        errors.append(f"{path}: contains no card rows")
    return errors, identities


def parse_manifest_line(path: Path, line_number: int, raw: str):
    """Parse one manifest line, returning None for intentional blank lines."""
    if not raw.strip():
        return None
    parts = raw.split("|")
    if len(parts) < 4:
        return "", "", [f"{path}:{line_number}: expected card|number|variant|filename"]
    filename = parts[-1].strip()
    identity = normalized_key(parts[0], parts[1], "|".join(parts[2:-1]))
    return identity, filename, []


def validate_manifest_entry(path: Path, line_number: int, identity: str,
                            filename: str, manifest_keys: set[str],
                            sheet_keys: set[str]) -> tuple[list[str], bool]:
    """Validate a parsed manifest entry; bool says whether its file is safe."""
    errors = []
    if identity in manifest_keys:
        errors.append(f"{path}:{line_number}: duplicate manifest identity {identity!r}")
    manifest_keys.add(identity)
    if filename != Path(filename).name or "/" in filename or "\\" in filename:
        errors.append(f"{path}:{line_number}: filename must not contain a path")
        return errors, False
    if not (path.parent / filename).is_file():
        errors.append(f"{path}:{line_number}: missing image file {filename!r}")
    if sheet_keys and identity not in sheet_keys:
        errors.append(f"{path}:{line_number}: image mapping is not present in the sheet")
    return errors, True


def validate_manifest(path: Path, sheet_keys: set[str]) -> list[str]:
    """Ensure every manifest mapping is unique, safe, present and in the sheet."""
    errors: list[str] = []
    manifest_keys: set[str] = set()
    referenced_files: set[str] = set()
    for line_number, raw in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), 1):
        parsed = parse_manifest_line(path, line_number, raw)
        if parsed is None:
            continue
        identity, filename, parse_errors = parsed
        errors.extend(parse_errors)
        if parse_errors:
            continue
        entry_errors, safe_file = validate_manifest_entry(
            path, line_number, identity, filename, manifest_keys, sheet_keys)
        errors.extend(entry_errors)
        if safe_file:
            referenced_files.add(filename)

    actual_images = {
        item.name for item in path.parent.iterdir()
        if item.is_file() and item.suffix.casefold() in IMAGE_SUFFIXES
    }
    for filename in sorted(actual_images - referenced_files):
        errors.append(f"{path.parent / filename}: image is not referenced by manifest.txt")
    return errors


def validate_repository(root: Path) -> list[str]:
    errors: list[str] = []
    sets_source = (root / "public" / "sets.js").read_text(encoding="utf-8")
    sets = parse_sets(sets_source)
    configured = {entry["id"] for entry in sets if entry.get("sheet")}
    keys_by_set: dict[str, set[str]] = {}

    for set_id in sorted(configured):
        backup = root / "backups" / f"{set_id}.csv"
        if not backup.is_file():
            errors.append(f"{backup}: configured set has no backup")
            continue
        sheet_errors, keys = validate_sheet(backup)
        errors.extend(sheet_errors)
        keys_by_set[set_id] = keys

    for backup in sorted((root / "backups").glob("*.csv")):
        if backup.stem not in configured:
            errors.append(f"{backup}: backup does not belong to a configured set")

    image_root = root / "public" / "img"
    if image_root.is_dir():
        for directory in sorted(item for item in image_root.iterdir() if item.is_dir()):
            manifest = directory / "manifest.txt"
            images = [item for item in directory.iterdir()
                      if item.is_file() and item.suffix.casefold() in IMAGE_SUFFIXES]
            if images and not manifest.is_file():
                errors.append(f"{directory}: contains images but no manifest.txt")
            elif manifest.is_file():
                errors.extend(validate_manifest(manifest, keys_by_set.get(directory.name, set())))
    return errors


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    errors = validate_repository(root)
    if errors:
        print("Collection data validation FAILED:", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1
    sets_source = (root / "public" / "sets.js").read_text(encoding="utf-8")
    configured_count = sum(1 for entry in parse_sets(sets_source)
                           if entry.get("sheet"))
    print(f"Collection data valid: {configured_count} sheet backup(s) and image manifests checked")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
