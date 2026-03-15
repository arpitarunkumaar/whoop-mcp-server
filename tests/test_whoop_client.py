"""
Tests for WHOOP API client.
"""
import json
import os
import sys
import unittest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import httpx

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from config import CACHE_DURATION, WHOOP_API_BASE
from whoop_client import WhoopClient


class TestWhoopClient(unittest.TestCase):
    """Synchronous behavior tests for WhoopClient."""

    @patch("whoop_client.TokenManager")
    def test_client_initialization(self, mock_token_manager):
        mock_token_manager.return_value = MagicMock()
        client = WhoopClient()

        self.assertIsNotNone(client.token_manager)
        self.assertIsInstance(client.cache, dict)
        self.assertEqual(client.request_count, 0)
        self.assertIsNotNone(client.request_window_start)

    @patch("whoop_client.TokenManager")
    def test_get_headers_with_valid_token(self, mock_token_manager):
        mock_tm = MagicMock()
        mock_tm.get_valid_access_token.return_value = "test_access_token"
        mock_token_manager.return_value = mock_tm

        client = WhoopClient()
        headers = client._get_headers()

        self.assertEqual(
            headers,
            {
                "Authorization": "Bearer test_access_token",
                "Content-Type": "application/json",
            },
        )

    @patch("whoop_client.TokenManager")
    def test_get_headers_without_token_raises(self, mock_token_manager):
        mock_tm = MagicMock()
        mock_tm.get_valid_access_token.return_value = None
        mock_token_manager.return_value = mock_tm

        client = WhoopClient()
        with self.assertRaises(Exception) as context:
            client._get_headers()

        self.assertIn("No valid access token available", str(context.exception))

    @patch("whoop_client.TokenManager")
    def test_cache_key_generation(self, mock_token_manager):
        mock_token_manager.return_value = MagicMock()
        client = WhoopClient()

        key_without_params = client._get_cache_key("/user/profile/basic")
        self.assertEqual(key_without_params, "/user/profile/basic")

        params = {"limit": 5, "start": "2026-03-01"}
        expected = f"/activity/workout:{json.dumps(params, sort_keys=True)}"
        key_with_params = client._get_cache_key("/activity/workout", params)
        self.assertEqual(key_with_params, expected)

    @patch("whoop_client.TokenManager")
    def test_cache_save_hit_and_expiration(self, mock_token_manager):
        mock_token_manager.return_value = MagicMock()
        client = WhoopClient()
        cache_key = "test_key"
        test_data = {"test": "data"}

        self.assertIsNone(client._get_from_cache(cache_key))

        client._save_to_cache(cache_key, test_data)
        self.assertEqual(client._get_from_cache(cache_key), test_data)

        expired = (datetime.now() - timedelta(seconds=CACHE_DURATION + 1)).isoformat()
        client.cache[cache_key]["cached_at"] = expired
        self.assertIsNone(client._get_from_cache(cache_key))
        self.assertNotIn(cache_key, client.cache)

    @patch("whoop_client.TokenManager")
    def test_collection_param_builder(self, mock_token_manager):
        mock_token_manager.return_value = MagicMock()
        client = WhoopClient()

        params = client._build_collection_params(
            start_date="2026-03-01",
            end_date="2026-03-15",
            limit=10,
            next_token="abc123",
        )

        self.assertEqual(
            params,
            {
                "limit": 10,
                "start": "2026-03-01",
                "end": "2026-03-15",
                "nextToken": "abc123",
            },
        )

    @patch("whoop_client.TokenManager")
    def test_get_auth_status_passthrough(self, mock_token_manager):
        mock_tm = MagicMock()
        mock_tm.get_token_info.return_value = {"status": "valid"}
        mock_token_manager.return_value = mock_tm

        client = WhoopClient()
        self.assertEqual(client.get_auth_status(), {"status": "valid"})

    @patch("whoop_client.TokenManager")
    def test_clear_cache(self, mock_token_manager):
        mock_token_manager.return_value = MagicMock()
        client = WhoopClient()

        client.cache["k"] = {"data": 1, "cached_at": datetime.now().isoformat()}
        self.assertEqual(len(client.cache), 1)
        client.clear_cache()
        self.assertEqual(client.cache, {})


