# Electron App Implementation Plan

## Goal
Add risk distillation, review, and documentation generation to the Electron app (Clone Your Tester) using relevant pieces from the TypeScript selenium-mcp-server.

---

## Current State

### Electron App (Clone Your Tester) - ALREADY HAS:
**Location:** `/Users/r.vanderhorst/Documents/develop/AI-tester/electron-app/`

| Feature | File | Status |
|---------|------|--------|
| Story extraction | `src/mcp-server/index.ts` | ✅ Has |
| Story review (approve/reject) | `src/renderer/App.tsx` | ✅ Has |
| Process flow editor | `src/renderer/App.tsx` | ✅ Has |
| Test strategy mapping (TMAP) | `src/mcp-server/index.ts` | ✅ Has |
| Export to markdown/JSON | `src/mcp-server/index.ts` | ✅ Has |
| Playwright PRD generation | `src/mcp-server/index.ts` | ✅ Has |
| Requirements MCP server | `src/mcp-server/index.ts` | ✅ Has |

### TypeScript selenium-mcp-server - REFERENCE CODE:
**Location:** `/Users/r.vanderhorst/Documents/develop/learnportal/selenium_agent/selenium-mcp-server/`

| Feature | File | Use For Electron? |
|---------|------|-------------------|
| Risk profiling | `src/tools/analyzer/build-risk-profile.ts` | ✅ YES - Extract risk logic |
| Domain templates | `domain_templates/e-commerce.yaml` | ✅ YES - Import templates |
| Documentation generation | `src/tools/analyzer/generate-documentation.ts` | ⚠️ PARTIAL - Some patterns |
| Browser automation | `src/context.ts` | ❌ NO - Uses Selenium |
| Exploratory scanning | `src/tools/analyzer/scan-product.ts` | ❌ NO - Redundant with Planner |

---

## Phase 1: Risk Distillation

### Goal
Add risk levels to stories based on process flow position, feature type, and business impact.

### Types to Add

```typescript
// Add to src/shared/types.ts or create src/shared/risk-types.ts

interface RiskFactors {
  revenueImpact: number;    // 0-1: How much does failure impact revenue?
  userImpact: number;       // 0-1: How many users affected?
  frequency: number;        // 0-1: How often is this used?
  complexity: number;       // 0-1: How complex is the implementation?
  complianceScore: number;  // 0-1: Compliance requirements (GDPR, PCI-DSS)
}

interface FeatureAssessment {
  name: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  riskScore: number;        // 0-1 calculated score
  skipRecommendation: boolean;
  factors: RiskFactors;
}

interface CoverageRecommendation {
  feature: string;
  coverage: 'comprehensive' | 'thorough' | 'standard' | 'basic' | 'minimal';
  reason: string;
}

interface RiskGap {
  expected: string;
  status: 'not_found' | 'not_verified';
  recommendation: string;
}

type RiskAppetite = 'startup-mvp' | 'standard' | 'regulated';
```

### Risk Scoring Logic (Extract from build-risk-profile.ts)

