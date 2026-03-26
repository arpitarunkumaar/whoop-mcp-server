"""
Tests for the shared validation module.
"""
import os
import sys
import unittest
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from validation import (
    parse_filter_datetime,
    validate_collection_filters,
    validate_collection_inputs,
    MAX_COLLECTION_LIMIT,
    MAX_NEXT_TOKEN_LENGTH,
)


class TestParseFilterDatetime(unittest.TestCase):
    """Tests for parse_filter_datetime."""

    def test_valid_date_string(self):
        result = parse_filter_datetime("2026-03-01", "start_date")
        self.assertEqual(result.year, 2026)
        self.assertEqual(result.month, 3)
        self.assertEqual(result.day, 1)
        self.assertEqual(result.tzinfo, timezone.utc)

    def test_valid_datetime_with_z_suffix(self):
        result = parse_filter_datetime("2026-03-01T12:30:00Z", "end_date")
        self.assertEqual(result.hour, 12)
        self.assertEqual(result.minute, 30)
        self.assertEqual(result.tzinfo, timezone.utc)

    def test_valid_datetime_with_offset(self):
        result = parse_filter_datetime("2026-03-01T12:00:00+05:30", "start_date")
        # Should be converted to UTC: 12:00 IST = 06:30 UTC
        self.assertEqual(result.tzinfo, timezone.utc)
        self.assertEqual(result.hour, 6)
        self.assertEqual(result.minute, 30)

    def test_naive_datetime_gets_utc(self):
        result = parse_filter_datetime("2026-03-01T10:00:00", "start_date")
        self.assertEqual(result.tzinfo, timezone.utc)
        self.assertEqual(result.hour, 10)

    def test_empty_string_raises(self):
        with self.assertRaises(ValueError) as ctx:
            parse_filter_datetime("", "start_date")
        self.assertIn("cannot be empty", str(ctx.exception))

    def test_whitespace_only_raises(self):
        with self.assertRaises(ValueError) as ctx:
            parse_filter_datetime("   ", "start_date")
        self.assertIn("cannot be empty", str(ctx.exception))

    def test_garbage_raises(self):
        with self.assertRaises(ValueError) as ctx:
            parse_filter_datetime("not-a-date", "end_date")
        self.assertIn("ISO-8601", str(ctx.exception))


class TestValidateCollectionFilters(unittest.TestCase):
    """Tests for validate_collection_filters (returns Optional[str])."""

    def test_limit_zero_returns_error(self):
        err = validate_collection_filters(limit=0, start_date=None, end_date=None, next_token=None)
        self.assertIsNotNone(err)
        self.assertIn("limit must be between 1", err)

    def test_limit_above_max_returns_error(self):
        err = validate_collection_filters(
            limit=MAX_COLLECTION_LIMIT + 1,
            start_date=None,
            end_date=None,
            next_token=None,
        )
        self.assertIsNotNone(err)
        self.assertIn("limit must be between 1", err)

    def test_reversed_dates_returns_error(self):
        err = validate_collection_filters(
            limit=5,
            start_date="2026-03-20",
            end_date="2026-03-01",
            next_token=None,
        )
        self.assertIsNotNone(err)
        self.assertIn("start_date must be earlier", err)

    def test_oversized_next_token_returns_error(self):
        big_token = "x" * (MAX_NEXT_TOKEN_LENGTH + 1)
        err = validate_collection_filters(
            limit=5, start_date=None, end_date=None, next_token=big_token
        )
        self.assertIsNotNone(err)
        self.assertIn("next_token is too long", err)

    def test_invalid_date_format_returns_error(self):
        err = validate_collection_filters(
            limit=5, start_date="garbage", end_date=None, next_token=None
        )
        self.assertIsNotNone(err)
        self.assertIn("ISO-8601", err)

    def test_all_valid_returns_none(self):
        err = validate_collection_filters(
            limit=10,
            start_date="2026-03-01",
            end_date="2026-03-15",
            next_token="abc123",
        )
        self.assertIsNone(err)

    def test_no_optional_args_returns_none(self):
        err = validate_collection_filters(
            limit=5, start_date=None, end_date=None, next_token=None
        )
        self.assertIsNone(err)


class TestValidateCollectionInputs(unittest.TestCase):
    """Tests for validate_collection_inputs (raises ValueError)."""

    def test_limit_zero_raises(self):
        with self.assertRaises(ValueError) as ctx:
            validate_collection_inputs(
                start_date=None, end_date=None, limit=0, next_token=None
            )
        self.assertIn("limit must be between 1", str(ctx.exception))

    def test_limit_above_max_raises(self):
        with self.assertRaises(ValueError):
            validate_collection_inputs(
                start_date=None,
                end_date=None,
                limit=MAX_COLLECTION_LIMIT + 1,
                next_token=None,
            )

    def test_reversed_dates_raises(self):
        with self.assertRaises(ValueError) as ctx:
            validate_collection_inputs(
                start_date="2026-03-20",
                end_date="2026-03-01",
                limit=5,
                next_token=None,
            )
        self.assertIn("start_date must be earlier", str(ctx.exception))

    def test_oversized_next_token_raises(self):
        big_token = "x" * (MAX_NEXT_TOKEN_LENGTH + 1)
        with self.assertRaises(ValueError) as ctx:
            validate_collection_inputs(
                start_date=None, end_date=None, limit=5, next_token=big_token
            )
        self.assertIn("next_token is too long", str(ctx.exception))

    def test_all_valid_does_not_raise(self):
        # Should not raise
        validate_collection_inputs(
            start_date="2026-03-01",
            end_date="2026-03-15",
            limit=10,
            next_token="abc",
        )


if __name__ == "__main__":
    unittest.main()
