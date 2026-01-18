#!/usr/bin/env python3
"""Selenium MCP Server - FastMCP 2.0 implementation for browser automation."""

import logging
import sys
from pathlib import Path
from typing import Any

# Add the selenium_mcp directory to the path
sys.path.append(str(Path(__file__).parent))

from fastmcp import FastMCP
from pydantic import BaseModel

# Import our tools and context
from selenium_mcp.context import Context
from selenium_mcp.tools import get_all_tools

# Configure logging to file only (not stdout/stderr which interferes with MCP)
log_file = Path(__file__).parent / "mcp_server.log"
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file, encoding='utf-8'),
    ]
)
logger = logging.getLogger(__name__)

# Initialize FastMCP server
mcp = FastMCP("selenium-mcp")

# Get all tools
try:
    tools = get_all_tools()
    logger.info(f"Successfully loaded {len(tools)} tools")
except Exception as e:
    logger.error(f"Failed to load tools: {e}")
    import traceback
    logger.error(traceback.format_exc())
    tools = []

# Global context (lazy initialization)
context = None

def get_context() -> Context:
    """Get or create the global context."""
    global context
    if not context:
        context = Context(tools)
        logger.info("Created browser context")
    return context

# Register each tool with FastMCP using the tool's Pydantic input schema
for tool in tools:
    tool_name = tool.schema.name
    tool_description = tool.schema.description
    input_schema_class = tool.schema.input_schema

    # Create a wrapper function that uses the actual Pydantic model
    def make_tool_handler(tool_obj, schema_class):
        # Create the tool handler with the correct signature
        async def handler(params: schema_class) -> str:
            """Execute a browser automation tool."""
            logger.info(f"Executing tool: {tool_obj.schema.name}")

            try:
                ctx = get_context()

                # Convert Pydantic model to dict for our tool execution
                arguments = params.model_dump() if hasattr(params, 'model_dump') else params.dict()

                # Execute the tool
                result = await ctx.run_tool(tool_obj, arguments)

                # Return result as text
                return result.get("text", str(result))

            except Exception as e:
                logger.error(f"❌ Tool execution failed: {e}")
                import traceback
                logger.error(traceback.format_exc())
                return f"Error executing {tool_obj.schema.name}: {str(e)}"

        # Set proper function metadata
        handler.__name__ = tool_name
        handler.__doc__ = tool_description

        return handler

    # Create the handler for this tool
    tool_handler = make_tool_handler(tool, input_schema_class)

    # Register with FastMCP
    mcp.tool()(tool_handler)
    logger.debug(f"Registered tool: {tool_name}")

logger.info(f"Selenium MCP Server initialized with {len(tools)} tools")

def main():
    """Main entry point for the Selenium MCP server."""
    # Run the FastMCP server with stdio transport (like Playwright MCP)
    mcp.run(transport="stdio")

if __name__ == "__main__":
    main()
