"""Agent-specific tools for Selenium MCP server."""

import logging
import os
from pathlib import Path
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum

from ..tool_base import BaseTool, ToolSchema, ToolResult
from ..context import Context

logger = logging.getLogger(__name__)

# ============================================================================
# PLANNER AGENT TOOLS - ENHANCED
# ============================================================================

class ExplorationDepth(str, Enum):
    """Depth of exploration for test planning.

    LLM-Directed Modes (Path 1 - User controls exploration):
    - QUICK: Snapshot current page, LLM decides next steps
    - SINGLE_PAGE: Comprehensive single page analysis, LLM directs testing

    Hybrid Mode:
    - SECTION: Auto-explore within section (tabs, menus), LLM selects tests

    Autonomous Modes (Path 2 - Tool explores automatically):
    - FULL_SITE: Navigate all links, build complete site map
    - DEEP_WORKFLOWS: Full site + execute workflows (forms, multi-step flows)
    """
    QUICK = "quick"  # LLM-directed: Snapshot only, no auto-navigation
    SINGLE_PAGE = "single_page"  # LLM-directed: Deep single page discovery
    SECTION = "section"  # Hybrid: Auto-expand section, LLM chooses tests
    FULL_SITE = "full_site"  # Autonomous: Navigate all pages automatically
    DEEP_WORKFLOWS = "deep_workflows"  # Autonomous: Full site + workflow execution

class PlannerSetupParams(BaseModel):
    """Parameters for planner setup."""
    url: str = Field(description="URL of the web application to test")
    feature: str = Field(description="Name of the feature to create test plan for")
    exploration_depth: ExplorationDepth = Field(
        default=ExplorationDepth.QUICK,
        description="Depth of exploration: quick, single_page, section, full_site, or deep_workflows"
    )
    discovery_scope: Optional[str] = Field(
        default="full",
        description="Discovery scope: 'full' (explore entire site from homepage) or specific area like 'shopping', 'checkout', 'settings'. When set to specific area, discovery starts from that section and stays within it."
    )
    specific_sections: Optional[List[str]] = Field(
        default=None,
        description="DEPRECATED: Use discovery_scope instead. Kept for backward compatibility."
    )

