# MCP Client Setup Guide

This guide shows how to install and configure `mcp-selenium-server` with various MCP clients including Claude Desktop, Cursor, Cline (VSCode), and other compatible clients.

---

## Table of Contents

- [Installation Methods](#installation-methods)
- [Claude Desktop](#claude-desktop)
- [Cursor](#cursor)
- [Cline (VSCode Extension)](#cline-vscode-extension)
- [Other MCP Clients](#other-mcp-clients)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

---

## Installation Methods

Before configuring MCP clients, install the package:

### Python Installation (Recommended for Python users)
```bash
pip install mcp-selenium-server
```

### Node.js Installation (Recommended for JavaScript/TypeScript users)
```bash
npm install -g mcp-selenium-server
# OR locally in your project
npm install mcp-selenium-server
```

### Using npx (No installation needed)
```bash
npx mcp-selenium-server
```

---

## Claude Desktop

### Configuration File Location

**macOS**:
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows**:
```
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux**:
```
~/.config/Claude/claude_desktop_config.json
```

### Configuration (Python Installation)

If you installed via `pip install mcp-selenium-server`:

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "selenium-mcp"
    }
  }
}
```

### Configuration (npm Installation)

If you installed via npm globally:

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "npx",
      "args": ["mcp-selenium-server"]
    }
  }
}
```

If installed locally in a project:

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/node_modules/mcp-selenium-server/bin/selenium-mcp.js"]
    }
  }
}
```

### Using Python Path Directly

If `selenium-mcp` command is not in PATH:

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "python",
      "args": ["-m", "selenium_mcp.server"]
    }
  }
}
```

Or with full Python path:

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "/usr/local/bin/python3",
      "args": ["-m", "selenium_mcp.server"]
    }
  }
}
```

### Multiple Configurations Example

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "selenium-mcp"
    },
    "other-mcp-server": {
      "command": "other-server"
    }
  }
}
```

### Steps to Configure

1. **Quit Claude Desktop** completely
2. **Open the config file**:
   - macOS: `open ~/Library/Application\ Support/Claude/`
   - Windows: Navigate to `%APPDATA%\Claude\`
3. **Edit `claude_desktop_config.json`** (create if doesn't exist)
4. **Add the configuration** (see examples above)
5. **Save the file**
6. **Restart Claude Desktop**
7. **Verify**: Look for the 🔌 icon in Claude Desktop

---

## Cursor

Cursor supports MCP servers through its settings.

### Configuration Location

**Settings → MCP Servers**

Or edit the config file directly:

**macOS**:
```
~/Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json
```

**Windows**:
```
%APPDATA%\Cursor\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json
```

**Linux**:
```
~/.config/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json
```

### Configuration (Python Installation)

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "selenium-mcp"
    }
  }
}
```

### Configuration (npm Installation)

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "npx",
      "args": ["mcp-selenium-server"]
    }
  }
}
```

### Using UI in Cursor

1. Open **Cursor**
2. Go to **Settings** (Cmd/Ctrl + ,)
3. Search for **"MCP"** or **"MCP Servers"**
4. Click **"Edit MCP Settings"**
5. Add the configuration
6. Click **"Save"**
7. Restart Cursor

### Alternative: Command Palette

1. Open Command Palette (Cmd/Ctrl + Shift + P)
2. Type: **"MCP: Edit Server Configuration"**
3. Add your configuration
4. Save and restart

---

## Cline (VSCode Extension)

Cline is a VSCode extension that supports MCP servers.

### Installation

1. Install **Cline** extension from VSCode Marketplace
2. Search for "Cline" or "Claude Dev"
3. Click Install

### Configuration Location

**Settings → Extensions → Cline → MCP Servers**

Or edit directly:

**macOS/Linux**:
```
~/.vscode/extensions/saoudrizwan.claude-dev-*/settings/cline_mcp_settings.json
```

**Windows**:
```
%USERPROFILE%\.vscode\extensions\saoudrizwan.claude-dev-*\settings\cline_mcp_settings.json
```

### Configuration (Python Installation)

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "selenium-mcp"
    }
  }
}
```

