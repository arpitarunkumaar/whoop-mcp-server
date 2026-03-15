"""
Configuration for WHOOP MCP Server
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# Load environment variables from the repo root when present, then merge process env.
REPO_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(REPO_ROOT / ".env")
load_dotenv()

# WHOOP API configuration
WHOOP_API_BASE = "https://api.prod.whoop.com/developer/v2"
WHOOP_OAUTH_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth"
WHOOP_OAUTH_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token"
WHOOP_SCOPES = [
    "read:profile",
    "read:workout",
    "read:sleep",
    "read:recovery",
    "read:cycles",
    "read:body_measurement",
    "offline"
]

# Storage configuration
HOME_DIR = os.path.expanduser("~")
STORAGE_DIR = os.path.join(HOME_DIR, ".whoop-mcp-server")
TOKEN_STORAGE_PATH = os.path.join(STORAGE_DIR, "tokens.json")
CACHE_STORAGE_PATH = os.path.join(STORAGE_DIR, "cache.json")
CACHE_DURATION = 300  # 5 minutes

# Security configuration
ENCRYPTION_KEY_FILE = os.path.join(STORAGE_DIR, ".encryption_key")

# Rate limiting
MAX_REQUESTS_PER_MINUTE = 100
REQUEST_TIMEOUT = 30  # seconds

# Logging
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
LOG_FILE = os.getenv('LOG_FILE', None)  # None means console only
