"""Verification tools for test assertions."""

import logging
from typing import List
from pydantic import BaseModel, Field
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from ..tool_base import BaseTool, ToolSchema, ToolResult
from ..context import Context

logger = logging.getLogger(__name__)

class VerifyElementVisibleParams(BaseModel):
    """Parameters for verifying element visibility."""
    element: str = Field(description="Human-readable element description")
    ref: str = Field(description="Element reference from page snapshot")

class BrowserVerifyElementVisibleTool(BaseTool):
    """Verify element is visible on page."""

    def _create_schema(self) -> ToolSchema:
        return ToolSchema(
            name="browser_verify_element_visible",
            description="Verify that an element is visible on the page",
            input_schema=VerifyElementVisibleParams,
            tool_type="readOnly"
        )

    async def handle(self, context: Context, params: VerifyElementVisibleParams) -> ToolResult:
        """Verify element visibility."""
        driver = context.current_tab_or_die()
        snapshot = context.snapshot_or_die()

        by, locator = snapshot.ref_locator(params.ref)

        async def verify_action():
            try:
                element = WebDriverWait(driver, 10).until(
                    EC.visibility_of_element_located((by, locator))
                )
                is_visible = element.is_displayed()

                if is_visible:
                    logger.info(f"✅ Element visible: {params.element}")
                    return {
                        "verified": True,
                        "message": f"Element '{params.element}' is visible",
                        "element": params.element
                    }
                else:
                    logger.warning(f"❌ Element not visible: {params.element}")
                    return {
                        "verified": False,
                        "message": f"Element '{params.element}' exists but is not visible",
                        "element": params.element
                    }
            except Exception as e:
                logger.error(f"❌ Verification failed: {e}")
                return {
                    "verified": False,
                    "message": f"Element '{params.element}' not found or not visible: {str(e)}",
                    "element": params.element
                }

        code = [
            f"# Verify element is visible: {params.element}",
            f"WebDriverWait(driver, 10).until(",
            f"    EC.visibility_of_element_located((By.{by}, '{locator}'))",
            f")"
        ]

        return ToolResult(
            code=code,
            action=verify_action,
            capture_snapshot=False,
            wait_for_network=False
        )

class VerifyTextVisibleParams(BaseModel):
    """Parameters for verifying text visibility."""
    text: str = Field(description="Text content to verify is visible on the page")

class BrowserVerifyTextVisibleTool(BaseTool):
    """Verify text is visible on page."""

    def _create_schema(self) -> ToolSchema:
        return ToolSchema(
            name="browser_verify_text_visible",
            description="Verify that specific text is visible on the page",
            input_schema=VerifyTextVisibleParams,
            tool_type="readOnly"
        )

    async def handle(self, context: Context, params: VerifyTextVisibleParams) -> ToolResult:
        """Verify text visibility."""
        driver = context.current_tab_or_die()

        async def verify_action():
            try:
                # Wait for text to be present
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.XPATH, f"//*[contains(text(), '{params.text}')]"))
                )

                # Check if visible
                elements = driver.find_elements(By.XPATH, f"//*[contains(text(), '{params.text}')]")
                visible_elements = [e for e in elements if e.is_displayed()]

                if visible_elements:
                    logger.info(f"✅ Text visible: '{params.text}'")
                    return {
                        "verified": True,
                        "message": f"Text '{params.text}' is visible",
                        "text": params.text,
                        "count": len(visible_elements)
                    }
                else:
                    logger.warning(f"❌ Text not visible: '{params.text}'")
                    return {
                        "verified": False,
                        "message": f"Text '{params.text}' exists but is not visible",
                        "text": params.text
                    }
            except Exception as e:
                logger.error(f"❌ Text verification failed: {e}")
                return {
                    "verified": False,
                    "message": f"Text '{params.text}' not found: {str(e)}",
                    "text": params.text
                }

        code = [
            f"# Verify text is visible: '{params.text}'",
            f"WebDriverWait(driver, 10).until(",
            f"    EC.visibility_of_element_located(",
            f"        (By.XPATH, \"//*[contains(text(), '{params.text}')]\")",
            f"    )",
            f")"
        ]

        return ToolResult(
            code=code,
            action=verify_action,
            capture_snapshot=False,
            wait_for_network=False
        )

