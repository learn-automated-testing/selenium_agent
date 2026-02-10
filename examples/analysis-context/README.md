# Analysis Context Examples

The Selenium MCP Server's analyzer is **generic** — it has no built-in knowledge
about your application. You provide context by importing documents (PRD, user stories,
test scope) that guide the analysis.

## Quick Start

```
# 1. Start analysis session — just URL and name
analyzer_setup({
  url: "https://your-app.example.com",
  productName: "My App"
})

# 2. Import your requirements (pick one or combine several)
analyzer_import_context({
  sourceType: "file",
  source: "./docs/prd.md",
  contextType: "prd"
})

# 3. Scan the product
analyzer_scan_product({ scanDepth: "standard", maxPages: 20 })

# 4. Generate risk profile
analyzer_build_risk_profile({ includeRecommendations: true })
```

## How Context Works

```
┌──────────────────────────────────────────────────┐
│               YOUR PROJECT                        │
│                                                   │
│  docs/prd.md          ──┐                         │
│  docs/user-stories.md ──┼── import_context ──┐    │
│  "inline instructions"──┘                    │    │
│                                              ▼    │
│                                     ┌─────────┐   │
│                                     │ Analyzer │   │
│  https://your-app.com ─────────────▶│ Session  │   │
│                                     └────┬────┘   │
│                                          │        │
│               ┌──────────────────────────┘        │
│               ▼                                   │
│  output/risk-profiles/    ◀── configurable        │
│  output/product-discovery/ ◀── via env var        │
│  output/test-plans/        ◀── or parameter       │
└──────────────────────────────────────────────────┘
```

The analyzer combines:
- **Your context** (PRD, stories, scope) — tells it what matters
- **Live scanning** (browser automation) — discovers what's actually there
- **Grid parallel exploration** (optional) — scans faster with multiple browsers

## Providing Context

### Option A: PRD Document

Best for comprehensive analysis. Import your product requirements:

```
analyzer_import_context({
  sourceType: "file",
  source: "./docs/prd.md",
  contextType: "prd",
  description: "Product requirements v2.0"
})
```

See [`prd-example.md`](./prd-example.md) for a full example. A good PRD includes:
- **Core processes** with steps and acceptance criteria
- **User roles** and their workflows
- **Required fields** and validation rules
- **Status flows** (e.g., draft → sent → paid)
- **Non-functional requirements** (auth, responsive, etc.)

### Option B: User Stories

Best for targeted testing. Import specific stories:

```
analyzer_import_context({
  sourceType: "file",
  source: "./docs/user-stories.md",
  contextType: "prd",
  description: "Sprint 12 user stories"
})
```

See [`user-stories-example.md`](./user-stories-example.md) for a full example.
Include acceptance criteria and test data tables for best results.

### Option C: Inline Scope Instructions

Best for quick, focused analysis. Pass instructions as text:

```
analyzer_import_context({
  sourceType: "text",
  contextType: "test_plan",
  source: "Focus on the checkout flow and invoice PDF generation. Skip customer management. Run E2E from package intake through to paid invoice."
})
```

### Option D: Combine Multiple Sources

Import several documents for richer context:

```
# Import PRD for overall scope
analyzer_import_context({
  sourceType: "file",
  source: "./docs/prd.md",
  contextType: "prd"
})

# Import API spec for backend validation
analyzer_import_context({
  sourceType: "file",
  source: "./docs/openapi.yaml",
  contextType: "api_spec"
})

# Add specific test scope
analyzer_import_context({
  sourceType: "text",
  contextType: "test_plan",
  source: "Critical paths only. Must test PDF export for manifests and invoices."
})
```

## Context Types

| Type | Use For | Guides |
|------|---------|--------|
| `prd` | Product requirements, feature specs, user stories | What processes to walk, what to verify |
| `architecture` | System design, tech stack, component diagram | Where to look, integration points |
| `api_spec` | OpenAPI/Swagger, GraphQL schema | API endpoints to validate |
| `test_plan` | Scope instructions, existing test plans | What to include/exclude, depth |
| `general` | Anything else (notes, meeting minutes, etc.) | Additional context |

## Using with Selenium Grid (Parallel)

When grid is available, the analyzer can scan faster:

```
# Setup with grid
export SELENIUM_GRID_URL=http://localhost:4444

# Scan uses grid automatically for parallel page discovery
analyzer_scan_product({
  scanDepth: "deep",
  maxPages: 30
})
```

See [`../selenium-grid/`](../selenium-grid/) for Docker setup.

## Configuring Output Location

By default, output goes to the current working directory. Override with:

```bash
# Via environment variable
export SELENIUM_MCP_OUTPUT_DIR=/path/to/your/project/test-output

# Output structure:
# /path/to/your/project/test-output/
#   product-discovery/<product-name>/
#   risk-profiles/
#   test-plans/
#   tests/
```

## Example Files

| File | What It Shows |
|------|---------------|
| [`prd-example.md`](./prd-example.md) | Full PRD with processes, acceptance criteria, roles |
| [`user-stories-example.md`](./user-stories-example.md) | User stories with test data tables |
| [`smoke-test-only.yaml`](./smoke-test-only.yaml) | Quick smoke test scope (pages load, elements exist) |
| [`regression-pr-check.yaml`](./regression-pr-check.yaml) | CI/CD scope (critical paths only, parallel grid) |
| [`domain_templates/`](./domain_templates/) | Legacy: domain knowledge template (for reference) |
| [`product-discovery/`](./product-discovery/) | Example output from a completed analysis |
