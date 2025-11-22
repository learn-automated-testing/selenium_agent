# Test Plan: Practice Automated Testing Website

## Test Plan Information
**Feature:** E-commerce and Web Elements Testing
**Website URL:** https://practiceautomatedtesting.com
**Test Environment:** Chrome Browser (automated via Selenium)
**Exploration Depth:** Full Site
**Generated:** 2025-11-22

---

## 1. Executive Summary

This comprehensive test plan covers the Practice Automated Testing website, which provides two main testing areas:
1. **Shopping Section** - E-commerce functionality with product catalog, filtering, sorting, and cart management
2. **Web Elements Section** - Interactive UI components for testing various web element interactions

The plan includes functional testing, UI validation, and end-to-end workflow testing across both sections.

---

## 2. Test Objectives

- Verify all shopping features work correctly (search, filter, sort, add to cart)
- Validate web element interactions (forms, checkboxes, radio buttons, tables, links, etc.)
- Ensure proper navigation and page transitions
- Test data validation and form submissions
- Verify responsive behavior and UI consistency
- Test multi-step workflows (shopping cart checkout, form submissions)

---

## 3. Scope

### In Scope:
- Shopping section functionality
- Web Elements interactive components
- Navigation between sections
- Form validations
- Product filtering and sorting
- Shopping cart operations

### Out of Scope:
- API testing (separate section available but not covered in this plan)
- AI Tools section (separate section)
- Backend database validation
- Performance and load testing
- Security testing

---

## 4. Test Environment

**Browser:** Chrome (latest version)
**Automation Tool:** Selenium WebDriver
**Test Framework:** Pytest (Python)
**URL:** https://practiceautomatedtesting.com
**Screen Resolutions:** 1920x1080 (desktop)

---

## 5. Test Cases - Shopping Section

### 5.1 Product Catalog Tests

#### TC-SHOP-001: Verify Product Display
**Priority:** High
**Precondition:** Navigate to shopping page
**Steps:**
1. Navigate to https://practiceautomatedtesting.com/shopping
2. Verify products are displayed
3. Verify each product shows name, price, rating, and "Add to Cart" button
**Expected Result:** All products display correctly with complete information

#### TC-SHOP-002: Add Single Product to Cart
**Priority:** High
**Precondition:** Shopping page loaded
**Steps:**
1. Click "Add to Cart" on first product
2. Verify cart counter updates
3. Verify cart total updates
**Expected Result:** Product added successfully, cart shows 1 item with correct price

#### TC-SHOP-003: Add Multiple Products to Cart
**Priority:** High
**Precondition:** Shopping page loaded
**Steps:**
1. Click "Add to Cart" on 3 different products
2. Verify cart counter shows 3
3. Verify cart total is sum of all products
**Expected Result:** All 3 products added, cart shows correct count and total

### 5.2 Search and Filter Tests

#### TC-SHOP-004: Search Products by Text
**Priority:** High
**Precondition:** Shopping page loaded
**Steps:**
1. Enter search term in search box (ref=e9)
2. Verify filtered results match search term
**Expected Result:** Only matching products displayed

#### TC-SHOP-005: Filter by Category
**Priority:** High
**Precondition:** Shopping page loaded
**Steps:**
1. Open category dropdown (ref=e10)
2. Select "Electronics"
3. Verify only electronics products shown
4. Repeat for "Accessories", "Office Supplies", "Furniture"
**Expected Result:** Products filtered correctly by category

#### TC-SHOP-006: Filter by Price Range
**Priority:** Medium
**Precondition:** Shopping page loaded
**Steps:**
1. Set minimum price to $14.99 (ref=e11)
2. Set maximum price to $199.99 (ref=e12)
3. Verify all displayed products are within range
**Expected Result:** Only products within $14.99-$199.99 displayed

#### TC-SHOP-007: Filter by Rating (3 Stars)
**Priority:** Medium
**Precondition:** Shopping page loaded
**Steps:**
1. Click "3★" rating filter (ref=e14)
2. Verify only 3+ star products shown
**Expected Result:** Products with 3 or more stars displayed

#### TC-SHOP-008: Filter by Rating (4 Stars)
**Priority:** Medium
**Precondition:** Shopping page loaded
**Steps:**
1. Click "4★" rating filter (ref=e15)
2. Verify only 4+ star products shown
**Expected Result:** Products with 4 or more stars displayed

#### TC-SHOP-009: Filter by Rating (5 Stars)
**Priority:** Medium
**Precondition:** Shopping page loaded
**Steps:**
1. Click "5★" rating filter (ref=e16)
2. Verify only 5-star products shown
**Expected Result:** Only 5-star products displayed

