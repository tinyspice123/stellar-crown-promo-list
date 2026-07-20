"""Tests for sets_js.parse_sets — the one copy of the sets.js parser
that download_assets.py, backup_sheets.py and check_logos.py all share."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
from sets_js import _extract_fields, parse_sets, strip_comments  # noqa: E402

SAMPLE = '''
// header comment
const SETS = {

  "stellar-crown": {          // release comment
    name: "Stellar Crown",
    sheet: "https://docs.google.com/pub?gid=123&single=true&output=csv",
    tcgSet: "sv7",
    tab: "stellar_crown",
  },

  "me02.5": {
    name: "Ascended Heroes",
    code: "ME02.5",
 //   sheet: "https://docs.google.com/pub?gid=PASTE_TAB_GID&output=csv",
    tcgdexSet: "me02.5",
  },

//  "fully-commented": {
//    name: "Never Parsed",
//    sheet: "https://example.com/nope.csv",
//  },

  "one-fifty-one": {
    name: "151",
    sheet: "https://docs.google.com/pub?gid=456&output=csv",
    logo: "https://example.com/151.png",
  },
};
'''


class TestParseSets(unittest.TestCase):
    def setUp(self):
        self.entries = parse_sets(SAMPLE)
        self.by_id = {e["id"]: e for e in self.entries}

    def test_active_entries_found(self):
        self.assertEqual(
            sorted(self.by_id), ["me02.5", "one-fifty-one", "stellar-crown"])

    def test_commented_out_entry_ignored(self):
        self.assertNotIn("fully-commented", self.by_id)

    def test_fields_extracted(self):
        sc = self.by_id["stellar-crown"]
        self.assertEqual(sc["name"], "Stellar Crown")
        self.assertEqual(sc["tcgSet"], "sv7")
        self.assertEqual(sc["tab"], "stellar_crown")
        self.assertIn("output=csv", sc["sheet"])

    def test_commented_field_inside_active_entry_ignored(self):
        # me02.5 has its sheet line commented out - .get must return None
        self.assertIsNone(self.by_id["me02.5"].get("sheet"))
        self.assertEqual(self.by_id["me02.5"]["tcgdexSet"], "me02.5")

    def test_dotted_id_supported(self):
        self.assertIn("me02.5", self.by_id)

    def test_sheet_filter_matches_backup_script_usage(self):
        with_sheets = [(e["id"], e["sheet"]) for e in self.entries
                       if e.get("sheet")]
        self.assertEqual(sorted(i for i, _ in with_sheets),
                         ["one-fifty-one", "stellar-crown"])

    def test_strip_comments_only_removes_full_line_comments(self):
        kept = strip_comments('  url: "https://a//b",\n// gone\n')
        self.assertIn("https://a//b", kept)   # // inside a string survives
        self.assertNotIn("gone", kept)

    def test_real_sets_js_parses(self):
        src = (Path(__file__).resolve().parent.parent / "sets.js").read_text(
            encoding="utf-8")
        entries = parse_sets(src)
        self.assertGreater(len(entries), 0)
        self.assertTrue(all("id" in e and "name" in e for e in entries))

    def test_malformed_fields_are_ignored(self):
        fields = _extract_fields('''
          bad-key: "not an identifier",
          numeric: 123,
          unclosed: "missing end,
          valid: "kept",
        ''')
        self.assertEqual(fields, {"valid": "kept"})


if __name__ == "__main__":
    unittest.main()
