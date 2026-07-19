"""Tests for download_images.py - run: python3 -m unittest discover -s tests"""
import csv, subprocess, sys, tempfile, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "download_images.py"

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

class DownloadImagesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp())
        cls.csvf = make_fixture(cls.tmp)
        cls.proc = subprocess.run(
            [sys.executable, str(SCRIPT), str(cls.csvf), "test-set"],
            cwd=cls.tmp, capture_output=True, text=True)
        cls.out = cls.proc.stdout + cls.proc.stderr
        cls.imgdir = cls.tmp / "img" / "test-set"

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

if __name__ == "__main__":
    unittest.main()