### 5.3 Sorting Tests

#### TC-SHOP-010: Sort by Name Ascending
**Priority:** Medium
**Precondition:** Shopping page loaded
**Steps:**
1. Click "Sort by Name ▲" button (ref=e19)
2. Verify products sorted alphabetically A-Z
**Expected Result:** Products in alphabetical order

#### TC-SHOP-011: Sort by Name Descending
**Priority:** Medium
**Precondition:** Name sort ascending active
**Steps:**
1. Click "Sort by Name" button again
2. Verify products sorted Z-A
**Expected Result:** Products in reverse alphabetical order

#### TC-SHOP-012: Sort by Price
**Priority:** Medium
**Precondition:** Shopping page loaded
**Steps:**
1. Click "Sort by Price" button (ref=e20)
2. Verify products sorted by price (low to high)
3. Click again to verify high to low
**Expected Result:** Products sorted correctly by price

### 5.4 Pagination Tests

#### TC-SHOP-013: Navigate to Page 2
**Priority:** Medium
**Precondition:** Shopping page loaded with pagination
**Steps:**
1. Click "Page 2" button (ref=e27)
2. Verify page 2 products load
3. Verify URL or page indicator updates
**Expected Result:** Page 2 products displayed correctly

#### TC-SHOP-014: Use Next Page Button
**Priority:** Medium
**Precondition:** On page 1
**Steps:**
1. Click "Next page" button (ref=e28)
2. Verify next page loads
**Expected Result:** Navigate to next page successfully

### 5.5 Shopping Cart Tests

#### TC-SHOP-015: View Shopping Cart
**Priority:** High
**Precondition:** Products in cart
**Steps:**
1. Click shopping cart button (ref=e8)
2. Verify cart modal/page opens
3. Verify products listed correctly
**Expected Result:** Cart displays all added products

#### TC-SHOP-016: Cart Displays Correct Total
**Priority:** High
**Precondition:** Multiple products in cart
**Steps:**
1. Verify cart total matches sum of product prices
**Expected Result:** Total calculated correctly

### 5.6 Combined Filter Tests

#### TC-SHOP-017: Multiple Filters Combined
**Priority:** High
**Precondition:** Shopping page loaded
**Steps:**
1. Select category "Electronics"
2. Set price range $50-$150
3. Select 4-star rating
4. Verify only products matching ALL criteria shown
**Expected Result:** Filters work cumulatively

---

## 6. Test Cases - Web Elements Section

### 6.1 Simple Input Form Tests

#### TC-WE-001: Submit Simple Input Form
**Priority:** High
**Precondition:** Navigate to /webelements
**Steps:**
1. Click "Simple Input Form" (ref=e9)
2. Fill first input field (ref=e20) with "Test User"
3. Fill second input field (ref=e21) with "test@example.com"
4. Fill textarea (ref=e22) with test message
5. Click Submit (ref=e24)
6. Verify form submission success
**Expected Result:** Form submits without errors

#### TC-WE-002: Form Validation - Empty Fields
**Priority:** Medium
**Precondition:** Simple Input Form displayed
**Steps:**
1. Leave all fields empty
2. Click Submit
3. Verify validation messages appear
**Expected Result:** Required field validation works

### 6.2 Checkbox Tests

#### TC-WE-003: Select Single Checkbox
**Priority:** High
**Precondition:** Web elements page loaded
**Steps:**
1. Click "Check Box" menu item (ref=e10)
2. Click first checkbox
3. Verify checkbox is checked
**Expected Result:** Checkbox selected successfully

#### TC-WE-004: Select Multiple Checkboxes
**Priority:** High
**Precondition:** Checkbox section displayed
**Steps:**
1. Click multiple checkboxes
2. Verify all selected checkboxes are checked
**Expected Result:** Multiple checkboxes can be selected simultaneously

#### TC-WE-005: Deselect Checkbox
**Priority:** Medium
**Precondition:** Checkbox is checked
**Steps:**
1. Click checked checkbox
2. Verify checkbox becomes unchecked
**Expected Result:** Checkbox deselected successfully

### 6.3 Radio Button Tests

#### TC-WE-006: Select Radio Button
**Priority:** High
**Precondition:** Web elements page loaded
**Steps:**
1. Click "Radio Button" menu item (ref=e11)
2. Click first radio button
3. Verify radio button is selected
**Expected Result:** Radio button selected

