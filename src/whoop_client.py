"""
WHOOP API Client for MCP Server
"""
import asyncio
import httpx
import json
import logging
import random
import threading
from email.utils import parsedate_to_datetime
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from config import (
    WHOOP_API_BASE,
    REQUEST_TIMEOUT,
    MAX_REQUESTS_PER_MINUTE,
    CACHE_DURATION
)
from auth_manager import TokenManager
from validation import validate_collection_inputs

logger = logging.getLogger(__name__)


MAX_RETRY_ATTEMPTS = 3
BASE_RETRY_DELAY_SECONDS = 1.0
MAX_RETRY_DELAY_SECONDS = 8.0


class WhoopClient:
    """WHOOP API client with caching and rate limiting"""
    
    def __init__(self):
        self.base_url = WHOOP_API_BASE
        self.token_manager = TokenManager()
        self.cache = {}
        self.request_count = 0
        self.request_window_start = datetime.now()
        self._state_lock = threading.Lock()
        
    def _get_headers(self) -> Dict[str, str]:
        """Get headers with valid access token"""
        access_token = self.token_manager.get_valid_access_token()
        if not access_token:
            raise Exception("No valid access token available")
        
        return {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
    
    def _check_rate_limit(self) -> None:
        """Check if we're within rate limits"""
        now = datetime.now()
        with self._state_lock:
            # Reset counter if window has passed
            if (now - self.request_window_start).total_seconds() >= 60:
                self.request_count = 0
                self.request_window_start = now

            if self.request_count >= MAX_REQUESTS_PER_MINUTE:
                wait_seconds = max(
                    1,
                    60 - int((now - self.request_window_start).total_seconds()),
                )
                raise Exception(
                    f"Rate limit exceeded. Please wait {wait_seconds}s before making more requests."
                )

            self.request_count += 1
    
    def _get_cache_key(self, endpoint: str, params: Dict[str, Any] = None) -> str:
        """Generate cache key for endpoint and parameters"""
        if params:
            param_str = json.dumps(params, sort_keys=True)
            return f"{endpoint}:{param_str}"
        return endpoint
    
    def _get_from_cache(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get data from cache if still valid"""
        with self._state_lock:
            if cache_key in self.cache:
                cached_data = self.cache[cache_key]
                cache_time = datetime.fromisoformat(cached_data['cached_at'])

                if (datetime.now() - cache_time).total_seconds() < CACHE_DURATION:
                    logger.debug(f"Cache hit for {cache_key}")
                    return cached_data['data']

                # Remove expired cache entry
                del self.cache[cache_key]

            return None
    
    def _save_to_cache(self, cache_key: str, data: Dict[str, Any]) -> None:
        """Save data to cache"""
        with self._state_lock:
            self.cache[cache_key] = {
                'data': data,
                'cached_at': datetime.now().isoformat()
            }
        logger.debug(f"Cached data for {cache_key}")



    def _retry_delay_seconds(
        self, attempt: int, response: Optional[httpx.Response] = None
    ) -> float:
        """Compute bounded retry delay, honoring Retry-After when present."""
        retry_after = None
        used_retry_after = False
        if response is not None:
            retry_after = response.headers.get("Retry-After")

        if retry_after:
            try:
                seconds = float(retry_after)
                used_retry_after = True
            except ValueError:
                try:
                    parsed = parsedate_to_datetime(retry_after)
                    now = datetime.now(timezone.utc)
                    if parsed.tzinfo is None:
                        parsed = parsed.replace(tzinfo=timezone.utc)
                    seconds = max(0.0, (parsed - now).total_seconds())
                    used_retry_after = True
                except (TypeError, ValueError):
                    seconds = BASE_RETRY_DELAY_SECONDS * (2 ** (attempt - 1))
        else:
            seconds = BASE_RETRY_DELAY_SECONDS * (2 ** (attempt - 1))

        jitter = random.uniform(0, 0.25)
        if used_retry_after:
            return seconds + jitter
        return min(MAX_RETRY_DELAY_SECONDS, seconds + jitter)
    
    async def _make_request(self, endpoint: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """Make authenticated request to WHOOP API"""
        # Check cache first
        cache_key = self._get_cache_key(endpoint, params)
        cached_data = self._get_from_cache(cache_key)
        if cached_data:
            return cached_data
        
        # Make API request
        url = f"{self.base_url}/{endpoint.lstrip('/')}"

        for attempt in range(1, MAX_RETRY_ATTEMPTS + 1):
            try:
                self._check_rate_limit()
                headers = self._get_headers()
                async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                    response = await client.get(url, headers=headers, params=params or {})

                if response.status_code == 200:
                    data = response.json()
                    # Cache successful responses
                    self._save_to_cache(cache_key, data)
                    return data

                if response.status_code == 401:
                    raise Exception(
                        "WHOOP returned 401 for this request. The token may be expired, "
                        "missing scope, or unsupported for this endpoint."
                    )

                retryable = response.status_code == 429 or response.status_code >= 500
                if retryable and attempt < MAX_RETRY_ATTEMPTS:
                    delay = self._retry_delay_seconds(attempt, response)
                    logger.warning(
                        "Transient WHOOP error %s on %s; retrying in %.2fs (attempt %s/%s)",
                        response.status_code,
                        endpoint,
                        delay,
                        attempt,
                        MAX_RETRY_ATTEMPTS,
                    )
                    await asyncio.sleep(delay)
                    continue

                logger.debug(
                    "Non-retryable WHOOP error %s on %s: %s",
                    response.status_code,
                    endpoint,
                    response.text,
                )
                raise Exception(
                    f"API request failed with status {response.status_code}."
                )

            except httpx.TimeoutException as exc:
                if attempt < MAX_RETRY_ATTEMPTS:
                    delay = self._retry_delay_seconds(attempt)
                    logger.warning(
                        "Timeout on %s; retrying in %.2fs (attempt %s/%s)",
                        endpoint,
                        delay,
                        attempt,
                        MAX_RETRY_ATTEMPTS,
                    )
                    await asyncio.sleep(delay)
                    continue
                raise Exception("Request timed out. Please try again.") from exc
            except httpx.RequestError as exc:
                if attempt < MAX_RETRY_ATTEMPTS:
                    delay = self._retry_delay_seconds(attempt)
                    logger.warning(
                        "Network error on %s; retrying in %.2fs (attempt %s/%s)",
                        endpoint,
                        delay,
                        attempt,
                        MAX_RETRY_ATTEMPTS,
                    )
                    await asyncio.sleep(delay)
                    continue
                raise Exception(
                    "Network error while reaching WHOOP API. Please try again."
                ) from exc
            except Exception as e:
                logger.error(f"Request failed for {endpoint}: {e}")
                raise
    
    async def get_user_profile(self) -> Dict[str, Any]:
        """Get user profile information"""
        return await self._make_request("/user/profile/basic")

    def _build_collection_params(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 25,
        next_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Build WHOOP collection parameters for paginated endpoints."""
        validate_collection_inputs(start_date, end_date, limit, next_token)
        params: Dict[str, Any] = {"limit": limit}

        if start_date:
            params["start"] = start_date
        if end_date:
            params["end"] = end_date
        if next_token:
            params["nextToken"] = next_token

        return params

    async def get_body_measurements(self) -> Dict[str, Any]:
        """Get authenticated user's body measurements."""
        return await self._make_request("/user/measurement/body")
    
    async def get_workouts(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 25,
        next_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get user workouts"""
        params = self._build_collection_params(start_date, end_date, limit, next_token)
        return await self._make_request("/activity/workout", params)
    
    async def get_recovery(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 25,
        next_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get user recovery data"""
        params = self._build_collection_params(start_date, end_date, limit, next_token)
        return await self._make_request("/recovery", params)
    
    async def get_sleep(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 25,
        next_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get user sleep data"""
        params = self._build_collection_params(start_date, end_date, limit, next_token)
        return await self._make_request("/activity/sleep", params)
    
    async def get_cycles(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 25,
        next_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get user physiological cycles"""
        params = self._build_collection_params(start_date, end_date, limit, next_token)
        return await self._make_request("/cycle", params)
    
    def get_auth_status(self) -> Dict[str, Any]:
        """Get authentication status"""
        return self.token_manager.get_token_info()
    
    def clear_cache(self) -> None:
        """Clear all cached data"""
        with self._state_lock:
            self.cache.clear()
        logger.info("Cache cleared")
