"""Regression Analyzer tools for risk-based test prioritization."""

import logging
import os
import yaml
import base64
from pathlib import Path
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum
from datetime import datetime

from ..tool_base import BaseTool, ToolSchema, ToolResult
from ..context import Context

logger = logging.getLogger(__name__)


# ============================================================================
# SCREENSHOT UTILITIES
# ============================================================================

def capture_screenshot_to_file(driver, output_dir: Path, name: str) -> Optional[str]:
    """Capture a screenshot and save to file. Returns the relative path."""
    try:
        output_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{name}.png"
        filepath = output_dir / filename
        driver.save_screenshot(str(filepath))
        return filename
    except Exception as e:
        logger.warning(f"Failed to capture screenshot: {e}")
        return None

# ============================================================================
# DOMAIN TEMPLATE LOADER
# ============================================================================

def get_domain_templates_dir() -> Path:
    """Get the domain templates directory."""
    return Path(__file__).parent.parent.parent / "domain_templates"


def load_domain_template(domain: str) -> Optional[Dict[str, Any]]:
    """Load a domain template by name."""
    templates_dir = get_domain_templates_dir()
    template_path = templates_dir / f"{domain}.yaml"

    if template_path.exists():
        with open(template_path, 'r') as f:
            return yaml.safe_load(f)
    return None


def list_available_domains() -> List[str]:
    """List all available domain templates."""
    templates_dir = get_domain_templates_dir()
    if not templates_dir.exists():
        return []
    return [f.stem for f in templates_dir.glob("*.yaml")]


# ============================================================================
# ENUMS AND MODELS
# ============================================================================

class RiskAppetite(str, Enum):
    """Risk appetite levels."""
    STARTUP_MVP = "startup-mvp"  # Move fast, minimal testing
    STANDARD = "standard"  # Balanced approach
    REGULATED = "regulated"  # Maximum coverage, compliance focus