### Configuration (npm Installation)

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "npx",
      "args": ["mcp-selenium-server"]
    }
  }
}
```

### Using VSCode Settings UI

1. Open **VSCode**
2. Go to **Settings** (Cmd/Ctrl + ,)
3. Search for **"Cline MCP"**
4. Click **"Edit in settings.json"**
5. Add MCP server configuration
6. Save
7. Reload Cline extension

---

## Other MCP Clients

### Generic MCP Client Configuration

Most MCP clients follow a similar pattern:

```json
{
  "mcpServers": {
    "server-name": {
      "command": "command-to-run",
      "args": ["optional", "arguments"]
    }
  }
}
```

### Continue.dev (VSCode)

Similar to Cline, edit the MCP settings:

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "selenium-mcp"
    }
  }
}
```

### Zed Editor

Check Zed's MCP documentation for config location:

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "selenium-mcp"
    }
  }
}
```

### Custom MCP Client

If building your own MCP client:

```javascript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'selenium-mcp',  // or 'npx', 'python', etc.
  args: []                  // or ['mcp-selenium-server'], ['-m', 'selenium_mcp.server']
});

const client = new Client({
  name: 'my-client',
  version: '1.0.0'
});

await client.connect(transport);
```

---

## Verification

### Check if MCP Server is Running

After configuration, verify the server is accessible:

1. **Open your MCP client** (Claude Desktop, Cursor, etc.)
2. **Look for indicators**:
   - Claude Desktop: 🔌 icon in the input area
   - Cursor: MCP servers listed in settings
   - Cline: MCP servers appear in extension panel

3. **Test with a command**:
   ```
   User: "List available MCP tools"

   Expected: Should see selenium-mcp tools like:
   - navigate_to
   - click_element
   - capture_page
   - planner_setup_page
   - generator_setup_page
   - healer_run_tests
   - ... (40+ tools)
   ```

### Test Agent Functionality

Verify agents are working with review gates:

```
User: "Create a test plan for login functionality at https://example.com"

Expected behavior:
1. Planner agent starts exploring
2. Creates test plan
3. Saves to test-plans/
4. STOPS and asks for your approval ✋
5. Waits for you to review and approve

If this happens, agents are working correctly!
```

### Check Command Availability

**Test Python installation**:
```bash
# Should show version info
selenium-mcp --help

# Should show installed package
pip show mcp-selenium-server
```

**Test npm installation**:
```bash
# Should start the server
npx mcp-selenium-server --help

# Should show installed package
npm list -g mcp-selenium-server
```

---

## Troubleshooting

### Issue: "Command not found: selenium-mcp"

**Cause**: Package not installed or not in PATH

**Solutions**:

1. **Install the package**:
   ```bash
   pip install mcp-selenium-server
   ```

2. **Find where it's installed**:
   ```bash
   which selenium-mcp
   # Or
   pip show mcp-selenium-server
   ```

3. **Use full path in config**:
   ```json
   {
     "mcpServers": {
       "selenium-mcp": {
         "command": "/Users/yourname/.local/bin/selenium-mcp"
       }
     }
   }
   ```

4. **Or use Python directly**:
   ```json
   {
     "mcpServers": {
       "selenium-mcp": {
         "command": "python",
         "args": ["-m", "selenium_mcp.server"]
       }
     }
   }
   ```

### Issue: "npx command fails"

**Cause**: npm package not installed or Node.js not found

**Solutions**:

1. **Install globally**:
   ```bash
   npm install -g mcp-selenium-server
   ```

2. **Use full npx path**:
   ```json
   {
     "mcpServers": {
       "selenium-mcp": {
         "command": "/usr/local/bin/npx",
         "args": ["mcp-selenium-server"]
       }
     }
   }
   ```

3. **Use local installation**:
   ```bash
   cd your-project
   npm install mcp-selenium-server
   ```

   Then use node directly:
   ```json
   {
     "mcpServers": {
       "selenium-mcp": {
         "command": "node",
         "args": ["./node_modules/mcp-selenium-server/bin/selenium-mcp.js"]
       }
     }
   }
   ```

### Issue: "Python not found" (npm installation)

**Cause**: npm post-install script couldn't find Python

**Solutions**:

1. **Install Python 3.10+** from https://www.python.org/

2. **Manually install Python package**:
   ```bash
   pip install mcp-selenium-server
   ```

3. **Then npm wrapper will work**:
   ```bash
   npm install mcp-selenium-server
   ```

### Issue: "MCP server not showing in client"

**Causes & Solutions**:

1. **Config file syntax error**:
   - Validate JSON at https://jsonlint.com/
   - Check for missing commas, brackets

2. **Wrong config file location**:
   - Double-check the path for your OS
   - Make sure file is named correctly

3. **MCP client needs restart**:
   - Completely quit the application
   - Restart it
   - Wait a few seconds for server to connect

4. **Permissions issue**:
   ```bash
   # Make script executable (macOS/Linux)
   chmod +x $(which selenium-mcp)
   ```

### Issue: "Agent files not found"

**Cause**: Package installed incorrectly or agents not included

**Verify**:
```bash
python -c "
from pathlib import Path
import selenium_mcp

