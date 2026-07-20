"""Tests for download_images.py - run: python3 -m unittest discover -s tests"""
import contextlib, csv, io, os, runpy, sys, tempfile, unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "download_images.py"

def make_fixture(tmp: Path):
    img_ok = tmp / "src_ok.jpg"; img_ok.write_bytes(b"\xff\xd8\xffFAKEJPEG")
    rows = [
        ["Group","Card","No.","Variant / Stamp","Source","Status","Price","Have","Image URL"],
        ["Play! stamps","Iron Boulder","071/142","Play! stamp - Non-holo","PPS6","","1","1", img_ok.as_uri()],
        ["","Lapras","031/142","Cosmos holo","Blister","","2","", img_ok.as_uri()],
        ["","Lapras","031/142","Cosmos holo","Blister","","2","", img_ok.as_uri()],
        ["","Meltan","102/142","Regular","","","","", (tmp/"missing.jpg").as_uri()],
    ]
    f = tmp / "sheet.csv"
    with open(f, "w", newline="", encoding="utf-8") as fh:
        csv.writer(fh).writerows(rows)
    return f


def run_script(args, cwd):
    """Execute the script in-process so coverage sees its production lines."""
    output = io.StringIO()
    previous = Path.cwd()
    try:
        os.chdir(cwd)
        with mock.patch.object(sys, "argv", [str(SCRIPT), *map(str, args)]), \
                contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
            try:
                runpy.run_path(str(SCRIPT), run_name="__main__")
                code = 0
            except SystemExit as exc:
                code = exc.code if isinstance(exc.code, int) else 1
    finally:
        os.chdir(previous)
    return code, output.getvalue()

class DownloadImagesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp())
        cls.csvf = make_fixture(cls.tmp)
        cls.code, cls.out = run_script([cls.csvf, "test-set"], cls.tmp)
        cls.imgdir = cls.tmp / "public" / "img" / "test-set"

    def test_success_exit_code(self):
        self.assertEqual(self.code, 0)

    def test_header_autodetect(self):
        self.assertIn("'No.'", self.out)
        self.assertIn("'Variant / Stamp'", self.out)
        self.assertIn("'Image URL'", self.out)

    def test_downloads_and_manifest_format(self):
        manifest = (self.imgdir / "manifest.txt").read_text().strip().splitlines()
        self.assertTrue(any(l.startswith("Iron Boulder|071/142|Play! stamp - Non-holo|") for l in manifest))
        for line in manifest:
            self.assertEqual(len(line.split("|")), 4, f"manifest line not 4 fields: {line}")

    def test_duplicate_reported_not_silent(self):
        self.assertIn("share an identical Card+Number+Variant", self.out)
        self.assertIn("Lapras 031/142", self.out)

    def test_failed_download_excluded_from_manifest(self):
        manifest = (self.imgdir / "manifest.txt").read_text()
        self.assertNotIn("Meltan", manifest)

    def test_filenames_include_number(self):
        files = [p.name for p in self.imgdir.glob("*.jpg")]
        self.assertTrue(any(f.startswith("iron_boulder_071_") for f in files), files)

    def test_usage_invalid_set_and_missing_file(self):
        code, out = run_script([], self.tmp)
        self.assertEqual(code, 1)
        self.assertIn("Usage:", out)

        code, out = run_script([self.csvf, "../escape"], self.tmp)
        self.assertEqual(code, 1)
        self.assertIn("Invalid set id", out)

        code, out = run_script([self.tmp / "absent.csv", "valid"], self.tmp)
        self.assertEqual(code, 1)
        self.assertIn("File not found", out)

    def test_empty_and_unrecognised_csv(self):
        empty = self.tmp / "empty.csv"
        empty.write_text("", encoding="utf-8")
        code, out = run_script([empty, "empty"], self.tmp)
        self.assertEqual(code, 1)
        self.assertIn("Empty CSV", out)

        unknown = self.tmp / "unknown.csv"
        unknown.write_text("Name,Value\nfoo,bar\n", encoding="utf-8")
        code, out = run_script([unknown, "unknown"], self.tmp)
        self.assertEqual(code, 1)
        self.assertIn("Couldn't find a header row", out)

    def test_optional_columns_and_default_image_directory(self):
        source = self.tmp / "small.png"
        source.write_bytes(b"PNG" * 50)
        sheet = self.tmp / "minimal.csv"
        with sheet.open("w", newline="", encoding="utf-8") as handle:
            csv.writer(handle).writerows([
                ["Card", "Image URL"],
                ["Pikachu", source.as_uri()],
                ["", source.as_uri()],
            ])
        case_dir = Path(tempfile.mkdtemp())
        code, out = run_script([sheet], case_dir)
        self.assertEqual(code, 0)
        self.assertIn("No set id given", out)
        self.assertIn("No variant-like column", out)
        self.assertIn("No number-like column", out)
        self.assertTrue((case_dir / "public" / "img" / "manifest.txt").exists())

if __name__ == "__main__":
    unittest.main()
