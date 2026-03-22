import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import whoop_mcp_server


class TestWhoopMcpServerTransport(unittest.TestCase):
    def test_defaults_to_stdio_without_env(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(whoop_mcp_server.resolve_mcp_transport(), "stdio")

    def test_uses_explicit_whoop_transport(self):
        with patch.dict(
            os.environ,
            {"WHOOP_MCP_TRANSPORT": "streamable-http"},
            clear=True,
        ):
            self.assertEqual(whoop_mcp_server.resolve_mcp_transport(), "streamable-http")

    def test_uses_mcp_transport_alias(self):
        with patch.dict(os.environ, {"MCP_TRANSPORT": "streamable-http"}, clear=True):
            self.assertEqual(whoop_mcp_server.resolve_mcp_transport(), "streamable-http")

    def test_invalid_transport_falls_back_to_stdio(self):
        with patch.dict(os.environ, {"WHOOP_MCP_TRANSPORT": "invalid"}, clear=True):
            self.assertEqual(whoop_mcp_server.resolve_mcp_transport(), "stdio")
