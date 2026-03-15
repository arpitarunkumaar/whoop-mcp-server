# 🏃 WHOOP MCP Server

> Connect your WHOOP fitness data to Claude Desktop, Codex, and other MCP clients through MCP

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io/)
Transform your WHOOP fitness data into actionable insights through natural language queries in Claude Desktop, Codex, or any MCP-compatible client. Ask questions about your workouts, recovery, sleep patterns, and more while keeping your data secure and private.

## ✨ Features

🔐 **Secure OAuth Integration** - Safe WHOOP account connection with encrypted local storage  
🏃 **Complete Data Access** - Workouts, recovery, sleep, cycles, and profile information  
🤖 **Natural Language Queries** - Ask Claude or Codex about your fitness data in plain English
⚡ **Smart Caching** - Optimized performance with intelligent data caching  
🛡️ **Privacy First** - All data stays on your machine, never sent to third parties  
🔄 **Auto Token Refresh** - Seamless experience with automatic authentication renewal

## 🚀 Quick Start

## 📦 Installation

### 1. Prerequisites
- Python 3.8+
- Claude Desktop or Codex
- Active WHOOP account

### 2. Installation

```bash
git clone https://github.com/romanevstigneev/whoop-mcp-server.git
cd whoop-mcp-server
pip install -r requirements.txt
```

### 3. Setup

#### Option A: Interactive Setup (Recommended)

Run the interactive setup:
```bash
python setup.py
```

This will:
- Open your browser for WHOOP OAuth authorization
- Securely save your tokens locally
- Provide Claude Desktop and Codex configuration

#### Option B: Manual WHOOP OAuth Setup

If the interactive setup doesn't work, you can manually get your WHOOP tokens:

1. **Open WHOOP OAuth Page**: 
   👉 **[Click here to authorize WHOOP access](https://personal-integrations-462307.uc.r.appspot.com/)**

2. **Authorize Your Account**:
   - Log in with your WHOOP credentials
   - Grant permissions for the requested scopes:
     - `read:profile` - Access to your profile information
     - `read:workout` - Access to workout data
     - `read:recovery` - Access to recovery data
     - `read:sleep` - Access to sleep data
     - `offline` - Refresh token for continued access

3. **Copy Authorization Code**:
   - After authorization, you'll see a success page
   - **Copy the entire authorization code** (long string starting with letters/numbers)
   - It looks like: `ABC123...XYZ789` (much longer)

4. **Exchange Code for Tokens**:
   ```bash
   python -c "
   import sys
   sys.path.insert(0, './src')
   from auth_manager import TokenManager
   import requests
   
   # Paste your authorization code here
   auth_code = 'YOUR_AUTHORIZATION_CODE_HERE'
   
   # Exchange for tokens
   url = f'https://personal-integrations-462307.uc.r.appspot.com/api/get-tokens/{auth_code}'
   response = requests.get(url, timeout=30)
   
   if response.status_code == 200:
       token_data = response.json()
       if token_data.get('success'):
           # Save tokens
           token_manager = TokenManager()
           token_manager.save_tokens(token_data)
           print('✅ Tokens saved successfully!')
       else:
           print('❌ Token exchange failed')
   else:
       print(f'❌ HTTP Error: {response.status_code}')
   "
   ```

5. **Verify Setup**:
   ```bash
   python -c "
   import sys
   sys.path.insert(0, './src')
   from whoop_client import WhoopClient
   client = WhoopClient()
   print(f'✅ Auth status: {client.get_auth_status()}')
   "
   ```

### 4. Configure Your MCP Client

#### Claude Desktop

Add to your Claude Desktop settings:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\\Claude\\claude_desktop_config.json`
**Linux**: `~/.config/claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "whoop": {
      "command": "/opt/miniconda3/bin/python",
      "args": ["/path/to/whoop-mcp-server/src/whoop_mcp_server.py"],
      "env": {
        "PYTHONPATH": "/path/to/whoop-mcp-server/src"
      }
    }
  }
}
```

**⚠️ Important**: Use the full Python path (find yours with `which python3`)

#### Codex

Add this to `~/.codex/config.toml`:

```toml
[mcp_servers.whoop]
command = "/opt/miniconda3/bin/python"
args = ["/path/to/whoop-mcp-server/src/whoop_mcp_server.py"]