class PlannerSetupTool(BaseTool):
    """Enhanced setup page for comprehensive test planning."""

    def _create_schema(self) -> ToolSchema:
        return ToolSchema(
            name="planner_setup_page",
            description="Initialize the testing environment and navigate to the application for test planning with configurable exploration depth",
            input_schema=PlannerSetupParams,
            tool_type="readOnly"
        )

    async def handle(self, context: Context, params: PlannerSetupParams) -> ToolResult:
        """Setup page for test planning with exploration."""
        async def setup_action():
            driver = await context.ensure_browser()
            driver.get(params.url)

            # Initialize planning session
            context.planning_session = {
                "feature": params.feature,
                "url": params.url,
                "base_url": params.url,
                "exploration_depth": params.exploration_depth.value,
                "discovery_scope": params.discovery_scope or "full",
                "specific_sections": params.specific_sections,  # Backward compat
                "discovered_pages": [],
                "discovered_elements": {},
                "navigation_links": [],
                "workflows": [],
                "scenarios": [],
                "visited_urls": set()
            }

            # Capture initial snapshot
            await context.capture_snapshot()

            # Discover navigation links from homepage
            nav_links = self._discover_navigation_links(driver, context)
            context.planning_session["navigation_links"] = nav_links

            # Store homepage data
            page_data = {
                "url": driver.current_url,
                "title": driver.title,
                "elements": self._extract_page_elements(context),
                "forms": self._discover_forms(driver),
                "interactive_elements": self._discover_interactive_elements(context)
            }
            context.planning_session["discovered_pages"].append(page_data)
            context.planning_session["visited_urls"].add(driver.current_url)

            logger.info(f"🎯 Planning session started for: {params.feature}")
            logger.info(f"📊 Exploration depth: {params.exploration_depth.value}")
            logger.info(f"🔗 Found {len(nav_links)} navigation links")

            # CHECK IF USER CHOICE IS NEEDED (autonomous mode without explicit scope)
            autonomous_mode = params.exploration_depth in [ExplorationDepth.FULL_SITE, ExplorationDepth.DEEP_WORKFLOWS]
            scope_specified = params.discovery_scope and params.discovery_scope != "full"

            if autonomous_mode and not scope_specified:
                # Extract unique section names from discovered links
                discovered_sections = []
                for link in nav_links:
                    section_name = link["text"].strip()
                    if section_name and section_name not in ["Home", "Login", "Get Started"] and len(section_name) < 30:
                        discovered_sections.append(section_name)

                # Remove duplicates and limit to reasonable number
                discovered_sections = list(dict.fromkeys(discovered_sections))[:6]

                if discovered_sections and len(discovered_sections) > 1:
                    # EARLY RETURN - Ask user to choose
                    logger.info(f"📋 Discovered sections: {', '.join(discovered_sections)}")
                    logger.info(f"⏸️  Awaiting user choice for discovery scope")

                    return {
                        "message": f"Site discovered - awaiting user choice",
                        "url": params.url,
                        "exploration_depth": params.exploration_depth.value,
                        "discovered_sections": discovered_sections,
                        "prompt_user": f"I discovered these sections: {', '.join(discovered_sections)}. Would you like:\n1. Full discovery (explore all sections)\n2. Focus on a specific section?\n\nPlease specify discovery_scope or call again with your choice.",
                        "awaiting_user_choice": True,
                        "ready_to_explore": False,
                        "navigation_links": nav_links
                    }

            # User chose a scope OR LLM-directed mode - proceed with exploration
            discovery_scope = params.discovery_scope or "full"
            context.planning_session["discovery_scope"] = discovery_scope

            if autonomous_mode:
                logger.info(f"🚀 Starting autonomous {params.exploration_depth.value} exploration...")
                logger.info(f"🎯 Discovery scope: {discovery_scope}")
                await self._autonomous_explore_site(driver, context, params)

            # Prepare response with discovered sections for user prompt
            response = {
                "message": f"Planning session initialized for '{params.feature}'",
                "url": params.url,
                "exploration_depth": params.exploration_depth.value,
                "discovery_scope": context.planning_session.get("discovery_scope", "full"),
                "navigation_links": nav_links,
                "page_elements": page_data,
                "pages_discovered": len(context.planning_session["discovered_pages"]),
                "workflows_discovered": len(context.planning_session["workflows"]),
                "ready": True
            }

            # Add discovered sections if available (for user prompt)
            if "discovered_sections" in context.planning_session:
                response["discovered_sections"] = context.planning_session["discovered_sections"]
                response["prompt_user"] = f"I discovered these sections: {', '.join(context.planning_session['discovered_sections'])}. Would you like full discovery of all sections, or focus on a specific section?"

            return response

        code = [
            f"# Initialize test planning for: {params.feature}",
            f"# Target URL: {params.url}",
            f"# Exploration depth: {params.exploration_depth.value}",
            f"# Specific sections: {params.specific_sections or 'All'}"
        ]

        return ToolResult(
            code=code,
            action=setup_action,
            capture_snapshot=True,
            wait_for_network=True
        )

    def _discover_navigation_links(self, driver, context) -> List[Dict[str, str]]:
        """Discover main navigation links."""
        links = []
        try:
            nav_selectors = ["nav a", "header a", "[role='navigation'] a", ".nav a", ".navbar a", ".menu a"]
            for selector in nav_selectors:
                try:
                    nav_elements = driver.find_elements("css selector", selector)
                    for elem in nav_elements:
                        try:
                            href = elem.get_attribute("href")
                            text = elem.text.strip()
                            if href and text:
                                links.append({
                                    "text": text,
                                    "href": href,
                                    "type": "navigation"
                                })
                        except:
                            continue
                except:
                    continue

            # Remove duplicates
            unique_links = []
            seen = set()
            for link in links:
                key = (link["text"], link["href"])
                if key not in seen:
                    seen.add(key)
                    unique_links.append(link)

            return unique_links
        except Exception as e:
            logger.warning(f"Error discovering navigation links: {e}")
            return []

    def _extract_page_elements(self, context) -> Dict[str, Any]:
        """Extract elements from current snapshot."""
        if not context.current_snapshot:
            return {}

        elements = {
            "buttons": [],
            "inputs": [],
            "links": [],
            "selects": [],
            "other": []
        }

        for ref, elem in context.current_snapshot.elements.items():
            elem_info = {
                "ref": ref,
                "tag": elem.tag_name,
                "text": elem.text,
                "aria_label": elem.aria_label
            }

            if elem.tag_name == "button":
                elements["buttons"].append(elem_info)
            elif elem.tag_name == "input":
                elements["inputs"].append(elem_info)
            elif elem.tag_name == "a":
                elements["links"].append(elem_info)
            elif elem.tag_name == "select":
                elements["selects"].append(elem_info)
            else:
                elements["other"].append(elem_info)

        return elements

    def _discover_forms(self, driver) -> List[Dict[str, Any]]:
        """Discover forms on the page."""
        forms = []
        try:
            form_elements = driver.find_elements("tag name", "form")
            for i, form in enumerate(form_elements):
                form_data = {
                    "index": i,
                    "action": form.get_attribute("action"),
                    "method": form.get_attribute("method"),
                    "inputs": []
                }

                inputs = form.find_elements("css selector", "input, textarea, select")
                for inp in inputs:
                    form_data["inputs"].append({
                        "type": inp.get_attribute("type"),
                        "name": inp.get_attribute("name"),
                        "id": inp.get_attribute("id"),
                        "placeholder": inp.get_attribute("placeholder")
                    })

                forms.append(form_data)
        except Exception as e:
            logger.warning(f"Error discovering forms: {e}")

        return forms

    def _discover_interactive_elements(self, context) -> Dict[str, int]:
        """Count interactive elements by type."""
        counts = {
            "buttons": 0,
            "inputs": 0,
            "links": 0,
            "selects": 0,
            "checkboxes": 0,
            "radio_buttons": 0
        }

        if context.current_snapshot:
            for elem in context.current_snapshot.elements.values():
                if elem.tag_name == "button":
                    counts["buttons"] += 1
                elif elem.tag_name == "input":
                    counts["inputs"] += 1
                    input_type = elem.attributes.get("type", "")
                    if input_type == "checkbox":
                        counts["checkboxes"] += 1
                    elif input_type == "radio":
                        counts["radio_buttons"] += 1
                elif elem.tag_name == "a":
                    counts["links"] += 1
                elif elem.tag_name == "select":
                    counts["selects"] += 1

        return counts

    async def _autonomous_explore_site(self, driver, context, params: PlannerSetupParams):
        """
        Autonomously explore the site by navigating discovered links.
        Only called for FULL_SITE and DEEP_WORKFLOWS exploration depths.

        Supports two discovery modes:
        1. Full Discovery (discovery_scope="full") - Explore entire site
        2. Scoped Discovery (discovery_scope="shopping") - Only explore that area
        """
        from urllib.parse import urlparse
        import time

        base_domain = urlparse(params.url).netloc
        nav_links = context.planning_session["navigation_links"]
        discovery_scope = params.discovery_scope or "full"

        # Filter links to stay on same domain
        same_domain_links = [
            link for link in nav_links
            if urlparse(link["href"]).netloc == base_domain or urlparse(link["href"]).netloc == ""
        ]

        # Apply discovery scope filter
        if discovery_scope != "full":
            logger.info(f"🎯 Scoped discovery: focusing on '{discovery_scope}' area")
            same_domain_links = [
                link for link in same_domain_links
                if discovery_scope.lower() in link["href"].lower() or
                   discovery_scope.lower() in link["text"].lower()
            ]
        else:
            logger.info(f"🌐 Full discovery: exploring entire site")

        # Backward compatibility: also check specific_sections
        if params.specific_sections:
            same_domain_links = [
                link for link in same_domain_links
                if any(section.lower() in link["href"].lower() or section.lower() in link["text"].lower()
                       for section in params.specific_sections)
            ]

        logger.info(f"📍 Exploring {len(same_domain_links)} navigation links...")

        for i, link in enumerate(same_domain_links, 1):
            try:
                # Skip if already visited
                if link["href"] in context.planning_session["visited_urls"]:
                    logger.info(f"⏭️  Skipping already visited: {link['text']}")
                    continue

                logger.info(f"🔍 [{i}/{len(same_domain_links)}] Exploring: {link['text']} ({link['href']})")

                # Navigate to the link
                driver.get(link["href"])
                time.sleep(1)  # Allow page to load

                # Capture snapshot
                await context.capture_snapshot()

                # Store page data
                page_data = {
                    "name": link["text"],
                    "url": driver.current_url,
                    "title": driver.title,
                    "elements": self._extract_page_elements(context),
                    "forms": self._discover_forms(driver),
                    "interactive_elements": self._discover_interactive_elements(context),
                    "navigation_source": link["text"]
                }

                context.planning_session["discovered_pages"].append(page_data)
                context.planning_session["visited_urls"].add(link["href"])

                # Discover subsections (expandable menus, buttons that reveal content)
                await self._discover_subsections(driver, context, link["text"])

                logger.info(f"✅ Captured: {link['text']} ({len(page_data['forms'])} forms, {len(page_data['elements']['buttons'])} buttons)")

            except Exception as e:
                logger.warning(f"⚠️  Error exploring {link['text']}: {e}")
                continue

        logger.info(f"🎉 Autonomous exploration complete! Discovered {len(context.planning_session['discovered_pages'])} pages")

        # If DEEP_WORKFLOWS, execute workflow discovery
        if params.exploration_depth == ExplorationDepth.DEEP_WORKFLOWS:
            logger.info(f"🔬 Starting deep workflow discovery...")
            await self._discover_and_execute_workflows(driver, context)

    async def _discover_subsections(self, driver, context, parent_section: str):
        """
        Discover subsections within a page by clicking expandable menus, tabs, etc.
        Used for SECTION and FULL_SITE exploration.
        """
        try:
            # Look for expandable buttons/menus
            expandable_selectors = [
                "button[aria-expanded='false']",
                "button[aria-haspopup='true']",
                ".accordion button",
                "[role='button']"
            ]

            expandables = []
            for selector in expandable_selectors:
                try:
                    elems = driver.find_elements("css selector", selector)
                    expandables.extend(elems[:5])  # Limit to first 5 per selector
                except:
                    continue

            # Click expandable elements to reveal content
            for elem in expandables[:10]:  # Limit total expandables
                try:
                    elem_text = elem.text.strip()[:50]
                    if not elem_text:
                        continue

                    logger.info(f"   🔽 Expanding: {elem_text}")
                    elem.click()
                    time.sleep(0.5)  # Allow animation

                    # Capture new elements revealed
                    await context.capture_snapshot()

                except Exception as e:
                    continue

        except Exception as e:
            logger.warning(f"Error discovering subsections: {e}")

    async def _discover_and_execute_workflows(self, driver, context):
        """
        Execute actual workflows by interacting with forms and following multi-step processes.
        Only called for DEEP_WORKFLOWS exploration depth.
        """
        logger.info("🚀 Executing workflow discovery...")

        # Go through each discovered page and look for workflows
        for page_data in context.planning_session["discovered_pages"]:
            if not page_data.get("forms"):
                continue

            try:
                # Navigate to page with forms
                driver.get(page_data["url"])
                time.sleep(1)

                # Try to interact with forms
                for form_idx, form_data in enumerate(page_data["forms"]):
                    workflow = await self._execute_form_workflow(driver, context, page_data, form_idx, form_data)
                    if workflow:
                        context.planning_session["workflows"].append(workflow)
                        logger.info(f"   ✅ Workflow discovered: {workflow['name']}")

            except Exception as e:
                logger.warning(f"Error executing workflows on {page_data.get('name', 'unknown')}: {e}")
                continue

        logger.info(f"🎉 Workflow discovery complete! Found {len(context.planning_session['workflows'])} workflows")

    async def _execute_form_workflow(self, driver, context, page_data, form_idx, form_data):
        """
        Execute a specific form workflow by filling and submitting.
        Returns workflow data if successful, None otherwise.
        """
        import time

        try:
            workflow = {
                "name": f"{page_data.get('name', 'Unknown')} - Form {form_idx + 1}",
                "starting_page": page_data["url"],
                "steps": [],
                "form_data": form_data
            }

            # Find the form
            forms = driver.find_elements("tag name", "form")
            if form_idx >= len(forms):
                return None

            form = forms[form_idx]

            # Step 1: Fill form fields with test data
            step_data = {"step": 1, "action": "fill_form", "fields_filled": []}

            inputs = form.find_elements("css selector", "input:not([type='submit']):not([type='button']), textarea, select")
            for inp in inputs[:10]:  # Limit to 10 fields
                try:
                    input_type = inp.get_attribute("type") or "text"
                    input_name = inp.get_attribute("name") or inp.get_attribute("id") or "unnamed"

                    # Fill with appropriate test data
                    test_value = self._get_test_data_for_input(input_type, input_name)

                    if input_type == "checkbox":
                        if not inp.is_selected():
                            inp.click()
                        step_data["fields_filled"].append({"name": input_name, "type": "checkbox", "value": "checked"})
                    elif input_type == "radio":
                        inp.click()
                        step_data["fields_filled"].append({"name": input_name, "type": "radio", "value": "selected"})
                    elif inp.tag_name == "select":
                        options = inp.find_elements("tag name", "option")
                        if len(options) > 1:
                            options[1].click()  # Select second option
                        step_data["fields_filled"].append({"name": input_name, "type": "select", "value": "option_1"})
                    else:
                        inp.clear()
                        inp.send_keys(test_value)
                        step_data["fields_filled"].append({"name": input_name, "type": input_type, "value": test_value})

                except Exception as e:
                    continue

            workflow["steps"].append(step_data)

            # Step 2: Capture state before submit
            before_url = driver.current_url

            # Step 3: Submit form
            try:
                submit_buttons = form.find_elements("css selector", "button[type='submit'], input[type='submit'], button:not([type='button'])")
                if submit_buttons:
                    submit_buttons[0].click()
                    time.sleep(2)  # Wait for navigation/response

                    workflow["steps"].append({
                        "step": 2,
                        "action": "submit_form",
                        "before_url": before_url,
                        "after_url": driver.current_url,
                        "navigated": driver.current_url != before_url
                    })

                    # Capture result page
                    await context.capture_snapshot()

                    workflow["steps"].append({
                        "step": 3,
                        "action": "verify_result",
                        "result_url": driver.current_url,
                        "result_title": driver.title
                    })

            except Exception as e:
                logger.warning(f"Error submitting form: {e}")
                return None

            return workflow

        except Exception as e:
            logger.warning(f"Error executing form workflow: {e}")
            return None

    def _get_test_data_for_input(self, input_type: str, input_name: str) -> str:
        """Generate appropriate test data based on input type and name."""
        input_name_lower = input_name.lower()

        # Email fields
        if "email" in input_name_lower or input_type == "email":
            return "test@example.com"

        # Name fields
        if "name" in input_name_lower or "user" in input_name_lower:
            return "Test User"

        # Phone fields
        if "phone" in input_name_lower or "tel" in input_name_lower or input_type == "tel":
            return "555-1234"

        # Number fields
        if input_type == "number" or "age" in input_name_lower or "quantity" in input_name_lower:
            return "25"

        # Date fields
        if input_type == "date":
            return "2025-01-01"

        # URL fields
        if input_type == "url":
            return "https://example.com"

        # Password fields
        if input_type == "password" or "password" in input_name_lower:
            return "TestPass123!"

        # Default text
        return f"Test {input_name}"