```typescript
// Create: src/shared/risk-assessment.ts

const HIGH_RISK_PATTERNS = [
  'payment', 'checkout', 'login', 'auth', 'password',
  'account', 'transaction', 'card', 'billing'
];

export function assessFeatureRisk(
  featureName: string,
  options: {
    domainTemplate?: DomainTemplate;
    criticalFlows?: string[];
    compliance?: string[];
    riskAppetite?: RiskAppetite;
  }
): FeatureAssessment {
  const featureNameLower = featureName.toLowerCase();
  const { domainTemplate, criticalFlows = [], compliance = [], riskAppetite = 'standard' } = options;

  // Default scores
  let revenueImpact = 0.3;
  let userImpact = 0.3;
  let frequency = 0.5;
  let complexity = 0.3;
  let complianceScore = 0.0;

  // Check domain template for predefined risk levels
  if (domainTemplate) {
    const templateFeatures = domainTemplate.features || {};
    for (const [tplName, tplInfo] of Object.entries(templateFeatures)) {
      if (matchesFeature(featureNameLower, tplName)) {
        const riskLevel = tplInfo.risk || 'medium';

        if (riskLevel === 'critical') {
          revenueImpact = 0.9;
          userImpact = 0.9;
        } else if (riskLevel === 'high') {
          revenueImpact = 0.7;
          userImpact = 0.7;
        } else if (riskLevel === 'medium') {
          revenueImpact = 0.4;
          userImpact = 0.5;
        } else {
          revenueImpact = 0.2;
          userImpact = 0.2;
        }

        // Check compliance requirements
        if (tplInfo.compliance?.some(c => compliance.includes(c))) {
          complianceScore = 0.8;
        }
        break;
      }
    }
  }

  // Boost if in critical flows
  if (criticalFlows.some(flow => featureNameLower.includes(flow.toLowerCase()))) {
    revenueImpact = Math.max(revenueImpact, 0.8);
    userImpact = Math.max(userImpact, 0.8);
  }

  // Detect high-risk patterns in feature name
  if (HIGH_RISK_PATTERNS.some(p => featureNameLower.includes(p))) {
    revenueImpact = Math.max(revenueImpact, 0.7);
    userImpact = Math.max(userImpact, 0.7);
  }

  // Calculate final score (weighted average)
  const riskScore =
    revenueImpact * 0.30 +
    userImpact * 0.25 +
    frequency * 0.15 +
    complexity * 0.15 +
    complianceScore * 0.15;

  // Classify risk level
  let riskLevel: 'critical' | 'high' | 'medium' | 'low';
  if (riskScore >= 0.8) {
    riskLevel = 'critical';
  } else if (riskScore >= 0.6) {
    riskLevel = 'high';
  } else if (riskScore >= 0.4) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  // Adjust for risk appetite
  if (riskAppetite === 'startup-mvp' && riskLevel === 'medium') {
    riskLevel = 'low';
  } else if (riskAppetite === 'regulated' && riskLevel === 'medium') {
    riskLevel = 'high';
  }

  // Determine if can skip testing
  const skipRecommendation = riskAppetite === 'startup-mvp' && riskLevel === 'low';

  return {
    name: featureName,
    riskLevel,
    riskScore,
    skipRecommendation,
    factors: {
      revenueImpact,
      userImpact,
      frequency,
      complexity,
      complianceScore
    }
  };
}

function matchesFeature(name1: string, name2: string): boolean {
  return name1.includes(name2.toLowerCase()) || name2.toLowerCase().includes(name1);
}
```

### Coverage Recommendations Logic

```typescript
// Add to src/shared/risk-assessment.ts

export function buildCoverageRecommendation(
  assessment: FeatureAssessment,
  riskAppetite: RiskAppetite
): CoverageRecommendation {
  let coverage: CoverageRecommendation['coverage'];
  let reason: string;

  if (assessment.riskLevel === 'critical') {
    coverage = 'comprehensive';
    reason = 'Critical feature requires full test coverage including edge cases and error scenarios';
  } else if (assessment.riskLevel === 'high') {
    coverage = 'thorough';
    reason = 'High-risk feature needs thorough testing of main flows and error handling';
  } else if (assessment.riskLevel === 'medium') {
    if (riskAppetite === 'regulated') {
      coverage = 'thorough';
      reason = 'Regulated environment requires thorough testing even for medium-risk features';
    } else {
      coverage = 'standard';
      reason = 'Standard test coverage for happy path and common error cases';
    }
  } else {
    if (riskAppetite === 'startup-mvp') {
      coverage = 'minimal';
      reason = 'Low priority in MVP context - smoke test only';
    } else {
      coverage = 'basic';
      reason = 'Basic coverage for happy path';
    }
  }

  return {
    feature: assessment.name,
    coverage,
    reason
  };
}
```

### MCP Tool to Add