pkg_dir = Path(selenium_mcp.__file__).parent
agents_dir = pkg_dir.parent / 'agents'

print(f'Package: {pkg_dir}')
print(f'Agents: {agents_dir}')
print(f'Exists: {agents_dir.exists()}')

if agents_dir.exists():
    print('Agent files:')
    for f in agents_dir.glob('*.md'):
        print(f'  - {f.name}')
"
```

**Solution**: Reinstall package:
```bash
pip uninstall mcp-selenium-server
pip install mcp-selenium-server
```

### Issue: "Review gates not working"

**Cause**: Old version or corrupted installation

**Solution**:
```bash
# Upgrade to latest version
pip install --upgrade mcp-selenium-server

# Verify review gates
python -c "
from pathlib import Path
import selenium_mcp

pkg_dir = Path(selenium_mcp.__file__).parent
planner = pkg_dir.parent / 'agents' / 'selenium-test-planner.agent.md'
content = planner.read_text()

if 'CRITICAL: Human Review Required' in content:
    print('✅ Review gates present!')
else:
    print('❌ Review gates missing - reinstall package')
"
```

---

## Environment Variables (Optional)

Some configurations may benefit from environment variables:

### Setting Python Path

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "python",
      "args": ["-m", "selenium_mcp.server"],
      "env": {
        "PYTHONPATH": "/path/to/your/project"
      }
    }
  }
}
```

### Setting Working Directory

```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "selenium-mcp",
      "cwd": "/path/to/your/project"
    }
  }
}
```

---

## Quick Reference

### Configuration Templates

**Copy and paste these, then customize:**

#### Python (Global Install)
```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "selenium-mcp"
    }
  }
}
```

#### npm (Global Install)
```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "npx",
      "args": ["mcp-selenium-server"]
    }
  }
}
```

#### Python (Direct)
```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "python3",
      "args": ["-m", "selenium_mcp.server"]
    }
  }
}
```

#### npm (Local Project)
```json
{
  "mcpServers": {
    "selenium-mcp": {
      "command": "node",
      "args": ["./node_modules/mcp-selenium-server/bin/selenium-mcp.js"]
    }
  }
}
```

---

## Platform-Specific Notes

### macOS

- Use Finder → Go → Go to Folder (Cmd+Shift+G) to access hidden folders
- Python often at: `/usr/local/bin/python3` or `/opt/homebrew/bin/python3`
- npm at: `/usr/local/bin/npx` or `/opt/homebrew/bin/npx`

### Windows

- Use `%APPDATA%` in File Explorer address bar
- Python at: `C:\Python3x\python.exe` or `%LOCALAPPDATA%\Programs\Python\Python3x\python.exe`
- npm at: `%APPDATA%\npm\npx.cmd`
- Use backslashes `\` in paths or forward slashes `/`

### Linux

- Config files usually in `~/.config/`
- Python at: `/usr/bin/python3` or `~/.local/bin/python3`
- npm at: `/usr/bin/npx` or `~/.local/bin/npx`

---

## Summary

### Setup Steps

1. **Install package**:
   - `pip install mcp-selenium-server` (Python)
   - `npm install -g mcp-selenium-server` (Node.js)

2. **Find config file**:
   - Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
   - Cursor: Settings → MCP Servers
   - Cline: Extension settings

3. **Add configuration**:
   ```json
   {
     "mcpServers": {
       "selenium-mcp": {
         "command": "selenium-mcp"
       }
     }
   }
   ```

4. **Restart client**

5. **Verify**: Test with "List MCP tools"

### What You Get

✅ **40+ browser automation tools**
✅ **3 AI agents** (Planner, Generator, Healer)
✅ **3 review gates** (automatic)
✅ **Framework standards** (automatic)
✅ **Professional test generation**

Everything works automatically once configured!

---

## Additional Resources

- [README.md](README.md) - Main documentation
- [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md) - Workflow with review gates
- [FRAMEWORK_STANDARDS.md](FRAMEWORK_STANDARDS.md) - Framework conventions
- [INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md) - Detailed installation guide
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - For package maintainers

For issues: https://github.com/learn-automated-testing/selenium-mcp-server/issues