class PlannerSavePlanParams(BaseModel):
    """Parameters for saving test plan."""
    plan_content: str = Field(description="Complete test plan content in markdown format")
    filename: Optional[str] = Field(default=None, description="Optional filename for the test plan (defaults to feature name)")

class PlannerSavePlanTool(BaseTool):
    """Save test plan to file."""

    def _create_schema(self) -> ToolSchema:
        return ToolSchema(
            name="planner_save_plan",
            description="Save the completed test plan to a markdown file",
            input_schema=PlannerSavePlanParams,
            tool_type="destructive"
        )

    async def handle(self, context: Context, params: PlannerSavePlanParams) -> ToolResult:
        """Save test plan to file."""
        async def save_action():
            # Get filename from params or session
            if params.filename:
                filename = params.filename
            elif hasattr(context, 'planning_session') and context.planning_session:
                feature = context.planning_session.get('feature', 'test-plan')
                filename = f"{feature.lower().replace(' ', '-')}.plan.md"
            else:
                filename = "test-plan.md"

            # Create plans directory if it doesn't exist
            plans_dir = Path.cwd() / "test-plans"
            plans_dir.mkdir(exist_ok=True)

            # Save the plan
            plan_path = plans_dir / filename
            plan_path.write_text(params.plan_content)

            logger.info(f"📄 Test plan saved to: {plan_path}")

            return {
                "message": f"Test plan saved successfully",
                "file": str(plan_path),
                "size": len(params.plan_content)
            }

        code = [
            "# Save test plan to file",
            f"# Content length: {len(params.plan_content)} characters"
        ]

        return ToolResult(
            code=code,
            action=save_action,
            capture_snapshot=False,
            wait_for_network=False
        )