```typescript
// Add to src/mcp-server/index.ts - in the tools array

{
  name: "assess_story_risks",
  description: "Assess risk levels for stories based on feature names and process flow position",
  inputSchema: {
    type: "object",
    properties: {
      stories: {
        type: "array",
        description: "Stories to assess",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            content: { type: "object" }
          }
        }
      },
      processFlow: {
        type: "object",
        description: "Process flow for context"
      },
      domainType: {
        type: "string",
        enum: ["e-commerce", "saas", "fintech", "healthcare"],
        description: "Domain type for template lookup"
      },
      riskAppetite: {
        type: "string",
        enum: ["startup-mvp", "standard", "regulated"],
        description: "Risk appetite level"
      },
      criticalFlows: {
        type: "array",
        items: { type: "string" },
        description: "Names of critical flows (e.g., 'checkout', 'payment')"
      },
      compliance: {
        type: "array",
        items: { type: "string" },
        description: "Compliance requirements (e.g., 'GDPR', 'PCI-DSS')"
      }
    },
    required: ["stories"]
  }
}

// Handler implementation
case "assess_story_risks": {
  const stories = args?.stories as any[];
  const processFlow = args?.processFlow as any;
  const domainType = (args?.domainType as string) || 'e-commerce';
  const riskAppetite = (args?.riskAppetite as RiskAppetite) || 'standard';
  const criticalFlows = (args?.criticalFlows as string[]) || [];
  const compliance = (args?.compliance as string[]) || [];

  // Load domain template
  const domainTemplate = loadDomainTemplate(domainType);

  // Assess each story
  const assessments: FeatureAssessment[] = [];

  for (const story of stories) {
    const featureName = story.content?.description || story.id;
    const assessment = assessFeatureRisk(featureName, {
      domainTemplate,
      criticalFlows,
      compliance,
      riskAppetite
    });
    assessments.push(assessment);
  }

  // Sort by risk score
  assessments.sort((a, b) => b.riskScore - a.riskScore);

  // Build coverage recommendations
  const recommendations = assessments.map(a =>
    buildCoverageRecommendation(a, riskAppetite)
  );

  // Summary
  const summary = {
    total: assessments.length,
    critical: assessments.filter(a => a.riskLevel === 'critical').length,
    high: assessments.filter(a => a.riskLevel === 'high').length,
    medium: assessments.filter(a => a.riskLevel === 'medium').length,
    low: assessments.filter(a => a.riskLevel === 'low').length,
    canSkip: assessments.filter(a => a.skipRecommendation).length
  };

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        summary,
        assessments,
        recommendations
      }, null, 2)
    }]
  };
}
```

---

## Phase 2: Domain Templates

### E-Commerce Template Structure

Copy this to: `electron-app/src/domain-templates/e-commerce.yaml`

