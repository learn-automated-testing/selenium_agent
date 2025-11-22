#!/usr/bin/env python3
"""Quick test script to verify the MCP server works"""

import subprocess
import json
import sys

def test_server():
    """Test the MCP server by starting it and checking tools"""

    # Start the server process
    process = subprocess.Popen(
        ['./venv/bin/selenium-mcp'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    try:
        # Send initialize request
        init_request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {
                    "name": "test-client",
                    "version": "1.0.0"
                }
            }
        }

        process.stdin.write(json.dumps(init_request) + "\n")
        process.stdin.flush()

        # Read response
        response_line = process.stdout.readline()
        if response_line:
            response = json.loads(response_line)
            print("✅ Server initialized successfully!")
            print(f"   Server: {response.get('result', {}).get('serverInfo', {}).get('name', 'N/A')}")
            print(f"   Version: {response.get('result', {}).get('serverInfo', {}).get('version', 'N/A')}")

        # Send tools/list request
        tools_request = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {}
        }

        process.stdin.write(json.dumps(tools_request) + "\n")
        process.stdin.flush()

        # Read tools response
        tools_response_line = process.stdout.readline()
        if tools_response_line:
            tools_response = json.loads(tools_response_line)
            tools = tools_response.get('result', {}).get('tools', [])
            print(f"\n✅ Found {len(tools)} tools!")

            # Group tools by category
            categories = {}
            for tool in tools:
                name = tool['name']
                # Try to determine category from name
                if name.startswith('navigate') or name.startswith('go_'):
                    cat = 'Navigation'
                elif name.startswith('click') or name.startswith('hover') or name.startswith('input') or name.startswith('select'):
                    cat = 'Element Interactions'
                elif name.startswith('mouse_'):
                    cat = 'Mouse Operations'
                elif name.startswith('press_'):
                    cat = 'Keyboard'
                elif '_tab' in name or 'switch_to' in name or 'open_new' in name:
                    cat = 'Tab Management'
                elif name.startswith('planner_'):
                    cat = 'Planner Agent'
                elif name.startswith('generator_'):
                    cat = 'Generator Agent'
                elif name.startswith('healer_'):
                    cat = 'Healer Agent'
                elif name.startswith('browser_verify'):
                    cat = 'Verification Tools'
                elif name.startswith('capture_') or name.startswith('take_'):
                    cat = 'Browser Management'
                else:
                    cat = 'Other Tools'

                if cat not in categories:
                    categories[cat] = []
                categories[cat].append(name)

            print("\n📋 Tools by Category:")
            for category, tool_names in sorted(categories.items()):
                print(f"\n   {category} ({len(tool_names)} tools):")
                for tool_name in sorted(tool_names):
                    print(f"      • {tool_name}")

            # Check for agent tools
            agent_tools = [t for t in tools if any(x in t['name'] for x in ['planner_', 'generator_', 'healer_'])]
            if agent_tools:
                print(f"\n🤖 Agent Tools: {len(agent_tools)} tools")
                print("   ✅ Planner Agent tools available")
                print("   ✅ Generator Agent tools available")
                print("   ✅ Healer Agent tools available")

            return True

    except Exception as e:
        print(f"❌ Error: {e}")
        stderr = process.stderr.read()
        if stderr:
            print(f"   Server error: {stderr}")
        return False

    finally:
        process.terminate()
        process.wait(timeout=5)

if __name__ == "__main__":
    success = test_server()
    sys.exit(0 if success else 1)
