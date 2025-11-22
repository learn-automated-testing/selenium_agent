"""IMPROVED Script generation tool for creating test scripts from recorded actions."""

import json
import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from selenium_mcp.tool_base import BaseTool, ToolSchema
from selenium_mcp.context import Context, ToolResult

logger = logging.getLogger(__name__)

# Tools that should not generate test code (meta-tools)
META_TOOLS = {
    "capture_page", "generator_read_log", "generate_script",
    "start_recording", "stop_recording", "recording_status",
    "planner_setup_page", "planner_save_plan", "generator_setup_page"
}

class GenerateScriptParams(BaseModel):
    """Parameters for script generation."""
    format: str = Field(
        description="Script format: pytest, unittest, selenium_python, robot_framework, playwright, webdriverio, selenium_java, selenium_js"
    )
    test_name: Optional[str] = Field(
        default="test_recorded_scenario",
        description="Name for the test function/class"
    )
    filename: Optional[str] = Field(
        default=None,
        description="Optional filename to save the script to"
    )
    include_setup: bool = Field(
        default=True,
        description="Include browser setup and teardown code"
    )

class ImprovedGenerateScriptTool(BaseTool):
    """Generate test script from recorded browser actions - IMPROVED VERSION."""

    def _create_schema(self) -> ToolSchema:
        return ToolSchema(
            name="generate_script",
            description="Generate executable test script from recorded browser actions. Choose format: pytest, unittest, selenium_python, robot_framework, playwright, webdriverio, selenium_java, selenium_js",
            input_schema=GenerateScriptParams,
            tool_type="readOnly"
        )

    async def handle(self, context: Context, params: GenerateScriptParams) -> ToolResult:
        """Generate test script from recorded actions."""

        if not context.action_history:
            return ToolResult(
                code=["No actions recorded. Start recording first with start_recording tool."],
                capture_snapshot=False
            )

        # Filter out meta-tools that shouldn't appear in generated tests
        filtered_actions = [
            action for action in context.action_history
            if action.get("tool") not in META_TOOLS
        ]

        if not filtered_actions:
            return ToolResult(
                code=["No testable actions recorded. Only meta-tools were used."],
                capture_snapshot=False
            )

        format_handlers = {
            "pytest": self._generate_pytest,
            "unittest": self._generate_unittest,
            "selenium_python": self._generate_selenium_python,
            "robot_framework": self._generate_robot_framework,
        }

        handler = format_handlers.get(params.format.lower())
        if not handler:
            return ToolResult(
                code=[f"Unsupported format: {params.format}. Choose from: {', '.join(format_handlers.keys())}"],
                capture_snapshot=False
            )

        script = handler(filtered_actions, params, context)

        result_lines = [
            f"✅ Generated {params.format} test script from {len(filtered_actions)} recorded actions",
            f"   (Filtered out {len(context.action_history) - len(filtered_actions)} meta-tools)",
            "",
            "Generated code:",
            "",
            script
        ]

        # Save to file if requested
        if params.filename:
            try:
                from pathlib import Path
                filepath = Path(params.filename)
                filepath.parent.mkdir(parents=True, exist_ok=True)
                filepath.write_text(script)
                result_lines.insert(-1, f"✅ Script saved to: {params.filename}")
                logger.info(f"📝 Test script saved to: {params.filename}")
            except Exception as e:
                result_lines.insert(-1, f"❌ Error saving to {params.filename}: {e}")
                logger.error(f"Failed to save script: {e}")

        return ToolResult(
            code=result_lines,
            capture_snapshot=False
        )

    def _generate_pytest(self, actions: List[Dict[str, Any]], params: GenerateScriptParams, context: Context) -> str:
        """Generate pytest format test script."""
        lines = []

        if params.include_setup:
            lines.extend([
                "\"\"\"Auto-generated test from Selenium MCP recorded actions.\"\"\"",
                "",
                "import pytest",
                "from selenium import webdriver",
                "from selenium.webdriver.common.by import By",
                "from selenium.webdriver.support.ui import WebDriverWait",
                "from selenium.webdriver.support import expected_conditions as EC",
                "from selenium.webdriver.support.select import Select",
                "from selenium.webdriver.common.keys import Keys",
                "import time",
                "",
                "",
                "@pytest.fixture",
                "def driver():",
                "    \"\"\"Setup and teardown for Chrome WebDriver.\"\"\"",
                "    driver = webdriver.Chrome()",
                "    driver.maximize_window()",
                "    driver.implicitly_wait(10)",
                "    yield driver",
                "    driver.quit()",
                "",
                ""
            ])

        lines.extend([
            f"def {params.test_name}(driver):",
            "    \"\"\"Auto-generated test from recorded browser actions.\"\"\""
        ])

        # Generate code for each action
        has_content = False
        for action in actions:
            code_lines = self._action_to_selenium_code(action, indent="    ", context=context)
            if code_lines:
                if isinstance(code_lines, list):
                    lines.extend(code_lines)
                else:
                    lines.append(code_lines)
                has_content = True

        if not has_content:
            lines.append("    pass  # No actions generated")

        return "\n".join(lines)

    def _generate_unittest(self, actions: List[Dict[str, Any]], params: GenerateScriptParams, context: Context) -> str:
        """Generate unittest format test script."""
        lines = [
            "\"\"\"Auto-generated test from Selenium MCP recorded actions.\"\"\"",
            "",
            "import unittest",
            "from selenium import webdriver",
            "from selenium.webdriver.common.by import By",
            "from selenium.webdriver.support.ui import WebDriverWait",
            "from selenium.webdriver.support import expected_conditions as EC",
            "from selenium.webdriver.support.select import Select",
            "import time",
            "",
            ""
        ]

        class_name = "".join(word.capitalize() for word in params.test_name.split("_"))
        lines.extend([
            f"class {class_name}(unittest.TestCase):",
            "    \"\"\"Auto-generated test from recorded browser actions.\"\"\"",
            "",
            "    def setUp(self):",
            "        self.driver = webdriver.Chrome()",
            "        self.driver.maximize_window()",
            "        self.driver.implicitly_wait(10)",
            "",
            "    def tearDown(self):",
            "        self.driver.quit()",
            "",
            f"    def {params.test_name}(self):",
            "        driver = self.driver"
        ])

        has_content = False
        for action in actions:
            code_lines = self._action_to_selenium_code(action, indent="        ", context=context)
            if code_lines:
                if isinstance(code_lines, list):
                    lines.extend(code_lines)
                else:
                    lines.append(code_lines)
                has_content = True

        if not has_content:
            lines.append("        pass  # No actions generated")

        lines.extend([
            "",
            "",
            "if __name__ == '__main__':",
            "    unittest.main()"
        ])

        return "\n".join(lines)

    def _generate_selenium_python(self, actions: List[Dict[str, Any]], params: GenerateScriptParams, context: Context) -> str:
        """Generate raw Selenium Python script."""
        lines = [
            "\"\"\"Auto-generated test from Selenium MCP recorded actions.\"\"\"",
            "",
            "from selenium import webdriver",
            "from selenium.webdriver.common.by import By",
            "from selenium.webdriver.support.ui import WebDriverWait",
            "from selenium.webdriver.support import expected_conditions as EC",
            "from selenium.webdriver.support.select import Select",
            "import time",
            "",
            "# Initialize browser",
            "driver = webdriver.Chrome()",
            "driver.maximize_window()",
            "driver.implicitly_wait(10)",
            "",
            "try:"
        ]

        has_content = False
        for action in actions:
            code_lines = self._action_to_selenium_code(action, indent="    ", context=context)
            if code_lines:
                if isinstance(code_lines, list):
                    lines.extend(code_lines)
                else:
                    lines.append(code_lines)
                has_content = True

        if not has_content:
            lines.append("    pass  # No actions generated")

        lines.extend([
            "",
            "finally:",
            "    driver.quit()"
        ])

        return "\n".join(lines)

    def _generate_robot_framework(self, actions: List[Dict[str, Any]], params: GenerateScriptParams, context: Context) -> str:
        """Generate Robot Framework test script."""
        lines = [
            "*** Settings ***",
            "Documentation    Auto-generated test from Selenium MCP recorded actions",
            "Library          SeleniumLibrary",
            "Test Setup       Open Browser To Test Page",
            "Test Teardown    Close Browser",
            "",
            "*** Variables ***",
            "${BROWSER}        Chrome",
            "${TIMEOUT}       10s",
            "",
            "*** Test Cases ***"
        ]

        test_name_display = params.test_name.replace("_", " ").title()
        lines.extend([
            f"{test_name_display}",
            "    [Documentation]    Auto-generated test scenario"
        ])

        for action in actions:
            code_line = self._action_to_robot_framework(action, context=context)
            if code_line:
                lines.append(f"    {code_line}")

        lines.extend([
            "",
            "*** Keywords ***",
            "Open Browser To Test Page",
            "    Open Browser    about:blank    ${BROWSER}",
            "    Maximize Browser Window",
            "    Set Selenium Timeout    ${TIMEOUT}"
        ])

        return "\n".join(lines)

    def _action_to_selenium_code(self, action: Dict[str, Any], indent: str = "", context: Context = None) -> Any:
        """Convert an action to Selenium Python code - IMPROVED VERSION."""
        tool = action.get("tool")
        params = action.get("params", {})

        logger.debug(f"Generating code for tool: {tool}, params: {params}")

        # Navigate
        if tool == "navigate_to":
            url = params.get("url")
            if url:
                return [
                    f"{indent}# Navigate to {url}",
                    f'{indent}driver.get("{url}")',
                    f"{indent}time.sleep(1)  # Wait for page load"
                ]

        # Click element
        elif tool == "click_element":
            ref = params.get("ref")
            element_desc = params.get("element", "element")

            # Try to get better locator from context snapshot
            locator_strategy = self._get_locator_for_ref(ref, context)

            if locator_strategy:
                by, locator_value = locator_strategy
                by_str = f"By.{by}" if hasattr(by, '__name__') else str(by)

                return [
                    f"{indent}# Click: {element_desc}",
                    f"{indent}element = WebDriverWait(driver, 10).until(",
                    f'{indent}    EC.element_to_be_clickable(({by_str}, "{locator_value}"))',
                    f"{indent})",
                    f"{indent}element.click()"
                ]
            else:
                # Fallback: try to extract text from element description
                search_text = element_desc.split()[0] if element_desc else "element"
                return [
                    f"{indent}# Click: {element_desc}",
                    f"{indent}element = WebDriverWait(driver, 10).until(",
                    f'{indent}    EC.element_to_be_clickable((By.XPATH, "//*[contains(text(), \'{search_text}\')]"))',
                    f"{indent})",
                    f"{indent}element.click()"
                ]

        # Input text
        elif tool == "input_text":
            ref = params.get("ref")
            text = params.get("text", "")
            element_desc = params.get("element", "input field")

            if text:
                locator_strategy = self._get_locator_for_ref(ref, context)

                if locator_strategy:
                    by, locator_value = locator_strategy
                    by_str = f"By.{by}" if hasattr(by, '__name__') else str(by)

                    return [
                        f"{indent}# Type into: {element_desc}",
                        f"{indent}input_field = WebDriverWait(driver, 10).until(",
                        f'{indent}    EC.presence_of_element_located(({by_str}, "{locator_value}"))',
                        f"{indent})",
                        f"{indent}input_field.clear()",
                        f'{indent}input_field.send_keys("{text}")'
                    ]
                else:
                    return [
                        f"{indent}# Type into: {element_desc}",
                        f"{indent}input_field = WebDriverWait(driver, 10).until(",
                        f'{indent}    EC.presence_of_element_located((By.XPATH, "//input"))',
                        f"{indent})",
                        f"{indent}input_field.clear()",
                        f'{indent}input_field.send_keys("{text}")'
                    ]

        # Verify text visible
        elif tool == "browser_verify_text_visible":
            text = params.get("text", "")
            if text:
                # Escape quotes in text
                escaped_text = text.replace('"', '\\"').replace("'", "\\'")
                return [
                    f"{indent}# Verify text is visible: '{text}'",
                    f"{indent}WebDriverWait(driver, 10).until(",
                    f'{indent}    EC.visibility_of_element_located((By.XPATH, "//*[contains(text(), \'{escaped_text}\')]"))',
                    f"{indent})"
                ]

        # Select option
        elif tool == "select_option":
            ref = params.get("ref")
            values = params.get("values", [])
            element_desc = params.get("element", "dropdown")

            if values:
                value = values[0] if isinstance(values, list) else values
                return [
                    f"{indent}# Select option: {value} from {element_desc}",
                    f"{indent}select_element = WebDriverWait(driver, 10).until(",
                    f'{indent}    EC.presence_of_element_located((By.TAG_NAME, "select"))',
                    f"{indent})",
                    f"{indent}select = Select(select_element)",
                    f'{indent}select.select_by_visible_text("{value}")'
                ]

        # Wait for condition
        elif tool == "wait_for":
            condition = params.get("condition")
            timeout = params.get("timeout", 10)

            if condition == "page_load":
                return [
                    f"{indent}# Wait for page to load",
                    f"{indent}WebDriverWait(driver, {timeout}).until(",
                    f'{indent}    lambda d: d.execute_script("return document.readyState") == "complete"',
                    f"{indent})"
                ]

        # Take screenshot
        elif tool == "take_screenshot":
            filename = params.get("filename", "screenshot.png")
            return [
                f"{indent}# Take screenshot",
                f'{indent}driver.save_screenshot("{filename}")'
            ]

        # Hover
        elif tool == "hover_element":
            element_desc = params.get("element", "element")
            return [
                f"{indent}# Hover over: {element_desc}",
                f"{indent}from selenium.webdriver.common.action_chains import ActionChains",
                f"{indent}element = WebDriverWait(driver, 10).until(",
                f'{indent}    EC.presence_of_element_located((By.XPATH, "//*[contains(text(), \'{element_desc.split()[0]}\')]"))',
                f"{indent})",
                f"{indent}ActionChains(driver).move_to_element(element).perform()"
            ]

        # Unknown tool - generate helpful TODO
        logger.warning(f"Unhandled tool in script generation: {tool}")
        return f'{indent}# TODO: Implement {tool} with params: {params}'

    def _action_to_robot_framework(self, action: Dict[str, Any], context: Context = None) -> str:
        """Convert an action to Robot Framework keyword."""
        tool = action.get("tool")
        params = action.get("params", {})

        if tool == "navigate_to":
            url = params.get("url")
            return f'Go To    {url}'

        elif tool == "click_element":
            element_desc = params.get("element", "element")
            search_text = element_desc.split()[0] if element_desc else "element"
            return f'Click Element    xpath=//*[contains(text(), "{search_text}")]'

        elif tool == "input_text":
            text = params.get("text", "")
            return f'Input Text    xpath=//input    {text}'

        elif tool == "browser_verify_text_visible":
            text = params.get("text", "")
            return f'Page Should Contain    {text}'

        elif tool == "take_screenshot":
            filename = params.get("filename", "screenshot.png")
            return f'Capture Page Screenshot    {filename}'

        return f'# TODO: {tool} - {params}'

    def _get_locator_for_ref(self, ref: str, context: Context) -> Optional[tuple]:
        """Get best locator strategy for an element reference from context snapshot."""
        if not context or not context.current_snapshot or not ref:
            return None

        try:
            return context.current_snapshot.ref_locator(ref)
        except Exception as e:
            logger.debug(f"Could not get locator for ref {ref}: {e}")
            return None
