"""
Shared validation helpers for WHOOP collection parameters.

Both the MCP server layer (returns error strings) and the client layer
(raises ValueError) call into the same parsing/validation logic here,
eliminating duplication.
"""
from datetime import datetime, timezone
from typing import Optional


MAX_COLLECTION_LIMIT = 25
MAX_NEXT_TOKEN_LENGTH = 2048


def parse_filter_datetime(value: str, field_name: str) -> datetime:
    """Validate and normalize an ISO-8601 date/datetime filter value.

    Returns a timezone-aware UTC datetime.
    Raises ``ValueError`` for empty, unparseable, or otherwise invalid input.
    """
    candidate = value.strip()
    if not candidate:
        raise ValueError(f"{field_name} cannot be empty.")

    try:
        parsed = datetime.fromisoformat(candidate.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(
            f"{field_name} must be ISO-8601 date or datetime "
            f"(e.g., 2026-03-01 or 2026-03-01T00:00:00Z)."
        ) from exc

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def validate_collection_filters(
    limit: int,
    start_date: Optional[str],
    end_date: Optional[str],
    next_token: Optional[str],
) -> Optional[str]:
    """Validate common collection tool arguments and return a user-safe error.

    Returns ``None`` when all inputs are valid; otherwise a human-readable
    error string suitable for MCP tool responses.
    """
    if limit < 1 or limit > MAX_COLLECTION_LIMIT:
        return f"limit must be between 1 and {MAX_COLLECTION_LIMIT}."

    try:
        start_dt = (
            parse_filter_datetime(start_date, "start_date") if start_date else None
        )
        end_dt = parse_filter_datetime(end_date, "end_date") if end_date else None
    except ValueError as exc:
        return str(exc)

    if start_dt and end_dt and start_dt > end_dt:
        return "start_date must be earlier than or equal to end_date."

    if next_token and len(next_token) > MAX_NEXT_TOKEN_LENGTH:
        return (
            f"next_token is too long; max length is {MAX_NEXT_TOKEN_LENGTH} characters."
        )

    return None


def validate_collection_inputs(
    start_date: Optional[str],
    end_date: Optional[str],
    limit: int,
    next_token: Optional[str],
) -> None:
    """Validate collection query parameters before calling WHOOP.

    Raises ``ValueError`` on any invalid input — intended for the client layer
    where callers catch and handle the exception directly.
    """
    if limit < 1 or limit > MAX_COLLECTION_LIMIT:
        raise ValueError(f"limit must be between 1 and {MAX_COLLECTION_LIMIT}.")

    start_dt = (
        parse_filter_datetime(start_date, "start_date") if start_date else None
    )
    end_dt = parse_filter_datetime(end_date, "end_date") if end_date else None
    if start_dt and end_dt and start_dt > end_dt:
        raise ValueError("start_date must be earlier than or equal to end_date.")

    if next_token and len(next_token) > MAX_NEXT_TOKEN_LENGTH:
        raise ValueError(
            f"next_token is too long; max length is {MAX_NEXT_TOKEN_LENGTH} characters."
        )