# ============================================================================
# ENHANCED EXPLORATION TOOLS
# ============================================================================

class PlannerExplorePageParams(BaseModel):
    """Parameters for exploring a specific page."""
    page_url: Optional[str] = Field(default=None, description="Full URL to explore. If None, explores current page.")
    page_name: str = Field(description="Name of the page/section being explored (e.g., 'Shopping', 'Checkout')")
    discover_workflows: bool = Field(
        default=False,
        description="Whether to discover multi-step workflows (e.g., forms that lead to other pages)"
    )
    max_workflow_depth: int = Field(
        default=3,
        description="Maximum depth to follow workflow steps (1-5)"
    )

class PlannerExplorePageTool(BaseTool):
    """Explore a specific page in detail and add to planning session."""

    def _create_schema(self) -> ToolSchema:
        return ToolSchema(
            name="planner_explore_page",
            description="Explore a specific page/section in detail, discovering elements, forms, and workflows",
            input_schema=PlannerExplorePageParams,
            tool_type="readOnly"
        )

    async def handle(self, context: Context, params: PlannerExplorePageParams) -> ToolResult:
        """Explore a specific page in detail."""
        async def explore_action():
            driver = context.current_tab_or_die()

            # Navigate to page if URL provided
            if params.page_url:
                driver.get(params.page_url)

            # Capture snapshot
            await context.capture_snapshot()

            # Extract comprehensive page data
            page_data = {
                "name": params.page_name,
                "url": driver.current_url,
                "title": driver.title,
                "elements": self._extract_detailed_elements(context),
                "forms": self._discover_forms_detailed(driver),
                "interactive_elements": self._discover_interactive_elements(context),
                "workflows": []
            }

            # Discover workflows if requested
            if params.discover_workflows:
                workflows = await self._discover_workflows(
                    driver,
                    context,
                    params.page_name,
                    params.max_workflow_depth
                )
                page_data["workflows"] = workflows

            # Add to planning session
            if not hasattr(context, 'planning_session') or context.planning_session is None:
                context.planning_session = {
                    "discovered_pages": [],
                    "workflows": []
                }

            context.planning_session["discovered_pages"].append(page_data)
            if params.discover_workflows:
                context.planning_session["workflows"].extend(page_data["workflows"])

            logger.info(f"🔍 Explored page: {params.page_name}")
            logger.info(f"📊 Found {len(page_data['forms'])} forms")
            logger.info(f"🎯 Found {len(page_data['workflows'])} workflows")

            return {
                "message": f"Page '{params.page_name}' explored successfully",
                "page_data": page_data,
                "forms_count": len(page_data["forms"]),
                "workflows_count": len(page_data["workflows"])
            }

        code = [
            f"# Explore page: {params.page_name}",
            f"# URL: {params.page_url or 'current page'}",
            f"# Discover workflows: {params.discover_workflows}",
            f"# Max workflow depth: {params.max_workflow_depth}"
        ]

        return ToolResult(
            code=code,
            action=explore_action,
            capture_snapshot=True,
            wait_for_network=True
        )

    def _extract_detailed_elements(self, context) -> Dict[str, List[Dict[str, Any]]]:
        """Extract detailed element information."""
        if not context.current_snapshot:
            return {}

        elements = {
            "buttons": [],
            "inputs": [],
            "links": [],
            "selects": [],
            "checkboxes": [],
            "radio_buttons": [],
            "textareas": [],
            "other": []
        }

        for ref, elem in context.current_snapshot.elements.items():
            elem_info = {
                "ref": ref,
                "tag": elem.tag_name,
                "text": elem.text,
                "aria_label": elem.aria_label,
                "id": elem.attributes.get("id"),
                "name": elem.attributes.get("name"),
                "type": elem.attributes.get("type"),
                "value": elem.attributes.get("value")
            }

            if elem.tag_name == "button":
                elements["buttons"].append(elem_info)
            elif elem.tag_name == "input":
                input_type = elem.attributes.get("type", "text")
                if input_type == "checkbox":
                    elements["checkboxes"].append(elem_info)
                elif input_type == "radio":
                    elements["radio_buttons"].append(elem_info)
                else:
                    elements["inputs"].append(elem_info)
            elif elem.tag_name == "textarea":
                elements["textareas"].append(elem_info)
            elif elem.tag_name == "a":
                elem_info["href"] = elem.attributes.get("href")
                elements["links"].append(elem_info)
            elif elem.tag_name == "select":
                elements["selects"].append(elem_info)
            else:
                elements["other"].append(elem_info)

        return elements

    def _discover_forms_detailed(self, driver) -> List[Dict[str, Any]]:
        """Discover forms with detailed information."""
        forms = []
        try:
            form_elements = driver.find_elements("tag name", "form")
            for i, form in enumerate(form_elements):
                form_data = {
                    "index": i,
                    "id": form.get_attribute("id"),
                    "name": form.get_attribute("name"),
                    "action": form.get_attribute("action"),
                    "method": form.get_attribute("method"),
                    "fields": []
                }

                # Get all form fields
                inputs = form.find_elements("css selector", "input, textarea, select, button")
                for inp in inputs:
                    field_data = {
                        "tag": inp.tag_name,
                        "type": inp.get_attribute("type"),
                        "name": inp.get_attribute("name"),
                        "id": inp.get_attribute("id"),
                        "placeholder": inp.get_attribute("placeholder"),
                        "required": inp.get_attribute("required") is not None,
                        "label": self._find_label_for_input(driver, inp)
                    }
                    form_data["fields"].append(field_data)

                forms.append(form_data)
        except Exception as e:
            logger.warning(f"Error discovering forms: {e}")

        return forms

    def _find_label_for_input(self, driver, input_elem) -> Optional[str]:
        """Find associated label for an input element."""
        try:
            input_id = input_elem.get_attribute("id")
            if input_id:
                try:
                    label = driver.find_element("css selector", f"label[for='{input_id}']")
                    return label.text.strip()
                except:
                    pass

            # Try to find parent label
            try:
                parent = input_elem.find_element("xpath", "..")
                if parent.tag_name == "label":
                    return parent.text.strip()
            except:
                pass

        except Exception as e:
            pass

        return None

    def _discover_interactive_elements(self, context) -> Dict[str, int]:
        """Count interactive elements by type."""
        counts = {
            "buttons": 0,
            "inputs": 0,
            "links": 0,
            "selects": 0,
            "checkboxes": 0,
            "radio_buttons": 0,
            "textareas": 0
        }

        if context.current_snapshot:
            for elem in context.current_snapshot.elements.values():
                if elem.tag_name == "button":
                    counts["buttons"] += 1
                elif elem.tag_name == "input":
                    counts["inputs"] += 1
                    input_type = elem.attributes.get("type", "")
                    if input_type == "checkbox":
                        counts["checkboxes"] += 1
                    elif input_type == "radio":
                        counts["radio_buttons"] += 1
                elif elem.tag_name == "textarea":
                    counts["textareas"] += 1
                elif elem.tag_name == "a":
                    counts["links"] += 1
                elif elem.tag_name == "select":
                    counts["selects"] += 1

        return counts

    async def _discover_workflows(
        self,
        driver,
        context,
        page_name: str,
        max_depth: int
    ) -> List[Dict[str, Any]]:
        """
        Discover multi-step workflows on the page.

        If max_depth == 0: Just discover and document workflows (no execution)
        If max_depth > 0: Actually execute workflows up to max_depth steps
        """
        workflows = []

        try:
            # Look for forms that might be part of a workflow
            forms = driver.find_elements("tag name", "form")

            for i, form in enumerate(forms):
                form_id = form.get_attribute("id") or f"form_{i}"
                form_action = form.get_attribute("action")

                # If max_depth > 0, EXECUTE the workflow
                if max_depth > 0:
                    logger.info(f"   🔬 Executing workflow for form: {form_id}")
                    page_data = {"name": page_name, "url": driver.current_url, "forms": []}
                    workflow = await self._execute_form_workflow(driver, context, page_data, i, {"id": form_id, "action": form_action})
                    if workflow:
                        workflows.append(workflow)
                else:
                    # Just discover and document (old behavior for backward compatibility)
                    workflow = {
                        "name": f"{page_name} - {form_id} workflow",
                        "starting_page": page_name,
                        "form_id": form_id,
                        "steps": [],
                        "total_steps": 1,
                        "discovered_only": True  # Mark as not executed
                    }

                    # Step 1: Document form fields
                    workflow["steps"].append({
                        "step": 1,
                        "action": "fill_form",
                        "form_id": form_id,
                        "fields": self._get_form_fields(form)
                    })

                    # If form has action, it likely goes to another page
                    if form_action and form_action not in ["", "#"]:
                        workflow["steps"].append({
                            "step": 2,
                            "action": "submit_form",
                            "expected_navigation": form_action
                        })
                        workflow["total_steps"] = 2

                    # Look for submit buttons
                    submit_buttons = form.find_elements("css selector", "button[type='submit'], input[type='submit']")
                    if submit_buttons:
                        workflow["has_submit_button"] = True

                    workflows.append(workflow)

        except Exception as e:
            logger.warning(f"Error discovering workflows: {e}")

        return workflows

    def _get_form_fields(self, form) -> List[Dict[str, Any]]:
        """Get all fields from a form."""
        fields = []
        try:
            inputs = form.find_elements("css selector", "input, textarea, select")
            for inp in inputs:
                fields.append({
                    "type": inp.get_attribute("type"),
                    "name": inp.get_attribute("name"),
                    "id": inp.get_attribute("id"),
                    "required": inp.get_attribute("required") is not None
                })
        except:
            pass
        return fields