#### TC-WE-007: Radio Button Mutual Exclusivity
**Priority:** High
**Precondition:** Radio button section displayed
**Steps:**
1. Select first radio button
2. Select second radio button
3. Verify first is deselected, second is selected
**Expected Result:** Only one radio button selected at a time

### 6.4 Web Tables Tests

#### TC-WE-008: Display Web Tables
**Priority:** Medium
**Precondition:** Web elements page loaded
**Steps:**
1. Click "Web Tables" menu item (ref=e12)
2. Verify table is displayed
3. Verify table headers
4. Verify table data rows
**Expected Result:** Table displays with correct structure and data

#### TC-WE-009: Table Data Validation
**Priority:** Medium
**Precondition:** Web table displayed
**Steps:**
1. Count number of rows
2. Count number of columns
3. Verify data in specific cells
**Expected Result:** Table data is accurate and complete

### 6.5 Links Tests

#### TC-WE-010: Click Valid Links
**Priority:** High
**Precondition:** Web elements page loaded
**Steps:**
1. Click "Links" menu item (ref=e13)
2. Click first link
3. Verify navigation or new tab opens
**Expected Result:** Link works correctly

#### TC-WE-011: Verify Link Attributes
**Priority:** Low
**Precondition:** Links section displayed
**Steps:**
1. Verify links have correct href attributes
2. Verify target attributes (same tab/new tab)
**Expected Result:** Link attributes configured correctly

### 6.6 Broken Links/Images Tests

#### TC-WE-012: Identify Broken Links
**Priority:** Medium
**Precondition:** Web elements page loaded
**Steps:**
1. Click "Broken Links/Images" (ref=e14)
2. Verify broken links are displayed/identified
**Expected Result:** Broken links section loads

#### TC-WE-013: Identify Broken Images
**Priority:** Medium
**Precondition:** Broken Links/Images section displayed
**Steps:**
1. Check for broken image placeholders
2. Verify broken images are marked or indicated
**Expected Result:** Broken images identified correctly

### 6.7 Upload and Download Tests

#### TC-WE-014: Upload File
**Priority:** Medium
**Precondition:** Web elements page loaded
**Steps:**
1. Click "Upload and Download" (ref=e15)
2. Click file upload button
3. Select a test file
4. Verify file uploads successfully
**Expected Result:** File uploaded successfully

#### TC-WE-015: Download File
**Priority:** Medium
**Precondition:** Upload and Download section displayed
**Steps:**
1. Click download button/link
2. Verify file downloads to default location
**Expected Result:** File downloads successfully

### 6.8 Shadow DOM Tests

#### TC-WE-016: Interact with Shadow DOM Elements
**Priority:** Low
**Precondition:** Web elements page loaded
**Steps:**
1. Click "Shadow DOM" (ref=e16)
2. Attempt to interact with shadow DOM elements
3. Verify elements are accessible
**Expected Result:** Shadow DOM elements can be interacted with

### 6.9 Select Box Tests

#### TC-WE-017: Select Dropdown Option
**Priority:** High
**Precondition:** Web elements page loaded
**Steps:**
1. Click "Select Box" (ref=e17)
2. Click dropdown
3. Select an option
4. Verify option is selected
**Expected Result:** Dropdown option selected successfully

#### TC-WE-018: Verify All Dropdown Options
**Priority:** Medium
**Precondition:** Select Box section displayed
**Steps:**
1. Click dropdown
2. Verify all expected options are present
**Expected Result:** All options available in dropdown

### 6.10 Widgets Tests (Expandable)

#### TC-WE-019: Expand Widgets Section
**Priority:** Low
**Precondition:** Web elements page loaded
**Steps:**
1. Click "Widgets" expandable button (ref=e18)
2. Verify section expands
3. Verify widget options appear
**Expected Result:** Widgets section expands correctly

### 6.11 Interactions Tests (Expandable)

#### TC-WE-020: Expand Interactions Section
**Priority:** Low
**Precondition:** Web elements page loaded
**Steps:**
1. Click "Interactions" expandable button (ref=e19)
2. Verify section expands
3. Verify interaction options appear
**Expected Result:** Interactions section expands correctly

---

## 7. Navigation and Common Tests

### 7.1 Navigation Tests

#### TC-NAV-001: Navigate to Home
**Priority:** High
**Steps:**
1. From any page, click "Home" link
2. Verify homepage loads
**Expected Result:** Homepage displays correctly

#### TC-NAV-002: Navigate to Shopping
**Priority:** High
**Steps:**
1. From any page, click "Shopping" link
2. Verify shopping page loads
**Expected Result:** Shopping section displays correctly

