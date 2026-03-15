import os
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from whoop_client import WhoopClient


class TestWhoopClientSurface(unittest.IsolatedAsyncioTestCase):
    @patch("whoop_client.TokenManager")
    async def test_get_body_measurements_uses_expected_endpoint(self, mock_token_manager):
        mock_token_manager.return_value = MagicMock()
        client = WhoopClient()

        with patch.object(client, "_make_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = {"height_meter": 1.8}

            result = await client.get_body_measurements()

        self.assertEqual(result, {"height_meter": 1.8})
        mock_request.assert_awaited_once_with("/user/measurement/body")

    @patch("whoop_client.TokenManager")
    async def test_get_sleep_passes_collection_params(self, mock_token_manager):
        mock_token_manager.return_value = MagicMock()
        client = WhoopClient()

        with patch.object(client, "_make_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = {"records": []}

            await client.get_sleep(
                start_date="2026-03-01",
                end_date="2026-03-15",
                limit=10,
                next_token="abc123",
            )

        mock_request.assert_awaited_once_with(
            "/activity/sleep",
            {
                "limit": 10,
                "start": "2026-03-01",
                "end": "2026-03-15",
                "nextToken": "abc123",
            },
        )

    @patch("whoop_client.TokenManager")
    async def test_get_cycles_passes_collection_params(self, mock_token_manager):
        mock_token_manager.return_value = MagicMock()
        client = WhoopClient()

        with patch.object(client, "_make_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = {"records": []}

            await client.get_cycles(limit=3)

        mock_request.assert_awaited_once_with("/cycle", {"limit": 3})