# ============================================================================
# GENERATOR AGENT TOOLS
# ============================================================================

class GeneratorSetupParams(BaseModel):
    """Parameters for generator setup."""
    url: str = Field(description="URL of the web application to test")
    test_plan: str = Field(description="Path to test plan file or test plan content")
    framework: str = Field(
        description="Test framework to generate code for: selenium-python-pytest, selenium-python-unittest, webdriverio-js, webdriverio-ts, robot-framework"
    )

class GeneratorSetupTool(BaseTool):
    """Setup page for test generation."""

    def _create_schema(self) -> ToolSchema:
        return ToolSchema(
            name="generator_setup_page",
            description="Initialize the test generation session and navigate to the application",
            input_schema=GeneratorSetupParams,
            tool_type="readOnly"
        )

    async def handle(self, context: Context, params: GeneratorSetupParams) -> ToolResult:
        """Setup page for test generation."""
        async def setup_action():
            driver = await context.ensure_browser()
            driver.get(params.url)

            # Enable recording to track actions
            context.recording_enabled = True
            context.action_history = []

            # Capture initial snapshot
            await context.capture_snapshot()

            # Initialize generation session
            context.generation_session = {
                "test_plan": params.test_plan,
                "url": params.url,
                "framework": params.framework,
                "tests": []
            }

            logger.info(f"🔧 Test generation session started")
            logger.info(f"📝 Recording enabled - all actions will be logged")
            logger.info(f"🎯 Target framework: {params.framework}")

            return {
                "message": "Test generation session initialized",
                "url": params.url,
                "framework": params.framework,
                "recording": True,
                "test_plan": params.test_plan[:200] + "..." if len(params.test_plan) > 200 else params.test_plan
            }

        code = [
            "# Initialize test generation session",
            f"# Target URL: {params.url}",
            f"# Framework: {params.framework}",
            "# Action recording: ENABLED"
        ]

        return ToolResult(
            code=code,
            action=setup_action,
            capture_snapshot=True,
            wait_for_network=True
        )

