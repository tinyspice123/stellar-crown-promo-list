import csv
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from io import StringIO
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from validate_data import (main, validate_manifest, validate_repository,
                           validate_sheet)  # noqa: E402


class SheetValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def write_sheet(self, rows):
        path = self.root / "cards.csv"
        with path.open("w", newline="", encoding="utf-8") as handle:
            csv.writer(handle).writerows(rows)
        return path

    def test_valid_sheet_returns_normalized_card_keys(self):
        path = self.write_sheet([
            ["Group", "Card", "Number", "Variant / Stamp", "Have"],
            ["Base", "", "", "", ""],
            ["", "Pikachu", "025/102", "Unlimited", "2"],
        ])
        errors, keys = validate_sheet(path)
        self.assertEqual(errors, [])
        self.assertEqual(keys, {"pikachu|025 102|unlimited"})

    def test_duplicate_missing_number_and_bad_quantity_are_reported(self):
        path = self.write_sheet([
            ["Card", "Number", "Variant", "Have"],
            ["Pikachu", "", "Unlimited", "sometimes"],
            ["Pikachu", "", "Unlimited", ""],
        ])
        errors, _ = validate_sheet(path)
        joined = "\n".join(errors)
        self.assertIn("no collector number", joined)
        self.assertIn("invalid Have value", joined)
        self.assertIn("duplicate card/number/variant", joined)

    def test_empty_header_and_missing_columns_are_reported(self):
        empty = self.write_sheet([])
        self.assertIn("empty CSV", validate_sheet(empty)[0][0])
        no_header = self.write_sheet([["Group", "Things"], ["Base", "Pikachu"]])
        self.assertIn("no Card header", validate_sheet(no_header)[0][0])
        missing = self.write_sheet([["Card"], ["Pikachu"]])
        errors, keys = validate_sheet(missing)
        self.assertEqual(keys, set())
        self.assertIn("missing Number column", "\n".join(errors))

    def test_group_only_sheet_and_short_rows_are_handled(self):
        path = self.write_sheet([
            ["Card", "Number", "Variant", "Have"],
            [""],
        ])
        errors, keys = validate_sheet(path)
        self.assertEqual(keys, set())
        self.assertIn("contains no card rows", errors[0])


class ManifestValidationTests(unittest.TestCase):
    def test_missing_unmapped_and_orphan_images_are_reported(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "orphan.jpg").write_bytes(b"jpg")
            manifest = root / "manifest.txt"
            manifest.write_text(
                "Pikachu|025/102|Stamped|missing.jpg\n", encoding="utf-8")
            errors = "\n".join(validate_manifest(manifest, {"other|001|normal"}))
            self.assertIn("missing image file", errors)
            self.assertIn("not present in the sheet", errors)
            self.assertIn("not referenced by manifest.txt", errors)

    def test_blank_malformed_duplicate_and_unsafe_entries_are_reported(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "card.jpg").write_bytes(b"jpg")
            manifest = root / "manifest.txt"
            manifest.write_text(
                "\nmalformed\n"
                "Pikachu|025|Stamped|card.jpg\n"
                "Pikachu|025|Stamped|card.jpg\n"
                "Eevee|133|Stamped|../outside.jpg\n",
                encoding="utf-8")
            errors = "\n".join(validate_manifest(manifest, set()))
            self.assertIn("expected card|number|variant|filename", errors)
            self.assertIn("duplicate manifest identity", errors)
            self.assertIn("filename must not contain a path", errors)


class RepositoryValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "public" / "img" / "base").mkdir(parents=True)
        (self.root / "backups").mkdir()

    def tearDown(self):
        self.temp.cleanup()

    def write_registry(self, configured=True):
        sheet = 'sheetGid: "123",' if configured else ""
        (self.root / "public" / "sets.js").write_text(
            'const SHEET_BASE_URL = "https://example.test/pub";\n'
            'const SETS = {\n'
            '  "base": {\n'
            '    name: "Base",\n'
            f'    {sheet}\n'
            '  },\n'
            '};\n',
            encoding="utf-8")

    def write_valid_backup(self, name="base"):
        path = self.root / "backups" / f"{name}.csv"
        with path.open("w", newline="", encoding="utf-8") as handle:
            csv.writer(handle).writerows([
                ["Card", "Number", "Variant", "Have"],
                ["Pikachu", "025", "Stamped", "1"],
            ])

    def test_valid_repository(self):
        self.write_registry()
        self.write_valid_backup()
        image_dir = self.root / "public" / "img" / "base"
        (image_dir / "card.jpg").write_bytes(b"jpg")
        (image_dir / "manifest.txt").write_text(
            "Pikachu|025|Stamped|card.jpg\n", encoding="utf-8")
        self.assertEqual(validate_repository(self.root), [])

    def test_missing_and_unconfigured_backups_and_manifest_are_reported(self):
        self.write_registry()
        self.write_valid_backup("old-set")
        image_dir = self.root / "public" / "img" / "base"
        (image_dir / "orphan.png").write_bytes(b"png")
        errors = "\n".join(validate_repository(self.root))
        self.assertIn("configured set has no backup", errors)
        self.assertIn("backup does not belong to a configured set", errors)
        self.assertIn("contains images but no manifest.txt", errors)


class MainTests(unittest.TestCase):
    def test_main_reports_failure(self):
        output = StringIO()
        with mock.patch("validate_data.validate_repository", return_value=["broken"]), \
                redirect_stderr(output):
            self.assertEqual(main(), 1)
        self.assertIn("broken", output.getvalue())

    def test_main_reports_success(self):
        output = StringIO()
        with mock.patch("validate_data.validate_repository", return_value=[]), \
                redirect_stdout(output):
            self.assertEqual(main(), 0)
        self.assertIn("sheet backup(s)", output.getvalue())


if __name__ == "__main__":
    unittest.main()