```yaml
# E-Commerce Domain Template
domain:
  name: "e-commerce"
  description: "Online retail, shopping platforms, marketplaces"
  version: "2.0"

  detection:
    url_patterns: ["shop", "store", "cart", "checkout", "product"]
    page_indicators: ["add to cart", "buy now", "shopping cart", "price"]

# Standard processes for e-commerce
processes:
  purchase_product:
    name: "Purchase Product"
    risk: critical
    description: "The complete journey from browsing to order confirmation"
    steps:
      - id: browse
        name: "Browse Products"
        risk: medium
        features: [product_listing, product_search, product_filtering, product_sorting]

      - id: select
        name: "Select Product"
        risk: medium
        features: [product_detail, product_variants, product_images, product_reviews]

      - id: add_to_cart
        name: "Add to Cart"
        risk: critical
        features: [add_to_cart_button, quantity_selection, cart_feedback]

      - id: view_cart
        name: "View Cart"
        risk: critical
        features: [cart_display, cart_item_list, cart_quantity_update, cart_totals]

      - id: checkout
        name: "Proceed to Checkout"
        risk: critical
        features: [checkout_button, checkout_page]

      - id: shipping
        name: "Enter Shipping Information"
        risk: critical
        compliance: [GDPR]
        features: [shipping_address_form, shipping_method_selection, address_validation]

      - id: payment
        name: "Enter Payment Information"
        risk: critical
        compliance: [PCI-DSS]
        features: [payment_form, payment_methods, billing_address]

      - id: confirmation
        name: "Order Confirmation"
        risk: critical
        features: [order_confirmation_page, order_number, order_summary]

  user_login:
    name: "User Login"
    risk: high
    steps:
      - id: find_login
        name: "Find Login"
        features: [login_link]
      - id: enter_credentials
        name: "Enter Credentials"
        features: [login_form, remember_me, forgot_password_link]
      - id: authenticated
        name: "Authenticated State"
        features: [logged_in_state, user_menu]

  user_registration:
    name: "User Registration"
    risk: high
    compliance: [GDPR]
    steps:
      - id: fill_form
        name: "Fill Registration Form"
        features: [registration_form, email_input, password_input, terms_checkbox]
      - id: verify_email
        name: "Email Verification"
        features: [email_verification, resend_verification]

  product_search:
    name: "Product Search"
    risk: high
    steps:
      - id: enter_query
        name: "Enter Search Query"
        features: [search_input, search_autocomplete]
      - id: view_results
        name: "View Search Results"
        features: [search_results, result_count, search_filters]

# Feature risk definitions
features:
  payment_form:
    risk: critical
    compliance: [PCI-DSS]

  checkout_button:
    risk: critical

  add_to_cart_button:
    risk: critical

  login_form:
    risk: high

  registration_form:
    risk: high
    compliance: [GDPR]

  product_filtering:
    risk: medium

  search_input:
    risk: medium

# Compliance mappings
compliance:
  PCI-DSS:
    applies_to: [payment_form, saved_cards, billing_address]

  GDPR:
    applies_to: [registration_form, shipping_address_form, edit_profile]

# Keyword mappings for auto-linking stories to process steps
keyword_mappings:
  cart: ["purchase_product.add_to_cart", "purchase_product.view_cart"]
  checkout: ["purchase_product.checkout", "purchase_product.payment"]
  login: ["user_login"]
  register: ["user_registration"]
  search: ["product_search"]
  filter: ["purchase_product.browse"]
  payment: ["purchase_product.payment"]
```

### Template Loader

```typescript
// Create: src/shared/domain-templates.ts

import * as yaml from 'yaml';
import * as fs from 'fs';
import * as path from 'path';

export interface DomainTemplate {
  domain: {
    name: string;
    description: string;
    version: string;
    detection: {
      url_patterns: string[];
      page_indicators: string[];
    };
  };
  processes: Record<string, ProcessDefinition>;
  features: Record<string, FeatureDefinition>;
  compliance: Record<string, { applies_to: string[] }>;
  keyword_mappings: Record<string, string[]>;
}

export interface ProcessDefinition {
  name: string;
  risk: 'critical' | 'high' | 'medium' | 'low';
  description?: string;
  compliance?: string[];
  steps: ProcessStep[];
}

export interface ProcessStep {
  id: string;
  name: string;
  risk?: 'critical' | 'high' | 'medium' | 'low';
  features: string[];
  compliance?: string[];
}

export interface FeatureDefinition {
  risk?: 'critical' | 'high' | 'medium' | 'low';
  compliance?: string[];
}

const TEMPLATES_DIR = path.join(__dirname, '../domain-templates');

export function loadDomainTemplate(domain: string): DomainTemplate | null {
  try {
    const templatePath = path.join(TEMPLATES_DIR, `${domain}.yaml`);
    const content = fs.readFileSync(templatePath, 'utf-8');
    return yaml.parse(content) as DomainTemplate;
  } catch (error) {
    console.warn(`Could not load domain template: ${domain}`, error);
    return null;
  }
}

export function detectDomainFromUrl(url: string): string | null {
  const urlLower = url.toLowerCase();

  // Simple detection based on URL patterns
  if (['shop', 'store', 'cart', 'product'].some(p => urlLower.includes(p))) {
    return 'e-commerce';
  }

  return null;
}

export function autoLinkStoryToStep(
  storyDescription: string,
  template: DomainTemplate
): { process: string; step: string } | null {
  const descLower = storyDescription.toLowerCase();

  for (const [keyword, mappings] of Object.entries(template.keyword_mappings)) {
    if (descLower.includes(keyword)) {
      const [process, step] = mappings[0].split('.');
      return { process, step };
    }
  }

  return null;
}
```

