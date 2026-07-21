import csv
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from io import StringIO
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
import sync_manifest as sync_module  # noqa: E402
from sync_manifest import (matching_sheet_row, read_sheet_cards, sync_manifest,
                           resolve_file_within, synchronized_lines,
                           variant_similarity)  # noqa: E402


class MatchingTests(unittest.TestCase):
    ROWS = [
        ("Raging Bolt", "111/142", "Play stamp Non holo"),
        ("Briar", "132/142", "Regionals promo orange logo"),
        ("Briar", "132/142", "Regionals promo orange logo staff"),
    ]

    def test_cosmetic_variant_edit_matches_exactly(self):
        self.assertEqual(
            matching_sheet_row("Raging Bolt", "111/142", "Play! stamp - Non-holo", self.ROWS),
            self.ROWS[0])

    def test_distinct_wording_uses_unambiguous_similarity(self):
        self.assertEqual(
            matching_sheet_row("Briar", "132/142", "Regionals STAFF - orange logo", self.ROWS),
            self.ROWS[2])
        self.assertGreater(variant_similarity("staff orange logo", "promo staff orange logo"), .65)

    def test_missing_or_ambiguous_match_is_refused(self):
        self.assertIsNone(matching_sheet_row("Missing", "1", "Normal", self.ROWS))
        ambiguous = [("Pikachu", "025", "red one"), ("Pikachu", "025", "red two")]
        self.assertIsNone(matching_sheet_row("Pikachu", "025", "red", ambiguous))


class SyncTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.image_dir = self.root / "public" / "img" / "example"
        self.image_dir.mkdir(parents=True)
        self.manifest = self.image_dir / "manifest.txt"
        self.sheet = self.root / "sheet.csv"

    def tearDown(self):
        self.temp.cleanup()

    def write_sheet(self):
        with self.sheet.open("w", newline="", encoding="utf-8") as handle:
            csv.writer(handle).writerows([
                ["Group", "Card", "Number", "Variant / Stamp"],
                ["Base", "", "", ""],
                ["", "Crabominable", "149/142", "Holiday Calendar stamp"],
            ])

    def test_read_and_sync_rekeys_manifest_without_changing_filename(self):
        self.write_sheet()
        self.manifest.write_text(
            "Crabominable|149/142 (IR)|Holiday Calendar stamp|card.jpg\n",
            encoding="utf-8")
        self.assertEqual(len(read_sheet_cards(self.sheet)), 1)
        self.assertEqual(sync_manifest(self.sheet, "example", self.root), (1, 1))
        self.assertEqual(
            self.manifest.read_text(encoding="utf-8"),
            "Crabominable|149/142|Holiday Calendar stamp|card.jpg\n")

    def test_check_reports_drift_without_writing(self):
        self.write_sheet()
        original = "Crabominable|149/142 (IR)|Holiday Calendar stamp|card.jpg\n"
        self.manifest.write_text(original, encoding="utf-8")
        self.assertEqual(sync_manifest(self.sheet, "example", self.root, check=True), (1, 1))
        self.assertEqual(self.manifest.read_text(encoding="utf-8"), original)

    def test_missing_manifest_and_unmatched_entry_fail(self):
        self.write_sheet()
        with self.assertRaises(FileNotFoundError):
            sync_manifest(self.sheet, "missing", self.root)
        self.manifest.write_text("Pikachu|025|Normal|card.jpg\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "no unambiguous sheet row"):
            sync_manifest(self.sheet, "example", self.root)

    def test_paths_cannot_escape_root_and_set_id_is_restricted(self):
        self.write_sheet()
        with tempfile.NamedTemporaryFile() as outside:
            with self.assertRaisesRegex(ValueError, "inside"):
                resolve_file_within(self.root, Path(outside.name), "sheet")
        with self.assertRaisesRegex(ValueError, "set ID"):
            sync_manifest(self.sheet, "../example", self.root)

    def test_invalid_sheet_headers_and_manifest_lines_are_reported(self):
        self.sheet.write_text("Group,Name\nBase,Pikachu\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "no Card header"):
            read_sheet_cards(self.sheet)
        self.sheet.write_text("Card,Group\nPikachu,Base\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Card, Number and Variant"):
            read_sheet_cards(self.sheet)

        self.manifest.write_text("\nbroken|entry\n", encoding="utf-8")
        lines, errors = synchronized_lines(self.manifest, [])
        self.assertEqual(lines, [])
        self.assertEqual(errors, ["line 2: malformed manifest entry"])


class MainTests(unittest.TestCase):
    def test_success_and_check_drift_exit_codes(self):
        for check, result, expected in (
                (False, (2, 0), 0), (True, (2, 1), 1)):
            argv = ["sync_manifest.py", "sheet.csv", "example"]
            if check:
                argv.append("--check")
            output = StringIO()
            with patch.object(sys, "argv", argv), \
                    patch.object(sync_module, "sync_manifest", return_value=result), \
                    redirect_stdout(output):
                self.assertEqual(sync_module.main(), expected)
            self.assertIn("Manifest valid: 2 entries", output.getvalue())

    def test_failure_exit_code(self):
        error = StringIO()
        with patch.object(sys, "argv", ["sync_manifest.py", "sheet.csv", "example"]), \
                patch.object(sync_module, "sync_manifest", side_effect=ValueError("bad data")), \
                redirect_stderr(error):
            self.assertEqual(sync_module.main(), 1)
        self.assertIn("Manifest sync failed: bad data", error.getvalue())


if __name__ == "__main__":
    unittest.main()