[mcp_servers.whoop.env]
PYTHONPATH = "/path/to/whoop-mcp-server/src"
```

Or add it with the Codex CLI:

```bash
codex mcp add whoop --env PYTHONPATH=/path/to/whoop-mcp-server/src -- /opt/miniconda3/bin/python /path/to/whoop-mcp-server/src/whoop_mcp_server.py
```

### 5. Restart Your MCP Client

After adding the configuration, restart Claude Desktop or restart Codex to load the WHOOP server.

## 💡 Usage Examples

Once configured, you can ask Claude or Codex:

- **"Show my WHOOP profile"**
- **"What were my workouts this week?"**
- **"How is my recovery trending?"**
- **"Show my sleep data for the last 7 days"**
- **"What's my HRV looking like?"**
- **"Compare my recovery to last month"**

## 🛠️ Available Tools

### `get_whoop_profile`
Get your WHOOP user profile information.

### `get_whoop_body_measurements`
Get your WHOOP body measurements.

### `get_whoop_workouts`
Get workout data with optional filters:
- `start_date` (YYYY-MM-DD)
- `end_date` (YYYY-MM-DD)
- `limit` (number of results)
- `next_token` (pagination cursor)

### `get_whoop_recovery`
Get recovery data with optional filters:
- `start_date` (YYYY-MM-DD)
- `end_date` (YYYY-MM-DD)
- `limit` (number of results)
- `next_token` (pagination cursor)

### `get_whoop_sleep`
Get sleep data with optional filters:
- `start_date` (YYYY-MM-DD)
- `end_date` (YYYY-MM-DD)
- `limit` (number of results)
- `next_token` (pagination cursor)

### `get_whoop_cycles`
Get physiological cycles (daily data) with optional filters:
- `start_date` (YYYY-MM-DD)
- `end_date` (YYYY-MM-DD)
- `limit` (number of results)
- `next_token` (pagination cursor)

### `get_whoop_auth_status`
Check authentication status and token information.

### `get_whoop_dashboard_snapshot`
Get the analyzed dashboard payload used by the local web dashboard.

Optional parameters:
- `refresh` (set true to bypass cache on this request)

### `get_whoop_full_history`
Get all dashboard WHOOP sources as raw records.

Optional parameters:
- `refresh` (set true to bypass cache on this request)

## 🔐 Security

- **Token Encryption**: All tokens are encrypted at rest using AES encryption
- **Local Storage**: Tokens are stored locally on your machine, never sent to third parties
- **Secure Permissions**: Token files have restricted permissions (600)
- **Auto-Refresh**: Tokens are automatically refreshed when expired

## 📊 Data Caching

- **Smart Caching**: API responses are cached for 5 minutes to improve performance
- **Rate Limiting**: Built-in rate limiting to respect WHOOP API limits
- **Cache Control**: Snapshot tools support a `refresh` flag to bypass cache

## 🔧 Configuration

Environment variables (optional):
- `LOG_LEVEL`: Logging level (DEBUG, INFO, WARNING, ERROR)
- `LOG_FILE`: Log file path (default: console only)

## 📁 File Structure

```
whoop-mcp-server/
├── src/                       # Python source files
│   ├── whoop_mcp_server.py    # Main MCP server
│   ├── whoop_client.py        # WHOOP API client
│   ├── auth_manager.py        # Token management
│   ├── dashboard_analysis.py  # Dashboard analytics aggregation
│   ├── whoop_dashboard_server.py # Local dashboard server
│   └── config.py              # Configuration
├── scripts/
│   └── export_whoop_data.py   # Incremental WHOOP data export utility
├── storage/                   # Local storage
│   ├── tokens.json            # Encrypted tokens (auto-generated)
│   └── .encryption_key        # Encryption key (auto-generated)
├── setup.py                   # Interactive setup script
├── setup_direct.py            # Direct OAuth setup using your WHOOP app credentials
└── requirements.txt           # Python dependencies
```

## 🧰 Local Utilities

For local analysis workflows, this repo also includes:

- `python src/whoop_dashboard_server.py` to run a local dashboard UI.
- `python scripts/export_whoop_data.py` to export WHOOP datasets incrementally.

Export files are written under `storage/exports/`, which stays git-ignored.

## 🐛 Troubleshooting

### "No valid access token available"
- Run `python setup.py` to re-authorize
- Check that your WHOOP account is active

### "Authentication failed"
- Your tokens may have expired beyond refresh
- Run `python setup.py` to get new tokens

### "Rate limit exceeded"
- Wait a minute before making more requests
- Consider using cached data or reducing request frequency

### Claude Desktop or Codex doesn't see the server
- **Use full Python path**: Change `"command": "python"` to `"command": "/opt/miniconda3/bin/python"` (use `which python3` to find yours)
- **Check correct config file**: Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (not `.claude.json`)
- **Check Codex config**: Edit `~/.codex/config.toml` or run `codex mcp list`
- **Use absolute paths**: Full paths like `/Users/username/whoop-mcp-server/src/whoop_mcp_server.py`
- **Check logs**: `tail -f ~/Library/Logs/Claude/mcp-server-whoop.log`
- Restart Claude Desktop or Codex after configuration changes

## 🔄 Token Refresh

The server automatically refreshes expired tokens using the refresh token. If this fails, you'll need to re-authorize:

```bash
python setup.py
```

## 📝 Logging

Logs are written to console by default. To log to a file:

```bash
export LOG_FILE="/path/to/whoop-mcp.log"
export LOG_LEVEL="INFO"
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This is an unofficial integration with WHOOP. It uses the official WHOOP API but is not endorsed by WHOOP.

## 📞 Support

- Check the troubleshooting section above
- Open an issue on GitHub
- Review WHOOP API documentation at https://developer.whoop.com/

## 🎯 Roadmap

- [ ] Historical data analysis
- [ ] Custom date range queries
- [ ] Data export functionality
- [ ] Webhook support for real-time updates
- [ ] Advanced analytics and insights
