# Comprehensive Test Plan for practiceautomatedtesting.com

## Site Overview
**Base URL:** https://practiceautomatedtesting.com

**Sections Discovered:**
- Homepage
- Web Elements (`/webelements`)
- Shopping Application (`/shopping`)
- API Section (`/api`)
- AI Tools (`/ai-tools` - to be confirmed)
- Login functionality

---

## Test Suite 1: Homepage Tests

### TC-HOME-001: Verify Homepage Loads
**Priority:** High
**Steps:**
1. Navigate to https://practiceautomatedtesting.com
2. Verify page title is "Home"
3. Verify main heading "Welcome to Automated Testing Tutorials" is visible
4. Verify all navigation links are present (Home, Web Elements, API, Shopping, AI Tools)

### TC-HOME-002: Navigation Links
**Priority:** High
**Steps:**
1. Navigate to homepage
2. Verify "Web Elements" link navigates to `/webelements`
3. Verify "Shopping" link navigates to `/shopping`
4. Verify "API" link navigates to `/api`
5. Verify "AI Tools" link works

### TC-HOME-003: Theme Toggle
**Priority:** Medium
**Steps:**
1. Navigate to homepage
2. Click the "Toggle theme" button
3. Verify theme changes (light/dark mode)
4. Toggle again and verify it switches back

---

## Test Suite 2: Web Elements Tests

### TC-ELEM-001: Simple Input Form Submission
**Priority:** High
**Steps:**
1. Navigate to `/webelements`
2. Enter "John Doe" in Full Name field
3. Enter "john@example.com" in Email field
4. Enter "123 Main St" in Current Address
5. Enter "456 Oak Ave" in Permanent Address
6. Click Submit button
7. Verify form submission success

### TC-ELEM-002: Check Box Interaction
**Priority:** High
**Steps:**
1. Navigate to `/webelements`
2. Click on "Check Box" in sidebar
3. Select multiple checkboxes
4. Verify checkboxes are checked
5. Uncheck and verify state changes

### TC-ELEM-003: Radio Button Selection
**Priority:** High
**Steps:**
1. Navigate to `/webelements`
2. Click on "Radio Button" in sidebar
3. Select different radio button options
4. Verify only one option can be selected at a time

### TC-ELEM-004: Web Tables Interaction
**Priority:** Medium
**Steps:**
1. Navigate to `/webelements`
2. Click on "Web Tables" in sidebar
3. Verify table is displayed
4. Test table sorting if available
5. Test table search/filter if available

### TC-ELEM-005: Links Testing
**Priority:** Medium
**Steps:**
1. Navigate to `/webelements`
2. Click on "Links" in sidebar
3. Test different types of links
4. Verify links open correctly

### TC-ELEM-006: Broken Links/Images Detection
**Priority:** Medium
**Steps:**
1. Navigate to `/webelements`
2. Click on "Broken Links/Images" in sidebar
3. Identify and verify broken links
4. Identify and verify broken images

### TC-ELEM-007: File Upload and Download
**Priority:** High
**Steps:**
1. Navigate to `/webelements`
2. Click on "Upload and Download" in sidebar
3. Upload a test file
4. Verify upload success
5. Download a file
6. Verify download completes

### TC-ELEM-008: Shadow DOM Interaction
**Priority:** Medium
**Steps:**
1. Navigate to `/webelements`
2. Click on "Shadow DOM" in sidebar
3. Interact with elements inside Shadow DOM
4. Verify interactions work correctly

### TC-ELEM-009: Select Box Interaction
**Priority:** High
**Steps:**
1. Navigate to `/webelements`
2. Click on "Select Box" in sidebar
3. Select different options from dropdown
4. Verify selections are applied

### TC-ELEM-010: Widgets Section
**Priority:** Medium
**Steps:**
1. Navigate to `/webelements`
2. Expand "Widgets" section
3. Test each widget type
4. Verify widget functionality

### TC-ELEM-011: Interactions Section
**Priority:** Medium
**Steps:**
1. Navigate to `/webelements`
2. Expand "Interactions" section
3. Test drag-and-drop if available
4. Test other interactive elements

---

## Test Suite 3: Shopping Application Tests

### TC-SHOP-001: Product Catalog Display
**Priority:** High
**Steps:**
1. Navigate to `/shopping`
2. Verify products are displayed
3. Verify product images load
4. Verify product names, prices, and ratings are shown
5. Verify "10 products" count is correct

### TC-SHOP-002: Product Search
**Priority:** High
**Steps:**
1. Navigate to `/shopping`
2. Enter "headphones" in search box
3. Verify search results filter correctly
4. Clear search and verify all products return

### TC-SHOP-003: Category Filter
**Priority:** High
**Steps:**
1. Navigate to `/shopping`
2. Select "Electronics" from category dropdown
3. Verify only electronics products are shown
4. Test other categories (Accessories, Office Supplies, Furniture)
5. Select "All" and verify all products return

### TC-SHOP-004: Price Range Filter
**Priority:** High
**Steps:**
1. Navigate to `/shopping`
2. Adjust minimum price slider to $15
3. Adjust maximum price slider to $200
4. Verify products within price range are displayed
5. Verify products outside range are hidden

### TC-SHOP-005: Rating Filter
**Priority:** Medium
**Steps:**
1. Navigate to `/shopping`
2. Click "3★" rating filter
3. Verify only 3+ star products show
4. Test 4★ and 5★ filters
5. Click "All" to reset