class VerifyValueParams(BaseModel):
    """Parameters for verifying element value."""
    element: str = Field(description="Human-readable element description")
    ref: str = Field(description="Element reference from page snapshot")
    expected_value: str = Field(description="Expected value of the element")

class BrowserVerifyValueTool(BaseTool):
    """Verify element has expected value."""

    def _create_schema(self) -> ToolSchema:
        return ToolSchema(
            name="browser_verify_value",
            description="Verify that an input element has the expected value",
            input_schema=VerifyValueParams,
            tool_type="readOnly"
        )

    async def handle(self, context: Context, params: VerifyValueParams) -> ToolResult:
        """Verify element value."""
        driver = context.current_tab_or_die()
        snapshot = context.snapshot_or_die()

        by, locator = snapshot.ref_locator(params.ref)

        async def verify_action():
            try:
                element = driver.find_element(by, locator)
                actual_value = element.get_attribute('value') or element.text

                if actual_value == params.expected_value:
                    logger.info(f"✅ Value verified: {params.element} = '{params.expected_value}'")
                    return {
                        "verified": True,
                        "message": f"Element '{params.element}' has expected value",
                        "element": params.element,
                        "expected": params.expected_value,
                        "actual": actual_value
                    }
                else:
                    logger.warning(f"❌ Value mismatch: expected '{params.expected_value}', got '{actual_value}'")
                    return {
                        "verified": False,
                        "message": f"Value mismatch for '{params.element}'",
                        "element": params.element,
                        "expected": params.expected_value,
                        "actual": actual_value
                    }
            except Exception as e:
                logger.error(f"❌ Value verification failed: {e}")
                return {
                    "verified": False,
                    "message": f"Could not verify value for '{params.element}': {str(e)}",
                    "element": params.element
                }

        code = [
            f"# Verify element value: {params.element}",
            f"element = driver.find_element(By.{by}, '{locator}')",
            f"actual_value = element.get_attribute('value')",
            f"assert actual_value == '{params.expected_value}', f'Expected {params.expected_value}, got {{actual_value}}'"
        ]

        return ToolResult(
            code=code,
            action=verify_action,
            capture_snapshot=False,
            wait_for_network=False
        )

class VerifyListVisibleParams(BaseModel):
    """Parameters for verifying list items."""
    items: List[str] = Field(description="List of text items that should be visible")

class BrowserVerifyListVisibleTool(BaseTool):
    """Verify multiple items are visible."""

    def _create_schema(self) -> ToolSchema:
        return ToolSchema(
            name="browser_verify_list_visible",
            description="Verify that multiple text items are visible on the page",
            input_schema=VerifyListVisibleParams,
            tool_type="readOnly"
        )

    async def handle(self, context: Context, params: VerifyListVisibleParams) -> ToolResult:
        """Verify list items visibility."""
        driver = context.current_tab_or_die()

        async def verify_action():
            results = []
            all_verified = True

            for item in params.items:
                try:
                    elements = driver.find_elements(By.XPATH, f"//*[contains(text(), '{item}')]")
                    visible_elements = [e for e in elements if e.is_displayed()]

                    if visible_elements:
                        results.append({"item": item, "verified": True})
                        logger.info(f"✅ Item visible: '{item}'")
                    else:
                        results.append({"item": item, "verified": False})
                        all_verified = False
                        logger.warning(f"❌ Item not visible: '{item}'")
                except Exception as e:
                    results.append({"item": item, "verified": False, "error": str(e)})
                    all_verified = False
                    logger.error(f"❌ Error verifying '{item}': {e}")

            verified_count = sum(1 for r in results if r["verified"])

            return {
                "verified": all_verified,
                "message": f"Verified {verified_count}/{len(params.items)} items",
                "items": results,
                "total": len(params.items),
                "verified_count": verified_count
            }

        code = [
            f"# Verify list items are visible",
            f"items = {params.items}",
            "for item in items:",
            "    elements = driver.find_elements(By.XPATH, f\"//*[contains(text(), '{item}')]\")",
            "    assert any(e.is_displayed() for e in elements), f'Item not visible: {item}'"
        ]

        return ToolResult(
            code=code,
            action=verify_action,
            capture_snapshot=False,
            wait_for_network=False
        )