---

## Phase 3: Reconciliation Mode

### Comparison Types

```typescript
// Create: src/shared/reconciliation-types.ts

export interface TestCase {
  id: string;
  name: string;
  file: string;
  assertions: string[];
  keywords: string[];  // Extracted from test name/body
}

export interface ComparisonResult {
  matched: MatchedItem[];
  unmatchedStories: string[];   // Stories without tests
  unmatchedTests: string[];     // Tests without stories
}

export interface MatchedItem {
  storyId: string;
  testId: string;
  confidence: number;  // 0-1 match confidence
  matchedKeywords: string[];
}

export interface ReconciliationDecision {
  itemId: string;
  action: 'update_requirement' | 'update_test' | 'ignore' | 'create_test' | 'create_requirement';
  notes?: string;
}
```

### Test Case Parser (for Playwright/Jest)

```typescript
// Create: src/shared/test-parser.ts

import * as fs from 'fs';

export function parseTestFile(filePath: string): TestCase[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const tests: TestCase[] = [];

  // Playwright/Jest pattern: test('name', ...) or it('name', ...)
  const testPattern = /(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]/g;

  let match;
  while ((match = testPattern.exec(content)) !== null) {
    const testName = match[1];
    tests.push({
      id: `${filePath}:${testName}`,
      name: testName,
      file: filePath,
      assertions: extractAssertions(content, match.index),
      keywords: extractKeywords(testName)
    });
  }

  return tests;
}

function extractKeywords(testName: string): string[] {
  // Extract meaningful words from test name
  return testName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.includes(word));
}

function extractAssertions(content: string, startIndex: number): string[] {
  // Find expect() calls after the test definition
  const assertions: string[] = [];
  const expectPattern = /expect\([^)]+\)\.([a-zA-Z]+)/g;

  // Simple extraction - in real impl, would need to find test boundaries
  let match;
  while ((match = expectPattern.exec(content.slice(startIndex, startIndex + 2000))) !== null) {
    assertions.push(match[1]);
  }

  return assertions;
}

const STOP_WORDS = ['the', 'and', 'for', 'should', 'when', 'then', 'given', 'that', 'with'];
```

### Comparison Logic

```typescript
// Create: src/shared/reconciliation.ts

export function compareStoriesAndTests(
  stories: ReviewItem[],
  tests: TestCase[]
): ComparisonResult {
  const matched: MatchedItem[] = [];
  const matchedStoryIds = new Set<string>();
  const matchedTestIds = new Set<string>();

  // Try to match each story to tests
  for (const story of stories) {
    const storyKeywords = extractKeywords(story.content?.description || '');

    for (const test of tests) {
      const commonKeywords = storyKeywords.filter(k =>
        test.keywords.includes(k) || test.name.toLowerCase().includes(k)
      );

      if (commonKeywords.length >= 2) {  // Threshold for match
        const confidence = commonKeywords.length / Math.max(storyKeywords.length, 1);

        matched.push({
          storyId: story.id,
          testId: test.id,
          confidence,
          matchedKeywords: commonKeywords
        });

        matchedStoryIds.add(story.id);
        matchedTestIds.add(test.id);
      }
    }
  }

  // Find unmatched
  const unmatchedStories = stories
    .filter(s => !matchedStoryIds.has(s.id))
    .map(s => s.id);

  const unmatchedTests = tests
    .filter(t => !matchedTestIds.has(t.id))
    .map(t => t.id);

  return { matched, unmatchedStories, unmatchedTests };
}

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
}
```