#### TC-NAV-003: Navigate to Web Elements
**Priority:** High
**Steps:**
1. From any page, click "Web Elements" link
2. Verify web elements page loads
**Expected Result:** Web Elements section displays correctly

#### TC-NAV-004: Toggle Theme
**Priority:** Low
**Steps:**
1. Click "Toggle theme" button (ref=e6)
2. Verify theme changes (dark/light)
3. Click again to toggle back
**Expected Result:** Theme switches correctly

#### TC-NAV-005: Login Navigation
**Priority:** Medium
**Steps:**
1. Click login link (ref=e7)
2. Verify login page/modal appears
**Expected Result:** Login interface displays

---

## 8. End-to-End Workflows

### Workflow 1: Complete Shopping Journey
**Priority:** Critical
**Steps:**
1. Navigate to shopping page
2. Search for "laptop"
3. Filter by category "Electronics"
4. Filter by price range $100-$500
5. Filter by 4+ star rating
6. Sort by price (low to high)
7. Add 2 products to cart
8. View cart
9. Verify cart total
**Expected Result:** Complete shopping flow works without errors

### Workflow 2: Complete Web Elements Form
**Priority:** High
**Steps:**
1. Navigate to web elements page
2. Fill simple input form
3. Submit form
4. Select checkboxes
5. Select radio button
6. Select dropdown option
7. Click valid link
**Expected Result:** All form elements work in sequence

### Workflow 3: Cross-Section Navigation
**Priority:** Medium
**Steps:**
1. Start at homepage
2. Navigate to Shopping
3. Add product to cart
4. Navigate to Web Elements
5. Navigate back to Shopping
6. Verify cart still has product
**Expected Result:** Cart persists across navigation

---

## 9. Test Data

### Form Test Data
- Name: "Test User", "John Doe", "Jane Smith"
- Email: "test@example.com", "user@test.com"
- Message: "This is a test message", "Sample form submission text"

### Search Terms
- "laptop", "desk", "mouse", "keyboard", "monitor"

### Price Ranges
- Min: $14.99, $50, $100
- Max: $199.99, $150, $500

---

## 10. Success Criteria

- All critical and high priority test cases pass
- Shopping cart functionality works end-to-end
- All form submissions successful
- Filters and sorting work correctly
- Navigation between sections works seamlessly
- No broken elements or console errors

---

## 11. Risk Assessment

**High Risk Areas:**
- Shopping cart total calculation
- Combined filters (multiple filters at once)
- Form validation

**Medium Risk Areas:**
- Pagination
- File upload/download
- Shadow DOM interactions

**Low Risk Areas:**
- Theme toggle
- Link navigation
- Expandable sections

---

## 12. Test Execution Strategy

1. **Phase 1:** Execute all critical and high priority test cases
2. **Phase 2:** Execute medium priority test cases
3. **Phase 3:** Execute low priority test cases
4. **Phase 4:** Execute end-to-end workflows
5. **Phase 5:** Regression testing after any fixes

---

## 13. Defect Management

**Severity Levels:**
- **Critical:** Application crash, data loss, checkout failure
- **High:** Major functionality broken, incorrect calculations
- **Medium:** Minor functionality issues, UI glitches
- **Low:** Cosmetic issues, suggestions

**Defect Template:**
- ID
- Test Case ID
- Summary
- Steps to Reproduce
- Expected Result
- Actual Result
- Severity
- Screenshot/Video

---

## 14. Test Deliverables

- This test plan document
- Test case execution report
- Defect report
- Test automation scripts (Pytest + Selenium)
- Screenshots/videos of failures
- Final test summary report

---

## 15. Automation Recommendations

All test cases in this plan are suitable for automation using Selenium WebDriver with Pytest framework. Priority for automation:

1. **High Priority Automation:**
   - Shopping cart operations
   - Form submissions
   - Filtering and sorting
   - End-to-end workflows

2. **Medium Priority Automation:**
   - Navigation tests
   - Checkbox/radio button tests
   - Table validation

3. **Low Priority Automation:**
   - Theme toggle
   - Visual verification tests

---

## 16. Notes

- This test plan was generated using the Selenium MCP Server's enhanced planner
- All element references (ref=eX) are captured from the live site
- Test plan covers full site exploration depth
- Total test cases: 41 individual tests + 3 end-to-end workflows
- Estimated execution time: ~2-3 hours for complete suite

---

**Generated by:** Selenium MCP Server Enhanced Planner  
**Date:** 2025-11-22  
**Version:** 1.0