class GeneratorReadLogParams(BaseModel):
    """Parameters for reading action log."""
    pass

class GeneratorReadLogTool(BaseTool):
    """Read the action log for code generation."""

    def _create_schema(self) -> ToolSchema:
        return ToolSchema(
            name="generator_read_log",
            description="Retrieve the log of all actions performed during test generation session",
            input_schema=GeneratorReadLogParams,
            tool_type="readOnly"
        )

    async def handle(self, context: Context, params: GeneratorReadLogParams) -> ToolResult:
        """Read action log."""
        async def read_log_action():
            if not context.action_history:
                return {
                    "message": "No actions recorded yet",
                    "actions": []
                }

            # Format action history
            log_entries = []
            for i, action in enumerate(context.action_history, 1):
                log_entries.append({
                    "step": i,
                    "tool": action["tool"],
                    "params": action["params"]
                })

            logger.info(f"📋 Retrieved {len(log_entries)} recorded actions")

            return {
                "message": f"Retrieved {len(log_entries)} actions",
                "actions": log_entries,
                "total": len(log_entries)
            }

        code = [
            "# Retrieve action log for code generation",
            f"# Total actions recorded: {len(context.action_history)}"
        ]

        return ToolResult(
            code=code,
            action=read_log_action,
            capture_snapshot=False,
            wait_for_network=False
        )