### MCP Tools for Reconciliation

```typescript
// Add to src/mcp-server/index.ts

// Tool: import_test_cases
{
  name: "import_test_cases",
  description: "Import and parse test files to extract test cases",
  inputSchema: {
    type: "object",
    properties: {
      testDirectory: {
        type: "string",
        description: "Directory containing test files"
      },
      pattern: {
        type: "string",
        description: "Glob pattern for test files (default: **/*.spec.ts)"
      }
    },
    required: ["testDirectory"]
  }
}

// Tool: compare_coverage
{
  name: "compare_coverage",
  description: "Compare stories with test cases to find gaps",
  inputSchema: {
    type: "object",
    properties: {
      stories: {
        type: "array",
        description: "Stories to compare"
      },
      tests: {
        type: "array",
        description: "Test cases to compare"
      }
    },
    required: ["stories", "tests"]
  }
}
```

---

## File Reference Map

| What you need | Source File | Lines |
|---------------|-------------|-------|
| Risk scoring formula | `selenium-mcp-server/src/tools/analyzer/build-risk-profile.ts` | 174-180 |
| Risk level classification | Same file | 183-192 |
| Risk appetite adjustment | Same file | 194-199 |
| Coverage recommendations | Same file | 219-261 |
| Pipeline config generation | Same file | 263-310 |
| Gap identification | Same file | 312-358 |
| E-commerce processes | `domain_templates/e-commerce.yaml` | 30-206 |
| Feature definitions | Same file | 509-552 |
| Compliance requirements | Same file | 590-611 |
| Keyword mappings | Same file | 577-586 |

---

## What NOT to Copy

| Feature | Why Skip |
|---------|----------|
| Browser automation (`context.ts`) | Uses Selenium, you want Playwright |
| `scan-product.ts` | Duplicates Planner exploration |
| Full analyzer session setup | Electron app has its own session management |
| Screenshot capture utilities | Different approach in Electron |

---

## Implementation Checklist

### Week 1: Risk Distillation
- [ ] Create `src/shared/risk-types.ts` with type definitions
- [ ] Create `src/shared/risk-assessment.ts` with scoring logic
- [ ] Add `assess_story_risks` MCP tool to `src/mcp-server/index.ts`
- [ ] Update Review screen UI to show risk badges
- [ ] Update exports to include risk levels

### Week 2: Domain Templates
- [ ] Create `src/domain-templates/` directory
- [ ] Copy `e-commerce.yaml` template
- [ ] Create `src/shared/domain-templates.ts` loader
- [ ] Add template selection to UI (or auto-detect)
- [ ] Auto-link stories to process steps using keywords
- [ ] Show step risk levels in Process Flow screen

### Week 3: Reconciliation Mode
- [ ] Create `src/shared/reconciliation-types.ts`
- [ ] Create `src/shared/test-parser.ts`
- [ ] Create `src/shared/reconciliation.ts`
- [ ] Add `import_test_cases` MCP tool
- [ ] Add `compare_coverage` MCP tool
- [ ] Create Reconciliation screen in `src/renderer/`

### Week 4: Polish
- [ ] Add risk level filters to Review screen
- [ ] Add risk summary to Results screen
- [ ] Update Playwright PRD to include risk levels
- [ ] Test with real e-commerce site
- [ ] Documentation

---

## Quick Commands

```bash
# View the risk scoring logic
cat /Users/r.vanderhorst/Documents/develop/learnportal/selenium_agent/selenium-mcp-server/src/tools/analyzer/build-risk-profile.ts

# View the e-commerce template
cat /Users/r.vanderhorst/Documents/develop/learnportal/selenium_agent/domain_templates/e-commerce.yaml

# Start working on Electron app
cd /Users/r.vanderhorst/Documents/develop/AI-tester/electron-app
code .
```
