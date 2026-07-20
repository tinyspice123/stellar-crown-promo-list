"""Unit tests for the network-facing maintenance scripts."""
import contextlib
import io
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

SCRIPTS = Path(__file__).resolve().parents[2] / "scripts"
sys.path.insert(0, str(SCRIPTS))

import backup_sheets  # noqa: E402
import check_logos  # noqa: E402
import download_assets  # noqa: E402


class Response:
    def __init__(self, data):
        self.data = data

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self):
        return self.data


class BackupSheetsTest(unittest.TestCase):
    def test_google_delivery_host_must_match_csp(self):
        source = "https://docs.google.com/spreadsheets/example"
        backup_sheets.validate_delivery_host(
            source,
            f"https://{backup_sheets.SHEET_DELIVERY_HOST}/published.csv")
        with self.assertRaisesRegex(ValueError, "update the Content Security Policy"):
            backup_sheets.validate_delivery_host(
                source, "https://different-shard.googleusercontent.com/file.csv")

    def test_no_sheet_links_is_success(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            result = backup_sheets.backup([{"id": "empty"}])
        self.assertEqual(result, 0)
        self.assertIn("No sets", output.getvalue())

    def test_success_html_response_and_network_failure(self):
        out = Path(tempfile.mkdtemp()) / "backups"
        seen = []

        def opener(request, timeout):
            seen.append((request, timeout))
            if request.full_url.endswith("good"):
                return Response(b"Card,Have\nPikachu,1\n")
            if request.full_url.endswith("html"):
                return Response(b" <html>not published</html>")
            raise OSError("offline")

        entries = [
            {"id": "good", "sheet": "https://example.test/good"},
            {"id": "html", "sheet": "https://example.test/html"},
            {"id": "bad", "sheet": "https://example.test/bad"},
            {"id": "ignored"},
        ]
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            result = backup_sheets.backup(entries, out, opener)
        self.assertEqual(result, 1)
        self.assertEqual((out / "good.csv").read_text(encoding="utf-8"),
                         "Card,Have\nPikachu,1\n")
        self.assertEqual([timeout for _, timeout in seen], [30, 30, 30])
        self.assertIn("card-tracker-backup", seen[0][0].get_header("User-agent"))
        self.assertIn("Failed: html, bad", output.getvalue())

    def test_all_sheets_backed_up_returns_success(self):
        out = Path(tempfile.mkdtemp()) / "backups"
        opener = lambda *_args, **_kwargs: Response(b"Card,Have\nEevee,1\n")
        with contextlib.redirect_stdout(io.StringIO()):
            result = backup_sheets.backup(
                [{"id": "eevee", "sheet": "https://example.test/sheet"}],
                out, opener)
        self.assertEqual(result, 0)
        self.assertTrue((out / "eevee.csv").exists())

    def test_main_handles_registry_without_sheets(self):
        with mock.patch.object(backup_sheets, "parse_sets", return_value=[]), \
                contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(backup_sheets.main(), 0)


class CheckLogosTest(unittest.TestCase):
    def test_candidates_cover_all_sources_and_invalid_series(self):
        entry = {"logo": "https://custom/logo.png", "tcgSet": "sv1",
                 "tcgdexSet": "ME2.5"}
        candidates = check_logos.candidates(entry)
        self.assertEqual(candidates[0], entry["logo"])
        self.assertIn("pokemontcg.io/sv1", candidates[1])
        self.assertIn("/me/ME2.5/", candidates[2])
        self.assertEqual(check_logos.candidates({"tcgdexSet": "123"}), [])

    def test_reachable_checks_size_and_handles_errors(self):
        self.assertTrue(check_logos.reachable(
            "https://example.test/logo", lambda *_args, **_kwargs: Response(b"x" * 100)))
        self.assertFalse(check_logos.reachable(
            "https://example.test/tiny", lambda *_args, **_kwargs: Response(b"x" * 99)))
        self.assertFalse(check_logos.reachable(
            "https://example.test/error", lambda *_args, **_kwargs: (_ for _ in ()).throw(OSError())))

    def test_check_success_fallback_broken_and_skipped(self):
        entries = [
            {"id": "skip"},
            {"id": "fallback", "logo": "bad", "tcgSet": "good"},
            {"id": "broken", "logo": "bad"},
        ]
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            result = check_logos.check(entries, lambda url: "good" in url)
        self.assertEqual(result, 1)
        self.assertIn("ok (https://images.pokemontcg.io/good/logo.png)", output.getvalue())
        self.assertIn("Broken: broken", output.getvalue())

        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(check_logos.check(entries[:2], lambda _url: True), 0)

    def test_main_empty_registry(self):
        with mock.patch.object(check_logos, "parse_sets", return_value=[]), \
                contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(check_logos.main(), 0)


class DownloadAssetsTest(unittest.TestCase):
    def test_candidates_and_fetch(self):
        entry = {"logo": "https://custom/logo.png", "tcgSet": "sv2",
                 "tcgdexSet": "xy1"}
        self.assertEqual(len(download_assets.candidates(entry)), 3)
        self.assertEqual(download_assets.candidates({"tcgdexSet": "7"}), [])
        data = download_assets.fetch(
            "https://example.test/logo", lambda *_args, **_kwargs: Response(b"logo"))
        self.assertEqual(data, b"logo")

    def test_empty_registry_fails(self):
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(download_assets.download([]), 1)

    def test_download_fallback_small_success_and_missing(self):
        out = Path(tempfile.mkdtemp()) / "logos"
        calls = []

        def fetcher(url):
            calls.append(url)
            if "custom" in url:
                raise OSError("offline")
            if "tiny" in url:
                return b"x" * 99
            return b"x" * 2048

        entries = [
            {"id": "saved", "logo": "https://custom/logo", "tcgSet": "sv1"},
            {"id": "tiny", "logo": "https://tiny/logo"},
            {"id": "none"},
        ]
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            result = download_assets.download(entries, out, fetcher)
        self.assertEqual(result, 0)
        self.assertEqual((out / "saved.png").stat().st_size, 2048)
        self.assertFalse((out / "tiny.png").exists())
        self.assertIn("Missing: tiny, none", output.getvalue())
        self.assertEqual(len(calls), 3)

    def test_main_empty_registry(self):
        with mock.patch.object(download_assets, "parse_sets", return_value=[]), \
                contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(download_assets.main(), 1)


if __name__ == "__main__":
    unittest.main()