class RiskLevel(str, Enum):
    """Risk classification levels."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


# ============================================================================
# ANALYZER SETUP TOOL
# ============================================================================

class DomainTemplateChoice(str, Enum):
    """How to handle domain template."""
    USE_DETECTED = "use_detected"      # Use the auto-detected domain template
    USE_SPECIFIED = "use_specified"    # Use a user-specified domain template
    SCAN_ALL = "scan_all"              # Scan all sections equally, no domain focus
    ASK = "ask"                        # Return info for user to decide (default)


class AnalyzerSetupParams(BaseModel):
    """Parameters for analyzer setup."""
    url: str = Field(description="Base URL of the product to analyze")
    product_name: str = Field(description="Name of the product")
    domain_type: Optional[str] = Field(
        default=None,
        description="Domain type (e-commerce, saas, banking, healthcare). If not provided, will attempt auto-detection."
    )
    domain_template_choice: DomainTemplateChoice = Field(
        default=DomainTemplateChoice.ASK,
        description="How to handle domain template: 'use_detected', 'use_specified', 'scan_all', or 'ask' (returns options for user)"
    )
    compliance: Optional[List[str]] = Field(
        default=None,
        description="Compliance requirements (e.g., ['PCI-DSS', 'GDPR', 'HIPAA'])"
    )
    risk_appetite: RiskAppetite = Field(
        default=RiskAppetite.STANDARD,
        description="Risk appetite: startup-mvp (minimal), standard (balanced), regulated (maximum)"
    )
    critical_flows: Optional[List[str]] = Field(
        default=None,
        description="User-identified critical business flows (e.g., ['checkout', 'payment', 'registration'])"
    )


class AnalyzerSetupTool(BaseTool):
    """Initialize the regression analysis session."""

    def _create_schema(self) -> ToolSchema:
        return ToolSchema(
            name="analyzer_setup",
            description="Initialize regression analysis session with product URL and business context",
            input_schema=AnalyzerSetupParams,
            tool_type="readOnly"
        )

    async def handle(self, context: Context, params: AnalyzerSetupParams) -> ToolResult:
        """Setup the analyzer session."""
        async def setup_action():
            driver = await context.ensure_browser()
            driver.get(params.url)

            # Capture initial snapshot
            await context.capture_snapshot()

            # Auto-detect domain if not specified
            detected_domain = None
            if not params.domain_type:
                detected_domain = self._auto_detect_domain(driver, context)

            # Determine effective domain
            effective_domain = params.domain_type or detected_domain
            available_domains = list_available_domains()

            # ================================================================
            # DOMAIN TEMPLATE CHOICE: ASK USER
            # ================================================================
            if params.domain_template_choice == DomainTemplateChoice.ASK:
                # Return information for user to decide
                domain_info = None
                if effective_domain:
                    template = load_domain_template(effective_domain)
                    if template:
                        processes = template.get("processes", {})
                        domain_info = {
                            "name": effective_domain,
                            "description": template.get("domain", {}).get("description", ""),
                            "processes": [
                                {
                                    "name": p.get("name", pid),
                                    "risk": p.get("risk", "medium"),
                                    "steps_count": len(p.get("steps", []))
                                }
                                for pid, p in processes.items()
                            ],
                            "focus_areas": [
                                p.get("name", pid) for pid, p in processes.items()
                                if p.get("risk") in ["critical", "high"]
                            ]
                        }

                logger.info(f"🔍 Domain detected: {effective_domain or 'none'}")
                logger.info(f"❓ Awaiting user confirmation for domain template choice")

                return {
                    "status": "awaiting_confirmation",
                    "message": "Domain template detected. Please confirm how to proceed.",
                    "url": params.url,
                    "product_name": params.product_name,
                    "detected_domain": effective_domain,
                    "domain_auto_detected": detected_domain is not None,
                    "domain_info": domain_info,
                    "available_templates": available_domains,
                    "options": {
                        "use_detected": f"Use '{effective_domain}' template - focuses on domain-specific processes" if effective_domain else None,
                        "scan_all": "Scan all sections equally - no domain focus, explores everything",
                        "use_specified": "Choose a different template from: " + ", ".join(available_domains)
                    },
                    "recommendation": f"Use '{effective_domain}' template" if effective_domain else "Scan all (no domain detected)",
                    "next_step": f"Call analyzer_setup again with domain_template_choice='use_detected' or 'scan_all'"
                }

            # ================================================================
            # PROCEED WITH CHOSEN OPTION
            # ================================================================

            # Create output directory for this analysis
            product_slug = params.product_name.lower().replace(" ", "-").replace("_", "-")
            output_dir = Path.cwd() / "product-discovery" / product_slug
            output_dir.mkdir(parents=True, exist_ok=True)
            screenshots_dir = output_dir / "screenshots"
            screenshots_dir.mkdir(exist_ok=True)

            # Determine which domain template to use
            use_domain_template = False
            domain_template = None
            domain_to_use = None

            if params.domain_template_choice == DomainTemplateChoice.USE_DETECTED:
                domain_to_use = effective_domain
                use_domain_template = True
            elif params.domain_template_choice == DomainTemplateChoice.USE_SPECIFIED:
                domain_to_use = params.domain_type
                use_domain_template = True
            elif params.domain_template_choice == DomainTemplateChoice.SCAN_ALL:
                use_domain_template = False
                domain_to_use = None

            # Load domain template if using one
            if use_domain_template and domain_to_use:
                domain_template = load_domain_template(domain_to_use)
                if domain_template:
                    logger.info(f"📋 Loaded domain template: {domain_to_use}")

            # Initialize analysis session
            context.analysis_session = {
                "product_name": params.product_name,
                "product_slug": product_slug,
                "url": params.url,
                "domain_type": domain_to_use,
                "use_domain_template": use_domain_template,
                "domain_template": domain_template,
                "compliance": params.compliance or [],
                "risk_appetite": params.risk_appetite.value,
                "critical_flows": params.critical_flows or [],
                "discovered_features": [],
                "discovered_pages": [],
                "imported_context": [],
                "risk_profile": None,
                "started_at": datetime.now().isoformat(),
                # Screenshot and documentation tracking
                "output_dir": str(output_dir),
                "screenshots_dir": str(screenshots_dir),
                "screenshots": [],
                "process_documentation": []
            }

            logger.info(f"🔍 Analysis session started for: {params.product_name}")
            logger.info(f"🌐 URL: {params.url}")
            logger.info(f"📋 Domain template: {domain_to_use or 'none (scan all)'}")
            logger.info(f"📊 Risk appetite: {params.risk_appetite.value}")

            # Build response based on mode
            if use_domain_template and domain_template:
                processes = domain_template.get("processes", {})
                focus_info = {
                    "mode": "domain_focused",
                    "template": domain_to_use,
                    "will_focus_on": [
                        f"{p.get('name', pid)} ({p.get('risk', 'medium').upper()})"
                        for pid, p in processes.items()
                    ],
                    "critical_processes": [
                        pid for pid, p in processes.items()
                        if p.get("risk") == "critical"
                    ]
                }
            else:
                focus_info = {
                    "mode": "scan_all",
                    "template": None,
                    "will_focus_on": ["All navigation sections equally"],
                    "note": "No domain template - will discover and assess all features"
                }

            return {
                "status": "ready",
                "message": f"Analysis session initialized for '{params.product_name}'",
                "url": params.url,
                "analysis_mode": focus_info,
                "risk_appetite": params.risk_appetite.value,
                "compliance": params.compliance or [],
                "critical_flows": params.critical_flows or [],
                "output_directory": str(output_dir),
                "next_steps": [
                    "Use analyzer_import_context to import additional documents (optional)",
                    "Use analyzer_scan_product to explore and discover features",
                    "Use analyzer_build_risk_profile to generate the risk profile"
                ]
            }

        code = [
            f"# Initialize regression analysis for: {params.product_name}",
            f"# URL: {params.url}",
            f"# Domain: {params.domain_type or 'auto-detect'}",
            f"# Risk appetite: {params.risk_appetite.value}"
        ]

        return ToolResult(
            code=code,
            action=setup_action,
            capture_snapshot=True,
            wait_for_network=True
        )

    def _auto_detect_domain(self, driver, context) -> Optional[str]:
        """Attempt to auto-detect the domain type from page content."""
        try:
            page_source = driver.page_source.lower()
            url = driver.current_url.lower()

            # E-commerce detection
            ecommerce_indicators = [
                "add to cart", "shopping cart", "checkout", "buy now",
                "product", "price", "shop", "store", "/cart", "/checkout"
            ]
            ecommerce_score = sum(1 for ind in ecommerce_indicators if ind in page_source or ind in url)
            if ecommerce_score >= 3:
                logger.info(f"🛒 Auto-detected domain: e-commerce (score: {ecommerce_score})")
                return "e-commerce"

            # Add more domain detection logic here as templates are added
            # banking_indicators = [...]
            # healthcare_indicators = [...]

            return None
        except Exception as e:
            logger.warning(f"Error in domain auto-detection: {e}")
            return None


# ============================================================================
# ANALYZER IMPORT CONTEXT TOOL
# ============================================================================

class AnalyzerImportContextParams(BaseModel):
    """Parameters for importing context."""
    source_type: str = Field(
        description="Type of source: 'file' (local file), 'text' (inline text), 'url' (web page)"
    )
    source: str = Field(
        description="File path, inline text content, or URL depending on source_type"
    )
    context_type: str = Field(
        default="general",
        description="Type of context: 'prd', 'architecture', 'api_spec', 'test_plan', 'general'"
    )
    description: Optional[str] = Field(
        default=None,
        description="Description of what this context contains"
    )


class AnalyzerImportContextTool(BaseTool):
    """Import additional context from documents."""

    def _create_schema(self) -> ToolSchema:
        return ToolSchema(
            name="analyzer_import_context",
            description="Import additional context from local files, inline text, or URLs to enrich the analysis",
            input_schema=AnalyzerImportContextParams,
            tool_type="readOnly"
        )

    async def handle(self, context: Context, params: AnalyzerImportContextParams) -> ToolResult:
        """Import context from various sources."""
        async def import_action():
            if not hasattr(context, 'analysis_session') or context.analysis_session is None:
                return {
                    "error": "No analysis session active. Run analyzer_setup first."
                }

            content = None
            source_info = {}

            if params.source_type == "file":
                # Read from local file
                file_path = Path(params.source)
                if not file_path.exists():
                    return {"error": f"File not found: {params.source}"}

                content = file_path.read_text(encoding='utf-8')
                source_info = {
                    "type": "file",
                    "path": str(file_path.absolute()),
                    "filename": file_path.name
                }

            elif params.source_type == "text":
                # Inline text content
                content = params.source
                source_info = {
                    "type": "text",
                    "length": len(content)
                }

            elif params.source_type == "url":
                # Fetch from URL (placeholder for future SharePoint/Google Docs integration)
                return {
                    "error": "URL import not yet implemented. Use 'file' or 'text' source types.",
                    "future_support": ["SharePoint", "Google Docs", "Confluence"]
                }

            else:
                return {"error": f"Unknown source_type: {params.source_type}"}

            # Store the imported context
            context_entry = {
                "source": source_info,
                "context_type": params.context_type,
                "description": params.description,
                "content_preview": content[:500] + "..." if len(content) > 500 else content,
                "content_length": len(content),
                "imported_at": datetime.now().isoformat()
            }

            # Store full content separately for processing
            context_entry["_full_content"] = content

            context.analysis_session["imported_context"].append(context_entry)

            # Extract relevant information based on context type
            extracted = self._extract_relevant_info(content, params.context_type)

            logger.info(f"📄 Imported context: {params.context_type} ({len(content)} chars)")

            return {
                "message": f"Context imported successfully",
                "source": source_info,
                "context_type": params.context_type,
                "content_length": len(content),
                "extracted_info": extracted,
                "total_contexts": len(context.analysis_session["imported_context"])
            }

        code = [
            f"# Import context from: {params.source_type}",
            f"# Context type: {params.context_type}"
        ]

        return ToolResult(
            code=code,
            action=import_action,
            capture_snapshot=False,
            wait_for_network=False
        )

    def _extract_relevant_info(self, content: str, context_type: str) -> Dict[str, Any]:
        """Extract relevant information from imported content."""
        extracted = {}
        content_lower = content.lower()

        # Look for common patterns
        if context_type == "prd":
            # Extract user stories, requirements
            if "user story" in content_lower or "as a user" in content_lower:
                extracted["has_user_stories"] = True
            if "requirement" in content_lower:
                extracted["has_requirements"] = True

        elif context_type == "architecture":
            # Extract technical components
            if "api" in content_lower:
                extracted["mentions_api"] = True
            if "database" in content_lower:
                extracted["mentions_database"] = True
            if "microservice" in content_lower:
                extracted["architecture_type"] = "microservices"

        elif context_type == "test_plan":
            # Extract existing test info
            extracted["has_existing_tests"] = True

        return extracted


# ============================================================================
# ANALYZER SCAN PRODUCT TOOL
# ============================================================================

class AnalyzerScanProductParams(BaseModel):
    """Parameters for product scanning."""
    scan_depth: str = Field(
        default="standard",
        description="Scan depth: 'quick' (homepage only), 'standard' (main navigation), 'deep' (follow all links)"
    )
    max_pages: int = Field(
        default=20,
        description="Maximum number of pages to scan"
    )
    focus_areas: Optional[List[str]] = Field(
        default=None,
        description="Specific areas to focus on (e.g., ['checkout', 'account'])"
    )
    walk_processes: bool = Field(
        default=True,
        description="Walk through domain template processes (active discovery). Combined with page scanning."
    )
    processes_to_walk: Optional[List[str]] = Field(
        default=None,
        description="Specific processes to walk (e.g., ['purchase_product', 'user_login']). If None, walks all."
    )


class AnalyzerScanProductTool(BaseTool):
    """Scan the product to discover features and structure."""

    def _create_schema(self) -> ToolSchema:
        return ToolSchema(
            name="analyzer_scan_product",
            description="Explore the product using both process walking (from domain template) and page scanning",
            input_schema=AnalyzerScanProductParams,
            tool_type="readOnly"
        )

    async def handle(self, context: Context, params: AnalyzerScanProductParams) -> ToolResult:
        """Scan the product using dual approach: process walking + page scanning."""
        async def scan_action():
            if not hasattr(context, 'analysis_session') or context.analysis_session is None:
                return {
                    "error": "No analysis session active. Run analyzer_setup first."
                }

            driver = context.current_tab_or_die()
            base_url = context.analysis_session["url"]
            domain_template = context.analysis_session.get("domain_template")

            from urllib.parse import urlparse
            base_domain = urlparse(base_url).netloc

            # Results containers
            discovered_features = []
            discovered_pages = []
            visited_urls = set()
            process_results = {}  # Results from walking processes
            advisory_gaps = []    # What's expected but not found (advisory only)

            # Check if we should use domain template (from setup choice)
            use_domain_template = context.analysis_session.get("use_domain_template", True)

            # =================================================================
            # PHASE 1: PROCESS WALKING (Active Discovery from Domain Template)
            # =================================================================
            if params.walk_processes and domain_template and use_domain_template:
                logger.info("🚶 Phase 1: Walking domain processes (domain-focused mode)...")

                processes = domain_template.get("processes", {})
                processes_to_walk = params.processes_to_walk or list(processes.keys())

                for process_name in processes_to_walk:
                    if process_name not in processes:
                        continue

                    process = processes[process_name]
                    process_result = await self._walk_process(
                        driver, context, process_name, process, base_url, visited_urls
                    )
                    process_results[process_name] = process_result

                    # Collect discovered features from process
                    for step_result in process_result.get("steps", []):
                        discovered_features.extend(step_result.get("features_found", []))
                        if step_result.get("page_data"):
                            discovered_pages.append(step_result["page_data"])

                    # Collect advisory gaps
                    advisory_gaps.extend(process_result.get("gaps", []))

                    logger.info(f"  ✅ Process '{process_name}': {process_result['summary']}")

            # =================================================================
            # PHASE 2: PAGE SCANNING (Passive Discovery)
            # =================================================================
            if not use_domain_template:
                logger.info("📄 Scanning all pages (scan-all mode - no domain focus)...")
            else:
                logger.info("📄 Phase 2: Scanning pages...")

            # Get screenshots directory
            screenshots_dir = Path(context.analysis_session.get("screenshots_dir", "."))

            # Return to base URL for page scanning
            driver.get(base_url)
            await context.capture_snapshot()

            # Capture homepage screenshot
            homepage_screenshot = capture_screenshot_to_file(driver, screenshots_dir, "homepage")
            if homepage_screenshot:
                context.analysis_session["screenshots"].append({
                    "name": "homepage",
                    "file": homepage_screenshot,
                    "context": "Homepage",
                    "url": driver.current_url,
                    "title": driver.title
                })

            # Analyze homepage
            homepage_features = self._analyze_page(driver, context)
            if base_url not in visited_urls:
                discovered_pages.append({
                    "url": driver.current_url,
                    "title": driver.title,
                    "is_homepage": True,
                    "features": homepage_features,
                    "discovery_method": "page_scan",
                    "screenshot": homepage_screenshot
                })
                visited_urls.add(driver.current_url)
            discovered_features.extend(homepage_features)

            # Get navigation links
            nav_links = self._discover_navigation(driver, base_domain)

            if params.scan_depth != "quick":
                # Filter by focus areas if specified
                if params.focus_areas:
                    nav_links = [
                        link for link in nav_links
                        if any(area.lower() in link["href"].lower() or
                               area.lower() in link["text"].lower()
                               for area in params.focus_areas)
                    ]

                # Scan additional pages
                pages_scanned = 1
                for link in nav_links:
                    if pages_scanned >= params.max_pages:
                        break
                    if link["href"] in visited_urls:
                        continue

                    try:
                        driver.get(link["href"])
                        await context.capture_snapshot()

                        # Capture screenshot for this page
                        page_slug = link["text"].lower().replace(" ", "_").replace("/", "_")[:30]
                        page_screenshot = capture_screenshot_to_file(driver, screenshots_dir, f"page_{page_slug}")
                        if page_screenshot:
                            context.analysis_session["screenshots"].append({
                                "name": f"page_{page_slug}",
                                "file": page_screenshot,
                                "context": f"Page: {link['text']}",
                                "url": driver.current_url,
                                "title": driver.title
                            })

                        page_features = self._analyze_page(driver, context)
                        discovered_pages.append({
                            "url": driver.current_url,
                            "title": driver.title,
                            "nav_text": link["text"],
                            "features": page_features,
                            "discovery_method": "page_scan",
                            "screenshot": page_screenshot
                        })

                        visited_urls.add(driver.current_url)
                        discovered_features.extend(page_features)
                        pages_scanned += 1

                        logger.info(f"  📄 Scanned: {link['text']} ({len(page_features)} features)")

                    except Exception as e:
                        logger.warning(f"Error scanning {link['href']}: {e}")
                        continue

            # =================================================================
            # PHASE 3: COMBINE AND COMPARE
            # =================================================================
            logger.info("🔄 Phase 3: Combining results...")

            # Deduplicate features
            unique_features = self._deduplicate_features(discovered_features)

            # Store in session
            context.analysis_session["discovered_features"] = unique_features
            context.analysis_session["discovered_pages"] = discovered_pages
            context.analysis_session["process_results"] = process_results
            context.analysis_session["advisory_gaps"] = advisory_gaps

            # Categorize features using domain template
            categorized = self._categorize_features(unique_features, context)

            # Compare expected vs found (advisory)
            expected_vs_found = self._compare_expected_vs_found(domain_template, unique_features, process_results)

            logger.info(f"🔍 Scan complete: {len(discovered_pages)} pages, {len(unique_features)} features")
            if advisory_gaps:
                logger.info(f"📋 Advisory: {len(advisory_gaps)} expected features not found")

            return {
                "message": f"Product scan complete (process walking + page scanning)",
                "pages_scanned": len(discovered_pages),
                "features_discovered": len(unique_features),
                "features_by_category": categorized,
                "navigation_structure": [p["nav_text"] for p in discovered_pages if "nav_text" in p],
                "forms_found": sum(1 for f in unique_features if f["type"] == "form"),

                # Process walking results
                "process_results": {
                    name: {
                        "status": result.get("status"),
                        "steps_completed": result.get("steps_completed", 0),
                        "steps_total": result.get("steps_total", 0),
                        "blocked_at": result.get("blocked_at"),
                        "summary": result.get("summary")
                    }
                    for name, result in process_results.items()
                },

                # Advisory gaps (not errors, just information)
                "advisory": {
                    "gaps": advisory_gaps,
                    "expected_vs_found": expected_vs_found,
                    "note": "Gaps are advisory - features may be intentionally absent or located elsewhere"
                },

                "next_step": "Use analyzer_build_risk_profile to generate risk assessments"
            }

        code = [
            f"# Scan product with depth: {params.scan_depth}",
            f"# Walk processes: {params.walk_processes}",
            f"# Max pages: {params.max_pages}"
        ]

        return ToolResult(
            code=code,
            action=scan_action,
            capture_snapshot=True,
            wait_for_network=True
        )

    async def _walk_process(
        self,
        driver,
        context,
        process_name: str,
        process: Dict[str, Any],
        base_url: str,
        visited_urls: set
    ) -> Dict[str, Any]:
        """Walk through a process from the domain template, step by step."""
        import time

        # Get screenshots directory
        screenshots_dir = Path(context.analysis_session.get("screenshots_dir", "."))

        result = {
            "process": process_name,
            "process_display_name": process.get("name", process_name),
            "description": process.get("description", ""),
            "risk": process.get("risk", "medium"),
            "steps": [],
            "steps_completed": 0,
            "steps_total": len(process.get("steps", [])),
            "status": "completed",
            "blocked_at": None,
            "gaps": [],
            "summary": "",
            "screenshots": []  # Screenshots captured during this process
        }

        steps = process.get("steps", [])

        for step in steps:
            step_id = step.get("id", "unknown")
            step_name = step.get("name", step_id)
            discover = step.get("discover", {})

            step_result = {
                "step_id": step_id,
                "step_name": step_name,
                "step_action": step.get("action", ""),
                "status": "not_started",
                "features_found": [],
                "features_expected": step.get("features", []),
                "page_data": None,
                "screenshot": None,  # Screenshot filename for this step
                "url": None
            }

            try:
                # Try to discover this step
                found = False

                # Try navigate_to URLs first
                for url_path in discover.get("navigate_to", []):
                    try:
                        full_url = base_url.rstrip('/') + url_path
                        driver.get(full_url)
                        time.sleep(1)
                        await context.capture_snapshot()

                        # Check if page loaded successfully (not 404)
                        if "404" not in driver.title.lower() and "not found" not in driver.page_source.lower():
                            found = True
                            step_result["status"] = "found_via_url"
                            step_result["url"] = full_url
                            visited_urls.add(full_url)
                            break
                    except:
                        continue

                # If not found via URL, try looking for elements
                if not found:
                    look_for = discover.get("look_for", [])
                    for indicator in look_for:
                        if self._find_indicator(driver, indicator):
                            found = True
                            step_result["status"] = "found_via_element"
                            break

                # If still not found, try actions
                if not found and discover.get("actions"):
                    for action in discover.get("actions", []):
                        if await self._try_action(driver, context, action):
                            found = True
                            step_result["status"] = "found_via_action"
                            break

                if found:
                    # Capture screenshot for this step
                    screenshot_name = f"{process_name}_{step_id}"
                    screenshot_file = capture_screenshot_to_file(driver, screenshots_dir, screenshot_name)
                    if screenshot_file:
                        step_result["screenshot"] = screenshot_file
                        result["screenshots"].append({
                            "step": step_name,
                            "file": screenshot_file,
                            "url": driver.current_url
                        })
                        # Also track in session
                        context.analysis_session["screenshots"].append({
                            "name": screenshot_name,
                            "file": screenshot_file,
                            "context": f"Process: {process_name}, Step: {step_name}",
                            "url": driver.current_url,
                            "title": driver.title
                        })

                    step_result["url"] = driver.current_url

                    # Analyze what we found
                    page_features = self._analyze_page(driver, context)
                    step_result["features_found"] = page_features
                    step_result["page_data"] = {
                        "url": driver.current_url,
                        "title": driver.title,
                        "step": step_name,
                        "features": page_features,
                        "discovery_method": "process_walk",
                        "screenshot": screenshot_file
                    }
                    result["steps_completed"] += 1

                    # Check which expected features were found
                    expected = step.get("features", [])
                    found_names = [f.get("name", "").lower() for f in page_features]
                    for exp_feature in expected:
                        if not any(exp_feature.lower() in fn for fn in found_names):
                            result["gaps"].append({
                                "process": process_name,
                                "step": step_name,
                                "expected_feature": exp_feature,
                                "severity": "advisory",
                                "note": f"Expected '{exp_feature}' in step '{step_name}' but not found"
                            })
                else:
                    step_result["status"] = "not_found"
                    result["status"] = "blocked"
                    result["blocked_at"] = step_name

                    # Add gap for the step itself
                    result["gaps"].append({
                        "process": process_name,
                        "step": step_name,
                        "expected_feature": step_name,
                        "severity": "advisory",
                        "note": f"Could not find step '{step_name}' - process blocked here"
                    })

                    # Don't continue walking if blocked
                    result["steps"].append(step_result)
                    break

            except Exception as e:
                step_result["status"] = "error"
                step_result["error"] = str(e)
                logger.warning(f"Error in step {step_name}: {e}")

            result["steps"].append(step_result)

        # Generate summary
        if result["status"] == "completed":
            result["summary"] = f"All {result['steps_total']} steps completed"
        else:
            result["summary"] = f"Blocked at '{result['blocked_at']}' ({result['steps_completed']}/{result['steps_total']} steps)"

        return result

    def _find_indicator(self, driver, indicator: str) -> bool:
        """Try to find an indicator on the page."""
        try:
            page_source = driver.page_source.lower()
            indicator_lower = indicator.lower()

            # Simple text search
            if indicator_lower in page_source:
                return True

            # Try as selector if it looks like one
            if indicator.startswith(('.', '#', '[', 'button', 'input', 'a')):
                try:
                    elements = driver.find_elements("css selector", indicator)
                    if elements:
                        return True
                except:
                    pass

            return False
        except:
            return False

    async def _try_action(self, driver, context, action: str) -> bool:
        """Try to perform an action like clicking a button."""
        try:
            action_lower = action.lower()

            # Find clickable elements matching the action
            if "click" in action_lower or "add to cart" in action_lower:
                # Try to find and click relevant buttons
                button_texts = ["add to cart", "add to basket", "buy", "checkout", "cart"]
                for text in button_texts:
                    if text in action_lower:
                        try:
                            buttons = driver.find_elements("xpath", f"//button[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{text}')]")
                            if buttons:
                                buttons[0].click()
                                await context.capture_snapshot()
                                return True
                        except:
                            continue

            return False
        except:
            return False

    def _compare_expected_vs_found(
        self,
        domain_template: Optional[Dict],
        discovered_features: List[Dict],
        process_results: Dict
    ) -> Dict[str, Any]:
        """Compare what the template expects vs what was found."""
        if not domain_template:
            return {"note": "No domain template - comparison skipped"}

        comparison = {
            "processes": {},
            "summary": {
                "total_expected": 0,
                "total_found": 0,
                "coverage_percent": 0
            }
        }

        processes = domain_template.get("processes", {})
        discovered_names = [f.get("name", "").lower() for f in discovered_features]

        for process_name, process in processes.items():
            process_comparison = {
                "expected_steps": [],
                "found_steps": [],
                "missing_steps": [],
                "status": "unknown"
            }

            if process_name in process_results:
                result = process_results[process_name]
                process_comparison["status"] = result.get("status", "unknown")
                process_comparison["found_steps"] = [
                    s["step_name"] for s in result.get("steps", [])
                    if s.get("status") not in ["not_found", "error"]
                ]

            for step in process.get("steps", []):
                step_name = step.get("name", step.get("id", "unknown"))
                process_comparison["expected_steps"].append(step_name)
                comparison["summary"]["total_expected"] += 1

                if step_name in process_comparison["found_steps"]:
                    comparison["summary"]["total_found"] += 1
                else:
                    process_comparison["missing_steps"].append(step_name)

            comparison["processes"][process_name] = process_comparison

        # Calculate coverage
        if comparison["summary"]["total_expected"] > 0:
            comparison["summary"]["coverage_percent"] = round(
                (comparison["summary"]["total_found"] / comparison["summary"]["total_expected"]) * 100,
                1
            )

        return comparison

    def _discover_navigation(self, driver, base_domain: str) -> List[Dict[str, str]]:
        """Discover navigation links."""
        from urllib.parse import urlparse

        links = []
        nav_selectors = [
            "nav a", "header a", "[role='navigation'] a",
            ".nav a", ".navbar a", ".menu a", ".sidebar a"
        ]

        for selector in nav_selectors:
            try:
                elements = driver.find_elements("css selector", selector)
                for elem in elements:
                    try:
                        href = elem.get_attribute("href")
                        text = elem.text.strip()
                        if href and text:
                            # Only include same-domain links
                            parsed = urlparse(href)
                            if parsed.netloc == base_domain or parsed.netloc == "":
                                links.append({"text": text, "href": href})
                    except:
                        continue
            except:
                continue

        # Deduplicate
        seen = set()
        unique_links = []
        for link in links:
            key = link["href"]
            if key not in seen:
                seen.add(key)
                unique_links.append(link)

        return unique_links

    def _analyze_page(self, driver, context) -> List[Dict[str, Any]]:
        """Analyze a page for features."""
        features = []

        # Detect forms
        forms = driver.find_elements("tag name", "form")
        for i, form in enumerate(forms):
            form_id = form.get_attribute("id") or f"form_{i}"
            form_action = form.get_attribute("action") or ""

            # Determine form purpose
            form_purpose = self._classify_form(form, form_action)

            inputs = form.find_elements("css selector", "input, textarea, select")
            features.append({
                "type": "form",
                "name": form_purpose,
                "id": form_id,
                "action": form_action,
                "input_count": len(inputs),
                "page_url": driver.current_url
            })

        # Detect interactive elements from snapshot
        if context.current_snapshot:
            buttons = [e for e in context.current_snapshot.elements.values()
                      if e.tag_name == "button"]
            for btn in buttons:
                btn_text = btn.text or btn.aria_label or ""
                if btn_text:
                    feature_type = self._classify_button(btn_text)
                    if feature_type:
                        features.append({
                            "type": "action",
                            "name": feature_type,
                            "element": "button",
                            "text": btn_text,
                            "page_url": driver.current_url
                        })

        # Detect key page patterns
        page_source = driver.page_source.lower()
        page_patterns = {
            "shopping_cart": ["cart", "basket", "shopping bag"],
            "checkout": ["checkout", "payment", "billing"],
            "search": ["search", "find"],
            "login": ["login", "sign in", "log in"],
            "registration": ["register", "sign up", "create account"],
            "product_listing": ["products", "catalog", "items"],
            "user_account": ["my account", "profile", "settings"]
        }

        for feature_name, patterns in page_patterns.items():
            if any(p in page_source for p in patterns):
                if not any(f["name"] == feature_name for f in features):
                    features.append({
                        "type": "page_feature",
                        "name": feature_name,
                        "page_url": driver.current_url
                    })

        return features

    def _classify_form(self, form, action: str) -> str:
        """Classify form purpose."""
        action_lower = action.lower()

        # Get form text content
        try:
            form_text = form.text.lower()
        except:
            form_text = ""

        classifications = {
            "login_form": ["login", "signin", "sign-in", "auth"],
            "registration_form": ["register", "signup", "sign-up", "create-account"],
            "checkout_form": ["checkout", "payment", "billing"],
            "search_form": ["search", "query", "find"],
            "contact_form": ["contact", "message", "inquiry"],
            "newsletter_form": ["subscribe", "newsletter", "email"],
            "profile_form": ["profile", "account", "settings"]
        }

        for form_type, keywords in classifications.items():
            if any(kw in action_lower or kw in form_text for kw in keywords):
                return form_type

        return "generic_form"

    def _classify_button(self, text: str) -> Optional[str]:
        """Classify button purpose."""
        text_lower = text.lower()

        classifications = {
            "add_to_cart": ["add to cart", "add to basket", "add to bag"],
            "buy_now": ["buy now", "purchase", "order now"],
            "checkout": ["checkout", "proceed to checkout"],
            "login": ["login", "sign in", "log in"],
            "register": ["register", "sign up", "create account"],
            "search": ["search", "find"],
            "submit": ["submit", "send"],
            "save": ["save", "update"],
            "delete": ["delete", "remove"]
        }

        for btn_type, keywords in classifications.items():
            if any(kw in text_lower for kw in keywords):
                return btn_type

        return None

    def _deduplicate_features(self, features: List[Dict]) -> List[Dict]:
        """Remove duplicate features."""
        seen = set()
        unique = []

        for f in features:
            key = (f["type"], f["name"])
            if key not in seen:
                seen.add(key)
                unique.append(f)

        return unique

    def _categorize_features(self, features: List[Dict], context) -> Dict[str, List[str]]:
        """Categorize features using domain template."""
        categorized = {
            "critical": [],
            "high": [],
            "medium": [],
            "low": [],
            "uncategorized": []
        }

        domain_template = context.analysis_session.get("domain_template")

        if domain_template:
            template_features = domain_template.get("features", {})

            for feature in features:
                feature_name = feature["name"].lower().replace("_", "").replace("-", "").replace(" ", "")
                matched = False

                for template_name, template_info in template_features.items():
                    template_name_normalized = template_name.lower().replace("_", "")

                    if feature_name in template_name_normalized or template_name_normalized in feature_name:
                        risk_level = template_info.get("risk", "medium")
                        categorized[risk_level].append(feature["name"])
                        matched = True
                        break

                if not matched:
                    categorized["uncategorized"].append(feature["name"])
        else:
            # No template, everything is uncategorized
            categorized["uncategorized"] = [f["name"] for f in features]

        return {k: v for k, v in categorized.items() if v}


# ============================================================================
# ANALYZER BUILD RISK PROFILE TOOL
# ============================================================================

class AnalyzerBuildRiskProfileParams(BaseModel):
    """Parameters for building risk profile."""
    include_recommendations: bool = Field(
        default=True,
        description="Include test recommendations in the profile"
    )
    include_pipeline_config: bool = Field(
        default=True,
        description="Include CI/CD pipeline configuration recommendations"
    )


class AnalyzerBuildRiskProfileTool(BaseTool):
    """Build the risk profile from gathered data."""

    def _create_schema(self) -> ToolSchema:
        return ToolSchema(
            name="analyzer_build_risk_profile",
            description="Build comprehensive risk profile from discovered features and context",
            input_schema=AnalyzerBuildRiskProfileParams,
            tool_type="readOnly"
        )

    async def handle(self, context: Context, params: AnalyzerBuildRiskProfileParams) -> ToolResult:
        """Build the risk profile."""
        async def build_action():
            if not hasattr(context, 'analysis_session') or context.analysis_session is None:
                return {
                    "error": "No analysis session active. Run analyzer_setup first."
                }

            session = context.analysis_session

            if not session.get("discovered_features"):
                return {
                    "error": "No features discovered. Run analyzer_scan_product first."
                }

            domain_template = session.get("domain_template")
            discovered_features = session["discovered_features"]
            critical_flows = session.get("critical_flows", [])
            compliance = session.get("compliance", [])
            risk_appetite = session.get("risk_appetite", "standard")

            # Build feature risk assessments
            feature_assessments = []

            for feature in discovered_features:
                assessment = self._assess_feature_risk(
                    feature,
                    domain_template,
                    critical_flows,
                    compliance,
                    risk_appetite
                )
                feature_assessments.append(assessment)

            # Sort by risk score
            feature_assessments.sort(key=lambda x: x["risk_score"], reverse=True)

            # Build coverage recommendations
            coverage_recommendations = self._build_coverage_recommendations(
                feature_assessments,
                risk_appetite
            )

            # Build pipeline config
            pipeline_config = None
            if params.include_pipeline_config:
                pipeline_config = self._build_pipeline_config(
                    feature_assessments,
                    domain_template
                )

            # Identify gaps
            gaps = self._identify_gaps(feature_assessments, domain_template)

            # Build the complete profile
            risk_profile = {
                "product": {
                    "name": session["product_name"],
                    "url": session["url"],
                    "domain": session.get("domain_type", "unknown"),
                    "analyzed_date": datetime.now().isoformat()
                },
                "business_context": {
                    "type": session.get("domain_type", "unknown"),
                    "compliance": compliance,
                    "risk_appetite": risk_appetite,
                    "critical_flows": critical_flows
                },
                "features": feature_assessments,
                "coverage_recommendations": coverage_recommendations,
                "gaps": gaps,
                "summary": {
                    "total_features": len(feature_assessments),
                    "critical_count": sum(1 for f in feature_assessments if f["risk_level"] == "critical"),
                    "high_count": sum(1 for f in feature_assessments if f["risk_level"] == "high"),
                    "medium_count": sum(1 for f in feature_assessments if f["risk_level"] == "medium"),
                    "low_count": sum(1 for f in feature_assessments if f["risk_level"] == "low")
                }
            }

            if pipeline_config:
                risk_profile["pipeline_config"] = pipeline_config

            # Store in session
            session["risk_profile"] = risk_profile

            logger.info(f"📊 Risk profile built: {risk_profile['summary']}")

            return {
                "message": "Risk profile built successfully",
                "summary": risk_profile["summary"],
                "critical_features": [f["name"] for f in feature_assessments if f["risk_level"] == "critical"],
                "high_features": [f["name"] for f in feature_assessments if f["risk_level"] == "high"],
                "skip_recommendations": [f["name"] for f in feature_assessments if f.get("skip_recommendation")],
                "gaps_identified": len(gaps),
                "next_step": "Review the profile and use analyzer_save_profile to save it"
            }

        code = [
            "# Build risk profile from discovered data",
            f"# Include recommendations: {params.include_recommendations}",
            f"# Include pipeline config: {params.include_pipeline_config}"
        ]

        return ToolResult(
            code=code,
            action=build_action,
            capture_snapshot=False,
            wait_for_network=False
        )

    def _assess_feature_risk(
        self,
        feature: Dict[str, Any],
        domain_template: Optional[Dict],
        critical_flows: List[str],
        compliance: List[str],
        risk_appetite: str
    ) -> Dict[str, Any]:
        """Assess risk for a single feature."""

        feature_name = feature["name"]
        feature_name_lower = feature_name.lower()

        # Default scores
        revenue_impact = 0.3
        user_impact = 0.3
        frequency = 0.5
        complexity = 0.3
        compliance_score = 0.0

        # Check domain template
        if domain_template:
            template_features = domain_template.get("features", {})
            for tpl_name, tpl_info in template_features.items():
                if tpl_name.lower() in feature_name_lower or feature_name_lower in tpl_name.lower():
                    risk_level = tpl_info.get("risk", "medium")

                    # Set scores based on template risk level
                    if risk_level == "critical":
                        revenue_impact = 0.9
                        user_impact = 0.9
                    elif risk_level == "high":
                        revenue_impact = 0.7
                        user_impact = 0.7
                    elif risk_level == "medium":
                        revenue_impact = 0.4
                        user_impact = 0.5
                    else:
                        revenue_impact = 0.2
                        user_impact = 0.2

                    # Check compliance
                    if tpl_info.get("compliance"):
                        if any(c in compliance for c in tpl_info["compliance"]):
                            compliance_score = 0.8

                    break

        # Boost if in critical flows
        if any(flow.lower() in feature_name_lower for flow in critical_flows):
            revenue_impact = max(revenue_impact, 0.8)
            user_impact = max(user_impact, 0.8)

        # Calculate final score
        risk_score = (
            revenue_impact * 0.30 +
            user_impact * 0.25 +
            frequency * 0.15 +
            complexity * 0.15 +
            compliance_score * 0.15
        )

        # Classify
        if risk_score >= 0.8:
            risk_level = "critical"
        elif risk_score >= 0.6:
            risk_level = "high"
        elif risk_score >= 0.4:
            risk_level = "medium"
        else:
            risk_level = "low"

        # Adjust for risk appetite
        if risk_appetite == "startup-mvp" and risk_level == "medium":
            risk_level = "low"
        elif risk_appetite == "regulated" and risk_level == "medium":
            risk_level = "high"

        # Build assessment
        assessment = {
            "name": feature_name,
            "type": feature.get("type", "unknown"),
            "risk_level": risk_level,
            "risk_score": round(risk_score, 2),
            "risk_factors": {
                "revenue_impact": "high" if revenue_impact >= 0.7 else "medium" if revenue_impact >= 0.4 else "low",
                "user_impact": "high" if user_impact >= 0.7 else "medium" if user_impact >= 0.4 else "low",
                "compliance": compliance_score > 0
            },
            "recommended_tests": self._get_recommended_tests(risk_level, feature.get("type")),
            "skip_recommendation": risk_level == "low" and risk_appetite == "startup-mvp"
        }

        return assessment

    def _get_recommended_tests(self, risk_level: str, feature_type: str) -> List[Dict]:
        """Get recommended test types for a feature."""
        recommendations = []

        if risk_level == "critical":
            recommendations = [
                {"type": "happy_path", "priority": 1},
                {"type": "error_handling", "priority": 1},
                {"type": "edge_cases", "priority": 2},
                {"type": "data_validation", "priority": 2}
            ]
        elif risk_level == "high":
            recommendations = [
                {"type": "happy_path", "priority": 1},
                {"type": "error_handling", "priority": 2}
            ]
        elif risk_level == "medium":
            recommendations = [
                {"type": "happy_path", "priority": 2}
            ]
        else:  # low
            recommendations = [
                {"type": "smoke", "priority": 3}
            ]

        return recommendations

    def _build_coverage_recommendations(
        self,
        assessments: List[Dict],
        risk_appetite: str
    ) -> Dict[str, Any]:
        """Build coverage recommendations by risk level."""
        recommendations = {
            "critical": {
                "features": [a["name"] for a in assessments if a["risk_level"] == "critical"],
                "test_depth": "comprehensive",
                "run_on": "every_deploy"
            },
            "high": {
                "features": [a["name"] for a in assessments if a["risk_level"] == "high"],
                "test_depth": "standard",
                "run_on": "every_pr"
            },
            "medium": {
                "features": [a["name"] for a in assessments if a["risk_level"] == "medium"],
                "test_depth": "happy_path_only",
                "run_on": "nightly"
            },
            "low": {
                "features": [a["name"] for a in assessments if a["risk_level"] == "low"],
                "test_depth": "smoke",
                "run_on": "weekly"
            }
        }

        # Adjust for risk appetite
        if risk_appetite == "startup-mvp":
            recommendations["low"]["run_on"] = "monthly_or_skip"
            recommendations["medium"]["run_on"] = "weekly"
        elif risk_appetite == "regulated":
            recommendations["low"]["run_on"] = "nightly"
            recommendations["medium"]["test_depth"] = "standard"

        return recommendations

    def _build_pipeline_config(
        self,
        assessments: List[Dict],
        domain_template: Optional[Dict]
    ) -> Dict[str, Any]:
        """Build CI/CD pipeline configuration."""

        # Use template config if available
        if domain_template and "pipeline_recommendations" in domain_template:
            return domain_template["pipeline_recommendations"]

        # Default config
        return {
            "pr_checks": {
                "tests": ["critical", "high"],
                "timeout": "15m",
                "fail_fast": True
            },
            "pre_deploy": {
                "tests": ["critical", "high", "medium"],
                "timeout": "30m",
                "fail_fast": True
            },
            "nightly": {
                "tests": ["all"],
                "timeout": "60m",
                "fail_fast": False
            }
        }

    def _identify_gaps(
        self,
        assessments: List[Dict],
        domain_template: Optional[Dict]
    ) -> List[Dict[str, Any]]:
        """Identify coverage gaps."""
        gaps = []

        if domain_template:
            template_features = domain_template.get("features", {})
            discovered_names = {a["name"].lower() for a in assessments}

            for tpl_name, tpl_info in template_features.items():
                risk = tpl_info.get("risk", "medium")
                if risk in ["critical", "high"]:
                    # Check if this feature was discovered
                    if not any(tpl_name.lower() in name for name in discovered_names):
                        gaps.append({
                            "area": tpl_name,
                            "expected_risk": risk,
                            "severity": "high" if risk == "critical" else "medium",
                            "recommendation": f"Verify if {tpl_name} functionality exists and add tests"
                        })

        return gaps


# ============================================================================
# ANALYZER SAVE PROFILE TOOL
# ============================================================================

class AnalyzerSaveProfileParams(BaseModel):
    """Parameters for saving risk profile."""
    filename: Optional[str] = Field(
        default=None,
        description="Output filename (defaults to product-name-risk-profile.yaml)"
    )
    output_format: str = Field(
        default="yaml",
        description="Output format: 'yaml' or 'json'"
    )


class AnalyzerSaveProfileTool(BaseTool):
    """Save the risk profile to a file."""

    def _create_schema(self) -> ToolSchema:
        return ToolSchema(
            name="analyzer_save_profile",
            description="Save the completed risk profile to a file",
            input_schema=AnalyzerSaveProfileParams,
            tool_type="destructive"
        )

    async def handle(self, context: Context, params: AnalyzerSaveProfileParams) -> ToolResult:
        """Save the risk profile."""
        async def save_action():
            if not hasattr(context, 'analysis_session') or context.analysis_session is None:
                return {
                    "error": "No analysis session active. Run analyzer_setup first."
                }

            session = context.analysis_session
            risk_profile = session.get("risk_profile")

            if not risk_profile:
                return {
                    "error": "No risk profile built. Run analyzer_build_risk_profile first."
                }

            # Determine filename
            if params.filename:
                filename = params.filename
            else:
                product_name = session["product_name"].lower().replace(" ", "-")
                ext = "yaml" if params.output_format == "yaml" else "json"
                filename = f"{product_name}-risk-profile.{ext}"

            # Create output directory
            output_dir = Path.cwd() / "risk-profiles"
            output_dir.mkdir(exist_ok=True)

            output_path = output_dir / filename

            # Save the profile
            if params.output_format == "yaml":
                with open(output_path, 'w') as f:
                    yaml.dump(risk_profile, f, default_flow_style=False, sort_keys=False)
            else:
                import json
                with open(output_path, 'w') as f:
                    json.dump(risk_profile, f, indent=2)

            logger.info(f"💾 Risk profile saved to: {output_path}")

            summary = risk_profile.get("summary", {})

            return {
                "message": "Risk profile saved successfully",
                "file": str(output_path),
                "format": params.output_format,
                "summary": summary,
                "next_steps": [
                    "Review the risk profile for accuracy",
                    "Adjust risk levels if needed",
                    f"Use Planner agent with: 'Plan regression tests using {output_path}'"
                ]
            }

        code = [
            "# Save risk profile to file",
            f"# Format: {params.output_format}"
        ]

        return ToolResult(
            code=code,
            action=save_action,
            capture_snapshot=False,
            wait_for_network=False
        )


# ============================================================================
# ANALYZER GENERATE DOCUMENTATION TOOL
# ============================================================================

class AnalyzerGenerateDocumentationParams(BaseModel):
    """Parameters for generating product documentation."""
    include_screenshots: bool = Field(
        default=True,
        description="Include screenshots in the documentation"
    )
    include_risk_summary: bool = Field(
        default=True,
        description="Include risk assessment summary"
    )
    output_format: str = Field(
        default="both",
        description="Output format: 'markdown', 'html', or 'both' (recommended)"
    )
    output_filename: Optional[str] = Field(
        default=None,
        description="Output filename without extension (defaults to product-discovery)"
    )


class AnalyzerGenerateDocumentationTool(BaseTool):
    """Generate product discovery documentation with screenshots."""

    def _create_schema(self) -> ToolSchema:
        return ToolSchema(
            name="analyzer_generate_documentation",
            description="Generate a comprehensive product discovery document with screenshots - serves as input for the Planner agent",
            input_schema=AnalyzerGenerateDocumentationParams,
            tool_type="destructive"
        )

    async def handle(self, context: Context, params: AnalyzerGenerateDocumentationParams) -> ToolResult:
        """Generate product discovery documentation."""
        async def generate_action():
            if not hasattr(context, 'analysis_session') or context.analysis_session is None:
                return {
                    "error": "No analysis session active. Run analyzer_setup first."
                }

            session = context.analysis_session

            if not session.get("discovered_features"):
                return {
                    "error": "No features discovered. Run analyzer_scan_product first."
                }

            # Get output directory
            output_dir = Path(session.get("output_dir", "."))
            screenshots_dir = Path(session.get("screenshots_dir", "."))

            # Determine base filename
            base_filename = params.output_filename or "product-discovery"

            output_files = []

            # Generate Markdown if requested
            if params.output_format in ["markdown", "both"]:
                markdown_doc = self._generate_markdown(session, params, screenshots_dir)
                markdown_path = output_dir / f"{base_filename}.md"
                with open(markdown_path, 'w') as f:
                    f.write(markdown_doc)
                output_files.append({"format": "markdown", "path": str(markdown_path)})
                logger.info(f"📄 Markdown documentation saved to: {markdown_path}")

            # Generate HTML if requested
            if params.output_format in ["html", "both"]:
                html_doc = self._generate_html(session, params, screenshots_dir)
                html_path = output_dir / f"{base_filename}.html"
                with open(html_path, 'w') as f:
                    f.write(html_doc)
                output_files.append({"format": "html", "path": str(html_path)})
                logger.info(f"🌐 HTML documentation saved to: {html_path}")

            # Also save a summary YAML for the Planner
            summary_path = output_dir / "discovery-summary.yaml"
            summary_data = self._generate_summary_yaml(session)
            with open(summary_path, 'w') as f:
                yaml.dump(summary_data, f, default_flow_style=False, sort_keys=False)

            # Determine primary file for next steps
            primary_file = output_files[0]["path"] if output_files else str(output_dir / f"{base_filename}.md")
            html_file = next((f["path"] for f in output_files if f["format"] == "html"), None)

            return {
                "message": "Product discovery documentation generated successfully",
                "output_files": output_files,
                "summary_file": str(summary_path),
                "screenshots_count": len(session.get("screenshots", [])),
                "output_directory": str(output_dir),
                "contents": {
                    "processes_documented": len(session.get("process_results", {})),
                    "pages_documented": len(session.get("discovered_pages", [])),
                    "features_documented": len(session.get("discovered_features", [])),
                    "screenshots_included": len(session.get("screenshots", [])) if params.include_screenshots else 0
                },
                "how_to_view": {
                    "html": f"Open in browser: {html_file}" if html_file else None,
                    "markdown": "Open in VS Code and press Cmd+Shift+V (Mac) or Ctrl+Shift+V (Windows)"
                },
                "next_steps": [
                    f"View documentation: open {html_file}" if html_file else f"Review: {primary_file}",
                    "Use Planner agent with this documentation to create test plan",
                    f"Planner command: 'Create test plan using {primary_file}'"
                ]
            }

        code = [
            "# Generate product discovery documentation",
            f"# Output format: {params.output_format}",
            f"# Include screenshots: {params.include_screenshots}",
            f"# Include risk summary: {params.include_risk_summary}"
        ]

        return ToolResult(
            code=code,
            action=generate_action,
            capture_snapshot=False,
            wait_for_network=False
        )

    def _generate_markdown(
        self,
        session: Dict[str, Any],
        params: AnalyzerGenerateDocumentationParams,
        screenshots_dir: Path
    ) -> str:
        """Generate the markdown documentation."""
        lines = []

        # Header
        lines.append(f"# Product Discovery: {session['product_name']}")
        lines.append("")
        lines.append(f"**URL:** {session['url']}")
        lines.append(f"**Domain:** {session.get('domain_type', 'Unknown')}")
        lines.append(f"**Analysis Date:** {session.get('started_at', 'Unknown')}")
        lines.append("")

        # Table of Contents
        lines.append("## Table of Contents")
        lines.append("")
        lines.append("1. [Executive Summary](#executive-summary)")
        lines.append("2. [Process Flows](#process-flows)")
        lines.append("3. [Discovered Features](#discovered-features)")
        lines.append("4. [Page Inventory](#page-inventory)")
        if params.include_risk_summary and session.get("risk_profile"):
            lines.append("5. [Risk Assessment](#risk-assessment)")
        lines.append("")

        # Executive Summary
        lines.append("---")
        lines.append("")
        lines.append("## Executive Summary")
        lines.append("")

        process_results = session.get("process_results", {})
        discovered_features = session.get("discovered_features", [])
        discovered_pages = session.get("discovered_pages", [])
        advisory_gaps = session.get("advisory_gaps", [])

        lines.append(f"- **Processes Analyzed:** {len(process_results)}")
        lines.append(f"- **Pages Discovered:** {len(discovered_pages)}")
        lines.append(f"- **Features Found:** {len(discovered_features)}")
        lines.append(f"- **Advisory Gaps:** {len(advisory_gaps)}")
        lines.append("")

        # Add homepage screenshot if available
        if params.include_screenshots:
            homepage_screenshot = next(
                (s for s in session.get("screenshots", []) if s.get("name") == "homepage"),
                None
            )
            if homepage_screenshot:
                lines.append("### Homepage")
                lines.append("")
                lines.append(f"![Homepage](screenshots/{homepage_screenshot['file']})")
                lines.append("")

        # Process Flows
        lines.append("---")
        lines.append("")
        lines.append("## Process Flows")
        lines.append("")
        lines.append("The following user journeys were analyzed based on the domain template:")
        lines.append("")

        for process_name, result in process_results.items():
            lines.append(f"### {result.get('process_display_name', process_name)}")
            lines.append("")

            if result.get("description"):
                lines.append(f"*{result['description']}*")
                lines.append("")

            lines.append(f"**Risk Level:** {result.get('risk', 'medium').upper()}")
            lines.append(f"**Status:** {result.get('status', 'unknown')}")
            lines.append(f"**Steps Completed:** {result.get('steps_completed', 0)}/{result.get('steps_total', 0)}")
            lines.append("")

            # Steps table
            steps = result.get("steps", [])
            if steps:
                lines.append("| Step | Action | Status | URL |")
                lines.append("|------|--------|--------|-----|")
                for step in steps:
                    status_icon = "✅" if step.get("status") not in ["not_found", "error"] else "❌"
                    url = step.get("url", "-")
                    if url and len(url) > 40:
                        url = url[:40] + "..."
                    lines.append(f"| {step.get('step_name', '-')} | {step.get('step_action', '-')} | {status_icon} {step.get('status', '-')} | {url} |")
                lines.append("")

            # Add screenshots for this process
            if params.include_screenshots and result.get("screenshots"):
                lines.append("#### Screenshots")
                lines.append("")
                for screenshot in result["screenshots"]:
                    lines.append(f"**{screenshot['step']}**")
                    lines.append("")
                    lines.append(f"![{screenshot['step']}](screenshots/{screenshot['file']})")
                    lines.append("")

            # Gaps for this process
            process_gaps = [g for g in advisory_gaps if g.get("process") == process_name]
            if process_gaps:
                lines.append("#### Advisory Notes")
                lines.append("")
                for gap in process_gaps:
                    lines.append(f"- ⚠️ {gap.get('note', gap.get('expected_feature', 'Unknown'))}")
                lines.append("")

        # Discovered Features
        lines.append("---")
        lines.append("")
        lines.append("## Discovered Features")
        lines.append("")

        # Group features by type
        features_by_type = {}
        for feature in discovered_features:
            ftype = feature.get("type", "other")
            if ftype not in features_by_type:
                features_by_type[ftype] = []
            features_by_type[ftype].append(feature)

        for ftype, features in features_by_type.items():
            lines.append(f"### {ftype.replace('_', ' ').title()}")
            lines.append("")
            lines.append("| Feature | Page |")
            lines.append("|---------|------|")
            for feature in features:
                page_url = feature.get("page_url", "-")
                if page_url and len(page_url) > 50:
                    page_url = page_url[:50] + "..."
                lines.append(f"| {feature.get('name', 'Unknown')} | {page_url} |")
            lines.append("")

        # Page Inventory
        lines.append("---")
        lines.append("")
        lines.append("## Page Inventory")
        lines.append("")

        for page in discovered_pages:
            page_title = page.get("nav_text") or page.get("title") or "Untitled"
            lines.append(f"### {page_title}")
            lines.append("")
            lines.append(f"**URL:** {page.get('url', '-')}")
            lines.append(f"**Discovery Method:** {page.get('discovery_method', '-')}")
            lines.append("")

            if params.include_screenshots and page.get("screenshot"):
                lines.append(f"![{page_title}](screenshots/{page['screenshot']})")
                lines.append("")

            page_features = page.get("features", [])
            if page_features:
                lines.append("**Features on this page:**")
                lines.append("")
                for f in page_features[:10]:  # Limit to first 10
                    lines.append(f"- {f.get('name', 'Unknown')} ({f.get('type', 'unknown')})")
                if len(page_features) > 10:
                    lines.append(f"- ... and {len(page_features) - 10} more")
                lines.append("")

        # Risk Assessment
        if params.include_risk_summary and session.get("risk_profile"):
            lines.append("---")
            lines.append("")
            lines.append("## Risk Assessment")
            lines.append("")

            risk_profile = session["risk_profile"]
            summary = risk_profile.get("summary", {})

            lines.append(f"**Total Features Assessed:** {summary.get('total_features', 0)}")
            lines.append("")
            lines.append("| Risk Level | Count |")
            lines.append("|------------|-------|")
            lines.append(f"| 🔴 Critical | {summary.get('critical_count', 0)} |")
            lines.append(f"| 🟠 High | {summary.get('high_count', 0)} |")
            lines.append(f"| 🟡 Medium | {summary.get('medium_count', 0)} |")
            lines.append(f"| 🟢 Low | {summary.get('low_count', 0)} |")
            lines.append("")

            # Critical features
            critical_features = [f for f in risk_profile.get("features", []) if f.get("risk_level") == "critical"]
            if critical_features:
                lines.append("### Critical Features (Must Test)")
                lines.append("")
                for f in critical_features:
                    lines.append(f"- **{f.get('name', 'Unknown')}** (score: {f.get('risk_score', 0)})")
                lines.append("")

            # Gaps
            gaps = risk_profile.get("gaps", [])
            if gaps:
                lines.append("### Identified Gaps")
                lines.append("")
                for gap in gaps:
                    lines.append(f"- **{gap.get('area', 'Unknown')}** ({gap.get('severity', 'unknown')} severity)")
                    lines.append(f"  - {gap.get('recommendation', '')}")
                lines.append("")

        # Footer
        lines.append("---")
        lines.append("")
        lines.append("*This document was automatically generated by the Regression Analyzer.*")
        lines.append(f"*Use this document as input for the Planner agent to create a targeted test plan.*")
        lines.append("")

        return "\n".join(lines)

    def _generate_html(
        self,
        session: Dict[str, Any],
        params: AnalyzerGenerateDocumentationParams,
        screenshots_dir: Path
    ) -> str:
        """Generate HTML documentation with embedded styles."""

        # CSS styles for a clean, professional look
        css = """
        <style>
            * { box-sizing: border-box; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                line-height: 1.6;
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
                background: #f5f5f5;
                color: #333;
            }
            .container {
                background: white;
                padding: 40px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
            h2 { color: #34495e; margin-top: 40px; border-bottom: 2px solid #ecf0f1; padding-bottom: 8px; }
            h3 { color: #7f8c8d; }
            .meta { color: #7f8c8d; margin-bottom: 30px; }
            .meta strong { color: #2c3e50; }
            .summary-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin: 20px 0;
            }
            .summary-card {
                background: #ecf0f1;
                padding: 20px;
                border-radius: 8px;
                text-align: center;
            }
            .summary-card .number { font-size: 2em; font-weight: bold; color: #3498db; }
            .summary-card .label { color: #7f8c8d; }
            table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
            }
            th, td {
                padding: 12px;
                text-align: left;
                border-bottom: 1px solid #ecf0f1;
            }
            th { background: #34495e; color: white; }
            tr:hover { background: #f8f9fa; }
            .status-found { color: #27ae60; }
            .status-blocked { color: #e74c3c; }
            .screenshot {
                margin: 20px 0;
                text-align: center;
            }
            .screenshot img {
                max-width: 100%;
                border: 1px solid #ddd;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .screenshot-caption {
                color: #7f8c8d;
                font-style: italic;
                margin-top: 8px;
            }
            .risk-critical { background: #e74c3c; color: white; padding: 2px 8px; border-radius: 4px; }
            .risk-high { background: #e67e22; color: white; padding: 2px 8px; border-radius: 4px; }
            .risk-medium { background: #f1c40f; color: #333; padding: 2px 8px; border-radius: 4px; }
            .risk-low { background: #27ae60; color: white; padding: 2px 8px; border-radius: 4px; }
            .gap-warning {
                background: #fff3cd;
                border-left: 4px solid #ffc107;
                padding: 15px;
                margin: 10px 0;
            }
            .process-section {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
            }
            .toc {
                background: #ecf0f1;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 30px;
            }
            .toc ul { list-style: none; padding-left: 0; }
            .toc li { margin: 8px 0; }
            .toc a { color: #3498db; text-decoration: none; }
            .toc a:hover { text-decoration: underline; }
            .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #ecf0f1;
                color: #7f8c8d;
                font-size: 0.9em;
            }
        </style>
        """

        process_results = session.get("process_results", {})
        discovered_features = session.get("discovered_features", [])
        discovered_pages = session.get("discovered_pages", [])
        advisory_gaps = session.get("advisory_gaps", [])
        risk_profile = session.get("risk_profile")

        html_parts = [
            "<!DOCTYPE html>",
            "<html lang='en'>",
            "<head>",
            f"<meta charset='UTF-8'>",
            f"<meta name='viewport' content='width=device-width, initial-scale=1.0'>",
            f"<title>Product Discovery: {session['product_name']}</title>",
            css,
            "</head>",
            "<body>",
            "<div class='container'>",

            # Header
            f"<h1>Product Discovery: {session['product_name']}</h1>",
            "<div class='meta'>",
            f"<p><strong>URL:</strong> <a href='{session['url']}' target='_blank'>{session['url']}</a></p>",
            f"<p><strong>Domain:</strong> {session.get('domain_type', 'Unknown')}</p>",
            f"<p><strong>Analysis Date:</strong> {session.get('started_at', 'Unknown')}</p>",
            "</div>",

            # Table of Contents
            "<div class='toc'>",
            "<h3>Table of Contents</h3>",
            "<ul>",
            "<li><a href='#summary'>Executive Summary</a></li>",
            "<li><a href='#processes'>Process Flows</a></li>",
            "<li><a href='#features'>Discovered Features</a></li>",
            "<li><a href='#pages'>Page Inventory</a></li>",
        ]

        if params.include_risk_summary and risk_profile:
            html_parts.append("<li><a href='#risk'>Risk Assessment</a></li>")

        html_parts.extend([
            "</ul>",
            "</div>",

            # Executive Summary
            "<h2 id='summary'>Executive Summary</h2>",
            "<div class='summary-grid'>",
            f"<div class='summary-card'><div class='number'>{len(process_results)}</div><div class='label'>Processes Analyzed</div></div>",
            f"<div class='summary-card'><div class='number'>{len(discovered_pages)}</div><div class='label'>Pages Discovered</div></div>",
            f"<div class='summary-card'><div class='number'>{len(discovered_features)}</div><div class='label'>Features Found</div></div>",
            f"<div class='summary-card'><div class='number'>{len(advisory_gaps)}</div><div class='label'>Advisory Gaps</div></div>",
            "</div>",
        ])

        # Homepage screenshot
        if params.include_screenshots:
            homepage_screenshot = next(
                (s for s in session.get("screenshots", []) if s.get("name") == "homepage"),
                None
            )
            if homepage_screenshot:
                html_parts.extend([
                    "<h3>Homepage</h3>",
                    "<div class='screenshot'>",
                    f"<img src='screenshots/{homepage_screenshot['file']}' alt='Homepage'>",
                    "<div class='screenshot-caption'>Homepage Screenshot</div>",
                    "</div>",
                ])

        # Process Flows
        html_parts.append("<h2 id='processes'>Process Flows</h2>")
        html_parts.append("<p>The following user journeys were analyzed based on the domain template:</p>")

        for process_name, result in process_results.items():
            risk_class = f"risk-{result.get('risk', 'medium')}"
            status_class = "status-found" if result.get("status") == "completed" else "status-blocked"

            html_parts.extend([
                "<div class='process-section'>",
                f"<h3>{result.get('process_display_name', process_name)} <span class='{risk_class}'>{result.get('risk', 'medium').upper()}</span></h3>",
            ])

            if result.get("description"):
                html_parts.append(f"<p><em>{result['description']}</em></p>")

            html_parts.extend([
                f"<p><strong>Status:</strong> <span class='{status_class}'>{result.get('status', 'unknown')}</span></p>",
                f"<p><strong>Steps Completed:</strong> {result.get('steps_completed', 0)}/{result.get('steps_total', 0)}</p>",
            ])

            # Steps table
            steps = result.get("steps", [])
            if steps:
                html_parts.extend([
                    "<table>",
                    "<tr><th>Step</th><th>Action</th><th>Status</th><th>URL</th></tr>",
                ])
                for step in steps:
                    status_icon = "✅" if step.get("status") not in ["not_found", "error"] else "❌"
                    url = step.get("url", "-")
                    if url and len(url) > 50:
                        url = url[:50] + "..."
                    html_parts.append(
                        f"<tr><td>{step.get('step_name', '-')}</td>"
                        f"<td>{step.get('step_action', '-')}</td>"
                        f"<td>{status_icon} {step.get('status', '-')}</td>"
                        f"<td>{url}</td></tr>"
                    )
                html_parts.append("</table>")

            # Screenshots for this process
            if params.include_screenshots and result.get("screenshots"):
                html_parts.append("<h4>Screenshots</h4>")
                for screenshot in result["screenshots"]:
                    html_parts.extend([
                        "<div class='screenshot'>",
                        f"<img src='screenshots/{screenshot['file']}' alt='{screenshot['step']}'>",
                        f"<div class='screenshot-caption'>{screenshot['step']}</div>",
                        "</div>",
                    ])

            # Gaps for this process
            process_gaps = [g for g in advisory_gaps if g.get("process") == process_name]
            if process_gaps:
                html_parts.append("<h4>Advisory Notes</h4>")
                for gap in process_gaps:
                    html_parts.append(f"<div class='gap-warning'>⚠️ {gap.get('note', gap.get('expected_feature', 'Unknown'))}</div>")

            html_parts.append("</div>")  # Close process-section

        # Discovered Features
        html_parts.append("<h2 id='features'>Discovered Features</h2>")

        # Group by type
        features_by_type = {}
        for feature in discovered_features:
            ftype = feature.get("type", "other")
            if ftype not in features_by_type:
                features_by_type[ftype] = []
            features_by_type[ftype].append(feature)

        for ftype, features in features_by_type.items():
            html_parts.extend([
                f"<h3>{ftype.replace('_', ' ').title()}</h3>",
                "<table>",
                "<tr><th>Feature</th><th>Page</th></tr>",
            ])
            for feature in features:
                page_url = feature.get("page_url", "-")
                if page_url and len(page_url) > 60:
                    page_url = page_url[:60] + "..."
                html_parts.append(f"<tr><td>{feature.get('name', 'Unknown')}</td><td>{page_url}</td></tr>")
            html_parts.append("</table>")

        # Page Inventory
        html_parts.append("<h2 id='pages'>Page Inventory</h2>")

        for page in discovered_pages:
            page_title = page.get("nav_text") or page.get("title") or "Untitled"
            html_parts.extend([
                f"<h3>{page_title}</h3>",
                f"<p><strong>URL:</strong> {page.get('url', '-')}</p>",
                f"<p><strong>Discovery Method:</strong> {page.get('discovery_method', '-')}</p>",
            ])

            if params.include_screenshots and page.get("screenshot"):
                html_parts.extend([
                    "<div class='screenshot'>",
                    f"<img src='screenshots/{page['screenshot']}' alt='{page_title}'>",
                    "</div>",
                ])

            page_features = page.get("features", [])
            if page_features:
                html_parts.append("<p><strong>Features on this page:</strong></p><ul>")
                for f in page_features[:10]:
                    html_parts.append(f"<li>{f.get('name', 'Unknown')} ({f.get('type', 'unknown')})</li>")
                if len(page_features) > 10:
                    html_parts.append(f"<li>... and {len(page_features) - 10} more</li>")
                html_parts.append("</ul>")

        # Risk Assessment
        if params.include_risk_summary and risk_profile:
            html_parts.append("<h2 id='risk'>Risk Assessment</h2>")
            summary = risk_profile.get("summary", {})

            html_parts.extend([
                f"<p><strong>Total Features Assessed:</strong> {summary.get('total_features', 0)}</p>",
                "<table>",
                "<tr><th>Risk Level</th><th>Count</th></tr>",
                f"<tr><td><span class='risk-critical'>Critical</span></td><td>{summary.get('critical_count', 0)}</td></tr>",
                f"<tr><td><span class='risk-high'>High</span></td><td>{summary.get('high_count', 0)}</td></tr>",
                f"<tr><td><span class='risk-medium'>Medium</span></td><td>{summary.get('medium_count', 0)}</td></tr>",
                f"<tr><td><span class='risk-low'>Low</span></td><td>{summary.get('low_count', 0)}</td></tr>",
                "</table>",
            ])

            # Critical features
            critical_features = [f for f in risk_profile.get("features", []) if f.get("risk_level") == "critical"]
            if critical_features:
                html_parts.extend([
                    "<h3>Critical Features (Must Test)</h3>",
                    "<ul>",
                ])
                for f in critical_features:
                    html_parts.append(f"<li><strong>{f.get('name', 'Unknown')}</strong> (score: {f.get('risk_score', 0)})</li>")
                html_parts.append("</ul>")

            # Gaps
            gaps = risk_profile.get("gaps", [])
            if gaps:
                html_parts.append("<h3>Identified Gaps</h3>")
                for gap in gaps:
                    html_parts.append(f"<div class='gap-warning'><strong>{gap.get('area', 'Unknown')}</strong> ({gap.get('severity', 'unknown')} severity)<br>{gap.get('recommendation', '')}</div>")

        # Footer
        html_parts.extend([
            "<div class='footer'>",
            "<p><em>This document was automatically generated by the Regression Analyzer.</em></p>",
            "<p><em>Use this document as input for the Planner agent to create a targeted test plan.</em></p>",
            "</div>",
            "</div>",  # Close container
            "</body>",
            "</html>",
        ])

        return "\n".join(html_parts)

    def _generate_summary_yaml(self, session: Dict[str, Any]) -> Dict[str, Any]:
        """Generate a YAML summary for the Planner agent."""
        return {
            "product": {
                "name": session["product_name"],
                "url": session["url"],
                "domain": session.get("domain_type", "unknown"),
                "analyzed_date": session.get("started_at")
            },
            "discovery_summary": {
                "processes_analyzed": list(session.get("process_results", {}).keys()),
                "pages_discovered": len(session.get("discovered_pages", [])),
                "features_found": len(session.get("discovered_features", [])),
                "screenshots_captured": len(session.get("screenshots", []))
            },
            "process_status": {
                name: {
                    "status": result.get("status"),
                    "steps_completed": result.get("steps_completed", 0),
                    "steps_total": result.get("steps_total", 0),
                    "blocked_at": result.get("blocked_at")
                }
                for name, result in session.get("process_results", {}).items()
            },
            "advisory_gaps": session.get("advisory_gaps", []),
            "risk_profile_available": session.get("risk_profile") is not None,
            "documentation_path": str(Path(session.get("output_dir", ".")) / "product-discovery.md"),
            "screenshots_path": session.get("screenshots_dir")
        }
