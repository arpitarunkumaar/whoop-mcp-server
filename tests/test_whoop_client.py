"""
Tests for WHOOP API client.
"""
import json
import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import httpx

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from config import CACHE_DURATION, MAX_REQUESTS_PER_MINUTE, WHOOP_API_BASE
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
    def test_collection_param_builder_rejects_invalid_limit(self, mock_token_manager):
        mock_token_manager.return_value = MagicMock()
        client = WhoopClient()

        with self.assertRaises(ValueError) as context:
            client._build_collection_params(limit=0)

        self.assertIn("limit must be between 1 and 25", str(context.exception))

    @patch("whoop_client.TokenManager")
    def test_collection_param_builder_rejects_reversed_dates(self, mock_token_manager):
        mock_token_manager.return_value = MagicMock()
        client = WhoopClient()

        with self.assertRaises(ValueError) as context:
            client._build_collection_params(
                start_date="2026-03-20",
                end_date="2026-03-01",
                limit=10,
            )

        self.assertIn("start_date must be earlier than or equal to end_date", str(context.exception))

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
    async def test_make_request_cache_hit_skips_rate_limit(self, mock_token_manager):
        mock_tm = MagicMock()
        mock_tm.get_valid_access_token.return_value = "test_token"
        mock_token_manager.return_value = mock_tm
        client = WhoopClient()

        cache_key = client._get_cache_key("/test/endpoint", {"limit": 5})
        client._save_to_cache(cache_key, {"records": [{"id": 1}]})
        client.request_count = MAX_REQUESTS_PER_MINUTE
        client.request_window_start = datetime.now()

        with patch("whoop_client.httpx.AsyncClient") as mock_client_cls:
            payload = await client._make_request("/test/endpoint", {"limit": 5})

        self.assertEqual(payload, {"records": [{"id": 1}]})
        mock_client_cls.assert_not_called()

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


class TestRetryBehavior(unittest.IsolatedAsyncioTestCase):
    """Tests for retry / backoff logic in _make_request."""

    @patch("whoop_client.asyncio.sleep", new_callable=AsyncMock)
    @patch("whoop_client.TokenManager")
    async def test_429_then_200_retries_and_succeeds(self, mock_token_manager, mock_sleep):
        mock_tm = MagicMock()
        mock_tm.get_valid_access_token.return_value = "test_token"
        mock_token_manager.return_value = mock_tm
        client = WhoopClient()

        resp_429 = MagicMock()
        resp_429.status_code = 429
        resp_429.headers = {}

        resp_200 = MagicMock()
        resp_200.status_code = 200
        resp_200.json.return_value = {"ok": True}

        with patch("whoop_client.httpx.AsyncClient") as mock_client_cls:
            mock_cm = mock_client_cls.return_value
            mock_http = AsyncMock()
            mock_http.get = AsyncMock(side_effect=[resp_429, resp_200])
            mock_cm.__aenter__ = AsyncMock(return_value=mock_http)
            mock_cm.__aexit__ = AsyncMock(return_value=None)

            result = await client._make_request("/test")

        self.assertEqual(result, {"ok": True})
        self.assertEqual(mock_http.get.await_count, 2)
        mock_sleep.assert_awaited_once()

    @patch("whoop_client.asyncio.sleep", new_callable=AsyncMock)
    @patch("whoop_client.TokenManager")
    async def test_5xx_exhaustion_raises(self, mock_token_manager, mock_sleep):
        mock_tm = MagicMock()
        mock_tm.get_valid_access_token.return_value = "test_token"
        mock_token_manager.return_value = mock_tm
        client = WhoopClient()

        resp_503 = MagicMock()
        resp_503.status_code = 503
        resp_503.headers = {}
        resp_503.text = "Service Unavailable"

        with patch("whoop_client.httpx.AsyncClient") as mock_client_cls:
            mock_cm = mock_client_cls.return_value
            mock_http = AsyncMock()
            mock_http.get = AsyncMock(return_value=resp_503)
            mock_cm.__aenter__ = AsyncMock(return_value=mock_http)
            mock_cm.__aexit__ = AsyncMock(return_value=None)

            with self.assertRaises(Exception) as ctx:
                await client._make_request("/test")

        self.assertIn("503", str(ctx.exception))
        # Two retries + final attempt = 3 calls total
        self.assertEqual(mock_http.get.await_count, 3)


class TestRetryDelaySeconds(unittest.TestCase):
    """Unit tests for WhoopClient._retry_delay_seconds."""

    @patch("whoop_client.TokenManager")
    def test_retry_after_seconds_header(self, mock_token_manager):
        mock_token_manager.return_value = MagicMock()
        client = WhoopClient()

        response = MagicMock()
        response.headers = {"Retry-After": "2"}

        delay = client._retry_delay_seconds(1, response)
        # 2 + jitter(0..0.25)
        self.assertGreaterEqual(delay, 2.0)
        self.assertLessEqual(delay, 2.25)

    @patch("whoop_client.TokenManager")
    def test_retry_after_longer_than_cap_is_not_clipped(self, mock_token_manager):
        mock_token_manager.return_value = MagicMock()
        client = WhoopClient()

        response = MagicMock()
        response.headers = {"Retry-After": "30"}

        delay = client._retry_delay_seconds(1, response)
        self.assertGreaterEqual(delay, 30.0)

    @patch("whoop_client.TokenManager")
    def test_retry_after_http_date_header(self, mock_token_manager):
        mock_token_manager.return_value = MagicMock()
        client = WhoopClient()

        # HTTP-date 10 seconds in the future
        future = datetime.now(tz=timezone(timedelta(0))) + timedelta(seconds=10)
        http_date = future.strftime("%a, %d %b %Y %H:%M:%S GMT")
        response = MagicMock()
        response.headers = {"Retry-After": http_date}

        delay = client._retry_delay_seconds(1, response)
        # Should be approximately 10 seconds (± clock jitter)
        self.assertGreater(delay, 5.0)

    @patch("whoop_client.TokenManager")
    def test_retry_after_malformed_uses_backoff(self, mock_token_manager):
        mock_token_manager.return_value = MagicMock()
        client = WhoopClient()

        response = MagicMock()
        response.headers = {"Retry-After": "not-a-number-or-date"}

        delay = client._retry_delay_seconds(2, response)
        # Fallback: BASE * 2^(attempt-1) = 1.0 * 2 = 2.0 + jitter
        self.assertGreaterEqual(delay, 2.0)
        self.assertLessEqual(delay, 2.25)

    @patch("whoop_client.TokenManager")
    def test_no_retry_after_header(self, mock_token_manager):
        mock_token_manager.return_value = MagicMock()
        client = WhoopClient()

        delay_attempt_1 = client._retry_delay_seconds(1)
        # BASE * 2^0 = 1.0 + jitter
        self.assertGreaterEqual(delay_attempt_1, 1.0)
        self.assertLessEqual(delay_attempt_1, 1.25)

        delay_attempt_2 = client._retry_delay_seconds(2)
        # BASE * 2^1 = 2.0 + jitter
        self.assertGreaterEqual(delay_attempt_2, 2.0)
        self.assertLessEqual(delay_attempt_2, 2.25)


if __name__ == "__main__":
    unittest.main()