### TC-SHOP-006: Availability Filter
**Priority:** Medium
**Steps:**
1. Navigate to `/shopping`
2. Check "In Stock Only" checkbox
3. Verify out-of-stock products are hidden
4. Uncheck and verify all products return

### TC-SHOP-007: Deals Filter
**Priority:** Medium
**Steps:**
1. Navigate to `/shopping`
2. Check "On Sale Only" checkbox
3. Verify only sale items are shown (items with "SALE" badge)
4. Uncheck and verify all products return

### TC-SHOP-008: Sort by Name
**Priority:** High
**Steps:**
1. Navigate to `/shopping`
2. Click "Sort by Name ▲" button
3. Verify products are sorted alphabetically ascending
4. Click again to sort descending
5. Verify sort order changes

### TC-SHOP-009: Sort by Price
**Priority:** High
**Steps:**
1. Navigate to `/shopping`
2. Click "Sort by Price" button
3. Verify products are sorted by price ascending
4. Click again to sort descending
5. Verify sort order changes

### TC-SHOP-010: Add Item to Cart
**Priority:** Critical
**Steps:**
1. Navigate to `/shopping`
2. Click "Add to Cart" for Bluetooth Headphones
3. Verify cart icon updates to "1 items $59.99"
4. Verify product shows "In cart: 1" indicator

### TC-SHOP-011: Add Multiple Items to Cart
**Priority:** Critical
**Steps:**
1. Navigate to `/shopping`
2. Add Bluetooth Headphones to cart
3. Add Desk Lamp to cart
4. Verify cart shows "2 items" and correct total price
5. Verify both products show cart indicators

### TC-SHOP-012: Cart Quantity Management
**Priority:** High
**Steps:**
1. Navigate to `/shopping`
2. Add same item to cart multiple times
3. Verify quantity increases
4. Verify price updates correctly

### TC-SHOP-013: Pagination
**Priority:** Medium
**Steps:**
1. Navigate to `/shopping`
2. Click "Page 2" button
3. Verify page 2 products load
4. Click "Next page" button
5. Click "Page 1" to return

### TC-SHOP-014: Product Details View (if available)
**Priority:** Medium
**Steps:**
1. Navigate to `/shopping`
2. Click on a product to view details
3. Verify product details page loads
4. Verify all product information is displayed

### TC-SHOP-015: Shopping Cart View
**Priority:** Critical
**Steps:**
1. Add items to cart
2. Click on cart icon
3. Verify cart page/modal opens
4. Verify items are listed correctly
5. Verify total is calculated correctly

### TC-SHOP-016: Checkout Flow (if available)
**Priority:** Critical
**Steps:**
1. Add items to cart
2. Navigate to checkout
3. Fill in checkout form
4. Complete purchase
5. Verify order confirmation

---

## Test Suite 4: Login/Authentication Tests

### TC-AUTH-001: Navigate to Login
**Priority:** High
**Steps:**
1. Navigate to homepage
2. Click "Login" link in navigation
3. Verify login page loads

### TC-AUTH-002: Valid Login (if credentials available)
**Priority:** Critical
**Steps:**
1. Navigate to login page
2. Enter valid username
3. Enter valid password
4. Click login button
5. Verify successful login

### TC-AUTH-003: Invalid Login
**Priority:** High
**Steps:**
1. Navigate to login page
2. Enter invalid credentials
3. Click login button
4. Verify error message is displayed

### TC-AUTH-004: Logout
**Priority:** High
**Steps:**
1. Login with valid credentials
2. Click logout button
3. Verify user is logged out
4. Verify redirected to appropriate page

---

## Test Suite 5: API Section Tests

### TC-API-001: Navigate to API Section
**Priority:** Medium
**Steps:**
1. Navigate to homepage
2. Click "API" in navigation
3. Verify API section page loads

### TC-API-002: API Testing Interface (to be defined)
**Priority:** Medium
**Steps:**
1. Navigate to `/api`
2. Explore available API testing features
3. Test API endpoints if available

---

## Test Suite 6: AI Tools Tests

### TC-AI-001: Navigate to AI Tools
**Priority:** Low
**Steps:**
1. Navigate to homepage
2. Click "AI Tools" in navigation
3. Verify AI Tools page loads

### TC-AI-002: AI Tools Functionality (to be defined)
**Priority:** Low
**Steps:**
1. Navigate to AI Tools section
2. Explore available AI tools
3. Test tool functionality

---

## Test Execution Strategy

### Priority Levels:
- **Critical**: Core shopping cart and checkout functionality
- **High**: Main features like filters, search, form submissions
- **Medium**: Secondary features like widgets, pagination
- **Low**: Experimental features like AI tools

### Test Execution Order:
1. Homepage and navigation tests
2. Web Elements tests (basic to advanced)
3. Shopping application tests (most critical)
4. Login/Authentication tests
5. API and AI Tools tests

### Automation Framework:
- **Framework**: Pytest + Selenium
- **Browser**: Chrome (configurable)
- **Reporting**: pytest-html for HTML reports
- **Screenshots**: On test failure
- **Assertions**: pytest assertions with clear messages

### Test Data:
- User credentials (if needed): To be provided
- Test files for upload: sample.txt, test-image.png
- Test search terms: "headphones", "lamp", "chair"

---

## Notes:
- All tests should include proper waits for element visibility
- Each test should be independent and not rely on other tests
- Tests should clean up state (e.g., clear cart) after execution
- Page Object Model should be used for maintainability
- Tests should handle dynamic content and Ajax loading