class TestWhoopClientAsync(unittest.IsolatedAsyncioTestCase):
    """Async behavior tests for request/endpoint methods."""

    @patch("whoop_client.TokenManager")
    async def test_make_request_success_and_cache(self, mock_token_manager):
        mock_tm = MagicMock()
        mock_tm.get_valid_access_token.return_value = "test_token"
        mock_token_manager.return_value = mock_tm
        client = WhoopClient()

        payload = {"records": [{"id": 1}]}
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = payload

        with patch("whoop_client.httpx.AsyncClient") as mock_client_cls:
            mock_cm = mock_client_cls.return_value
            mock_http_client = AsyncMock()
            mock_http_client.get = AsyncMock(return_value=mock_response)
            mock_cm.__aenter__ = AsyncMock(return_value=mock_http_client)
            mock_cm.__aexit__ = AsyncMock(return_value=None)

            result = await client._make_request("/test/endpoint", {"limit": 5})
            self.assertEqual(result, payload)

            cached = await client._make_request("/test/endpoint", {"limit": 5})
            self.assertEqual(cached, payload)

            mock_http_client.get.assert_awaited_once_with(
                f"{WHOOP_API_BASE}/test/endpoint",
                headers={
                    "Authorization": "Bearer test_token",
                    "Content-Type": "application/json",
                },
                params={"limit": 5},
            )

    @patch("whoop_client.TokenManager")
    async def test_make_request_401_raises(self, mock_token_manager):
        mock_tm = MagicMock()
        mock_tm.get_valid_access_token.return_value = "test_token"
        mock_token_manager.return_value = mock_tm
        client = WhoopClient()

        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = "Unauthorized"

        with patch("whoop_client.httpx.AsyncClient") as mock_client_cls:
            mock_cm = mock_client_cls.return_value
            mock_http_client = AsyncMock()
            mock_http_client.get = AsyncMock(return_value=mock_response)
            mock_cm.__aenter__ = AsyncMock(return_value=mock_http_client)
            mock_cm.__aexit__ = AsyncMock(return_value=None)

            with self.assertRaises(Exception) as context:
                await client._make_request("/test/endpoint")

        self.assertIn("WHOOP returned 401", str(context.exception))

    @patch("whoop_client.TokenManager")
    async def test_make_request_timeout_raises(self, mock_token_manager):
        mock_tm = MagicMock()
        mock_tm.get_valid_access_token.return_value = "test_token"
        mock_token_manager.return_value = mock_tm
        client = WhoopClient()

        with patch("whoop_client.httpx.AsyncClient") as mock_client_cls:
            mock_cm = mock_client_cls.return_value
            mock_http_client = AsyncMock()
            mock_http_client.get = AsyncMock(side_effect=httpx.TimeoutException("boom"))
            mock_cm.__aenter__ = AsyncMock(return_value=mock_http_client)
            mock_cm.__aexit__ = AsyncMock(return_value=None)

            with self.assertRaises(Exception) as context:
                await client._make_request("/test/endpoint")

        self.assertIn("Request timed out", str(context.exception))

    @patch("whoop_client.TokenManager")
    async def test_endpoint_methods_delegate(self, mock_token_manager):
        mock_token_manager.return_value = MagicMock()
        client = WhoopClient()

        with patch.object(client, "_make_request", new_callable=AsyncMock) as mock_request:
            mock_request.return_value = {"ok": True}

            await client.get_user_profile()
            await client.get_body_measurements()
            await client.get_workouts(
                start_date="2026-03-01",
                end_date="2026-03-02",
                limit=3,
                next_token="n1",
            )
            await client.get_recovery(limit=2)
            await client.get_sleep(limit=4)
            await client.get_cycles(limit=5)

        self.assertEqual(mock_request.await_count, 6)
        mock_request.assert_any_await("/user/profile/basic")
        mock_request.assert_any_await("/user/measurement/body")
        mock_request.assert_any_await(
            "/activity/workout",
            {
                "limit": 3,
                "start": "2026-03-01",
                "end": "2026-03-02",
                "nextToken": "n1",
            },
        )
        mock_request.assert_any_await("/recovery", {"limit": 2})
        mock_request.assert_any_await("/activity/sleep", {"limit": 4})
        mock_request.assert_any_await("/cycle", {"limit": 5})


if __name__ == "__main__":
    unittest.main()