class GeneratorWriteTestParams(BaseModel):
    """Parameters for writing test code."""
    test_code: str = Field(description="Generated test code")
    filename: str = Field(description="Filename for the test file (e.g., test_login.py)")
    framework: str = Field(default="pytest", description="Test framework (pytest, unittest, robot)")

class GeneratorWriteTestTool(BaseTool):
    """Write generated test code to file."""

    def _create_schema(self) -> ToolSchema:
        return ToolSchema(
            name="generator_write_test",
            description="Save generated test code to a file",
            input_schema=GeneratorWriteTestParams,
            tool_type="destructive"
        )

    async def handle(self, context: Context, params: GeneratorWriteTestParams) -> ToolResult:
        """Write test code to file."""
        async def write_test_action():
            # Create tests directory if it doesn't exist
            tests_dir = Path.cwd() / "tests"
            tests_dir.mkdir(exist_ok=True)

            # Ensure proper file extension
            if not params.filename.endswith(('.py', '.robot')):
                if params.framework == 'robot':
                    params.filename += '.robot'
                else:
                    params.filename += '.py'

            # Save the test file
            test_path = tests_dir / params.filename
            test_path.write_text(params.test_code)

            # Clear action history after generating
            if context.recording_enabled:
                context.action_history = []

            logger.info(f"✅ Test code saved to: {test_path}")

            return {
                "message": f"Test code saved successfully",
                "file": str(test_path),
                "framework": params.framework,
                "lines": len(params.test_code.split('\n'))
            }

        code = [
            f"# Save {params.framework} test code",
            f"# File: {params.filename}",
            f"# Lines: {len(params.test_code.split('\n'))}"
        ]

        return ToolResult(
            code=code,
            action=write_test_action,
            capture_snapshot=False,
            wait_for_network=False
        )

# ============================================================================
# HEALER AGENT TOOLS
# ============================================================================

class HealerRunTestsParams(BaseModel):
    """Parameters for running tests."""
    test_path: str = Field(description="Path to test file or directory to run")
    framework: str = Field(
        default="pytest",
        description="Test framework to use: selenium-python-pytest, selenium-python-unittest, webdriverio-js, webdriverio-ts, robot-framework"
    )

class HealerRunTestsTool(BaseTool):
    """Run tests and collect failure information."""

    def _create_schema(self) -> ToolSchema:
        return ToolSchema(
            name="healer_run_tests",
            description="Execute test suite and collect failure information for debugging",
            input_schema=HealerRunTestsParams,
            tool_type="readOnly"
        )

    async def handle(self, context: Context, params: HealerRunTestsParams) -> ToolResult:
        """Run tests and collect failures."""
        async def run_tests_action():
            import subprocess

            # Build command based on framework
            if params.framework in ["pytest", "selenium-python-pytest"]:
                cmd = ["pytest", params.test_path, "-v", "--tb=short"]
            elif params.framework in ["unittest", "selenium-python-unittest"]:
                cmd = ["python", "-m", "unittest", params.test_path]
            elif params.framework in ["robot", "robot-framework"]:
                cmd = ["robot", "--outputdir", "results", params.test_path]
            elif params.framework in ["webdriverio-js", "webdriverio-ts"]:
                cmd = ["npx", "wdio", "run", params.test_path]
            else:
                # Default to pytest
                cmd = ["pytest", params.test_path, "-v", "--tb=short"]

            # Run tests
            result = subprocess.run(cmd, capture_output=True, text=True)

            logger.info(f"🧪 Tests executed: {params.test_path}")

            return {
                "message": f"Tests executed",
                "exit_code": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "passed": result.returncode == 0
            }

        code = [
            f"# Run {params.framework} tests",
            f"# Path: {params.test_path}"
        ]

        return ToolResult(
            code=code,
            action=run_tests_action,
            capture_snapshot=False,
            wait_for_network=False
        )

