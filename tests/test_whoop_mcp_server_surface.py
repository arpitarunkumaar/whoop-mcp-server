import ast
from pathlib import Path
import unittest


class TestWhoopMcpServerSurface(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        server_path = Path(__file__).resolve().parent.parent / "src" / "whoop_mcp_server.py"
        cls.tree = ast.parse(server_path.read_text())

    def _tool_defs(self):
        tools = {}
        for node in self.tree.body:
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            for decorator in node.decorator_list:
                if (
                    isinstance(decorator, ast.Call)
                    and isinstance(decorator.func, ast.Attribute)
                    and isinstance(decorator.func.value, ast.Name)
                    and decorator.func.value.id == "mcp"
                    and decorator.func.attr == "tool"
                ):
                    tools[node.name] = [arg.arg for arg in node.args.args]
        return tools

    def test_expected_tools_are_exposed(self):
        tools = self._tool_defs()

        expected = {
            "get_whoop_auth_status",
            "get_whoop_profile",
            "get_whoop_body_measurements",
            "get_whoop_workouts",
            "get_whoop_recovery",
            "get_whoop_sleep",
            "get_whoop_cycles",
            "get_whoop_dashboard_snapshot",
            "get_whoop_full_history",
            "analyze_whoop_trends",
            "compare_whoop_periods",
            "get_whoop_correlations",
            "get_whoop_insights",
        }

        self.assertTrue(expected.issubset(set(tools)))

    def test_collection_tools_keep_filter_params(self):
        tools = self._tool_defs()

        self.assertEqual(
            tools["get_whoop_workouts"],
            ["limit", "start_date", "end_date", "next_token"],
        )
        self.assertEqual(
            tools["get_whoop_recovery"],
            ["limit", "start_date", "end_date", "next_token"],
        )
        self.assertEqual(
            tools["get_whoop_sleep"],
            ["limit", "start_date", "end_date", "next_token"],
        )
        self.assertEqual(
            tools["get_whoop_cycles"],
            ["limit", "start_date", "end_date", "next_token"],
        )

    def test_snapshot_tools_accept_refresh(self):
        tools = self._tool_defs()

        self.assertEqual(tools["get_whoop_dashboard_snapshot"], ["refresh"])
        self.assertEqual(tools["get_whoop_full_history"], ["refresh"])

    def test_analytics_tools_surface_expected_params(self):
        tools = self._tool_defs()

        self.assertEqual(tools["analyze_whoop_trends"], ["metric", "days"])
        self.assertEqual(
            tools["compare_whoop_periods"],
            ["start_date_1", "end_date_1", "start_date_2", "end_date_2"],
        )
        self.assertEqual(tools["get_whoop_correlations"], ["days"])
        self.assertEqual(tools["get_whoop_insights"], ["days"])
