from pathlib import Path
import unittest


class TestWhoopDashboardServerSurface(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        server_path = Path(__file__).resolve().parent.parent / "src" / "whoop_dashboard_server.py"
        cls.server_source = server_path.read_text()

    def test_legacy_dashboard_html_is_gone(self):
        self.assertNotIn("LEGACY_DASHBOARD_REMOVED_HTML", self.server_source)
        self.assertNotIn('http-equiv="refresh"', self.server_source)
        self.assertNotIn("http://127.0.0.1:3000", self.server_source)
        self.assertNotIn("text/html; charset=utf-8", self.server_source)

    def test_root_fallback_is_plain_text_410(self):
        self.assertIn("HTTPStatus.GONE", self.server_source)
        self.assertIn('text/plain; charset=utf-8', self.server_source)


if __name__ == "__main__":
    unittest.main()