class HealerDebugTestParams(BaseModel):
    """Parameters for debugging a specific test."""
    test_name: str = Field(description="Name of the specific test to debug")
    test_path: str = Field(description="Path to the test file")
    framework: str = Field(
        default="pytest",
        description="Test framework: selenium-python-pytest, selenium-python-unittest, webdriverio-js, webdriverio-ts, robot-framework"
    )

class HealerDebugTestTool(BaseTool):
    """Debug a specific failing test."""

    def _create_schema(self) -> ToolSchema:
        return ToolSchema(
            name="healer_debug_test",
            description="Run a specific test in debug mode with enhanced logging",
            input_schema=HealerDebugTestParams,
            tool_type="readOnly"
        )

    async def handle(self, context: Context, params: HealerDebugTestParams) -> ToolResult:
        """Debug specific test."""
        async def debug_test_action():
            import subprocess

            # Build debug command based on framework
            if params.framework in ["pytest", "selenium-python-pytest"]:
                cmd = ["pytest", f"{params.test_path}::{params.test_name}", "-vv", "-s", "--tb=long"]
            elif params.framework in ["unittest", "selenium-python-unittest"]:
                cmd = ["python", "-m", "unittest", f"{params.test_path}.{params.test_name}", "-v"]
            elif params.framework in ["robot", "robot-framework"]:
                cmd = ["robot", "--outputdir", "results", "--test", params.test_name, params.test_path]
            elif params.framework in ["webdriverio-js", "webdriverio-ts"]:
                cmd = ["npx", "wdio", "run", params.test_path, "--spec", params.test_name]
            else:
                # Default to pytest
                cmd = ["pytest", f"{params.test_path}::{params.test_name}", "-vv", "-s", "--tb=long"]

            result = subprocess.run(cmd, capture_output=True, text=True)

            logger.info(f"🐛 Debugging test: {params.test_name} ({params.framework})")

            return {
                "message": f"Debug run complete for {params.test_name}",
                "exit_code": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "passed": result.returncode == 0
            }

        code = [
            f"# Debug test: {params.test_name}",
            f"# File: {params.test_path}"
        ]

        return ToolResult(
            code=code,
            action=debug_test_action,
            capture_snapshot=False,
            wait_for_network=False
        )

class HealerFixTestParams(BaseModel):
    """Parameters for fixing a test."""
    test_path: str = Field(description="Path to the test file to fix")
    fixed_code: str = Field(description="The corrected test code")
    fix_description: str = Field(description="Description of what was fixed")

class HealerFixTestTool(BaseTool):
    """Apply fix to a test file."""

    def _create_schema(self) -> ToolSchema:
        return ToolSchema(
            name="healer_fix_test",
            description="Apply fixes to a test file and save the corrected version",
            input_schema=HealerFixTestParams,
            tool_type="destructive"
        )

    async def handle(self, context: Context, params: HealerFixTestParams) -> ToolResult:
        """Fix test file."""
        async def fix_test_action():
            # Save the fixed code
            test_path = Path(params.test_path)

            # Backup original
            backup_path = test_path.with_suffix(test_path.suffix + '.bak')
            if test_path.exists():
                backup_path.write_text(test_path.read_text())

            # Write fixed code
            test_path.write_text(params.fixed_code)

            logger.info(f"🔧 Fixed test: {params.test_path}")
            logger.info(f"📋 Fix: {params.fix_description}")

            return {
                "message": f"Test fixed and saved",
                "file": str(test_path),
                "backup": str(backup_path),
                "fix": params.fix_description
            }

        code = [
            f"# Fix applied to: {params.test_path}",
            f"# Description: {params.fix_description}",
            f"# Backup created: {params.test_path}.bak"
        ]

        return ToolResult(
            code=code,
            action=fix_test_action,
            capture_snapshot=False,
            wait_for_network=False
        )

class BrowserGenerateLocatorParams(BaseModel):
    """Parameters for generating element locator."""
    element_description: str = Field(description="Description of the element to find a locator for")

class BrowserGenerateLocatorTool(BaseTool):
    """Generate robust locator for an element."""

    def _create_schema(self) -> ToolSchema:
        return ToolSchema(
            name="browser_generate_locator",
            description="Generate a robust locator strategy for a specific element",
            input_schema=BrowserGenerateLocatorParams,
            tool_type="readOnly"
        )

    async def handle(self, context: Context, params: BrowserGenerateLocatorParams) -> ToolResult:
        """Generate element locator."""
        async def generate_locator_action():
            driver = context.current_tab_or_die()

            # Use snapshot to find matching elements
            if not context.current_snapshot:
                await context.capture_snapshot()

            # Find elements matching description
            matching_elements = []
            for ref, elem_info in context.current_snapshot.elements.items():
                if (params.element_description.lower() in (elem_info.text or "").lower() or
                    params.element_description.lower() in (elem_info.aria_label or "").lower()):
                    matching_elements.append((ref, elem_info))

            if matching_elements:
                ref, elem = matching_elements[0]
                by, locator = context.current_snapshot.ref_locator(ref)

                return {
                    "message": f"Generated locator for: {params.element_description}",
                    "strategy": by,
                    "locator": locator,
                    "element": {
                        "tag": elem.tag_name,
                        "text": elem.text,
                        "id": elem.attributes.get("id")
                    }
                }
            else:
                return {
                    "message": f"No matching element found for: {params.element_description}",
                    "suggestions": "Try capturing a new snapshot or providing a more specific description"
                }

        code = [
            f"# Generate locator for: {params.element_description}"
        ]

        return ToolResult(
            code=code,
            action=generate_locator_action,
            capture_snapshot=True,
            wait_for_network=False
        )
