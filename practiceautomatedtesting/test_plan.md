# Test Plan: Practice Automated Testing Website

## Overview
Comprehensive test plan for https://practiceautomatedtesting.com covering Web Elements, Shopping, and API sections.

## Test Environment
- Base URL: https://practiceautomatedtesting.com
- Browsers: Chrome (latest)
- Test Framework: Pytest + Selenium

## Test Scenarios

### 1. Web Elements Testing

#### 1.1 Simple Input Form Tests
**Test Case ID**: WE-001
**Description**: Verify simple input form functionality
**Steps**:
1. Navigate to Web Elements section
2. Click on "Simple Input Form"
3. Enter text in input fields
4. Enter text in textarea
5. Click Submit button
6. Verify form submission

**Expected Result**: Form accepts input and submits successfully

#### 1.2 Checkbox Tests
**Test Case ID**: WE-002
**Description**: Verify checkbox interactions
**Steps**:
1. Navigate to Check Box section
2. Verify all checkboxes are initially unchecked
3. Click each checkbox to select
4. Verify checkbox state changes
5. Uncheck selected checkboxes
6. Verify final state

**Expected Result**: Checkboxes toggle correctly between checked/unchecked states

#### 1.3 Radio Button Tests
**Test Case ID**: WE-003
**Description**: Verify radio button functionality
**Steps**:
1. Navigate to Radio Button section
2. Select different radio button options
3. Verify only one option can be selected at a time
4. Verify selected value

**Expected Result**: Radio buttons allow single selection only

#### 1.4 Web Tables Tests
**Test Case ID**: WE-004
**Description**: Verify web table interactions
**Steps**:
1. Navigate to Web Tables section
2. Read table data
3. Verify table headers
4. Search/filter table if available
5. Sort columns if available

**Expected Result**: Table displays data correctly and supports interactions

#### 1.5 Links Tests
**Test Case ID**: WE-005
**Description**: Verify link functionality
**Steps**:
1. Navigate to Links section
2. Click various link types
3. Verify navigation/new tab behavior
4. Verify link status codes

**Expected Result**: Links work correctly and open in appropriate context

#### 1.6 Select Box Tests
**Test Case ID**: WE-006
**Description**: Verify dropdown/select box functionality
**Steps**:
1. Navigate to Select Box section
2. Open dropdown
3. Select different options
4. Verify selected value
5. Test multi-select if available

**Expected Result**: Dropdown selections work correctly

### 2. Shopping Application Tests

#### 2.1 Product Search Tests
**Test Case ID**: SHOP-001
**Description**: Verify product search functionality
**Steps**:
1. Navigate to Shopping section
2. Enter product name in search box
3. Click search or press Enter
4. Verify search results match query

**Expected Result**: Search returns relevant products

#### 2.2 Category Filter Tests
**Test Case ID**: SHOP-002
**Description**: Verify category filtering
**Steps**:
1. Navigate to Shopping section
2. Select category from dropdown (Electronics, Accessories, etc.)
3. Verify filtered products belong to selected category
4. Change category and verify results update

**Expected Result**: Products filter correctly by category

#### 2.3 Price Range Filter Tests
**Test Case ID**: SHOP-003
**Description**: Verify price range filtering
**Steps**:
1. Navigate to Shopping section
2. Set minimum price ($14.99)
3. Set maximum price ($199.99)
4. Verify displayed products are within price range

**Expected Result**: Products filter correctly by price range

#### 2.4 Rating Filter Tests
**Test Case ID**: SHOP-004
**Description**: Verify rating filter functionality
**Steps**:
1. Navigate to Shopping section
2. Click rating filters (3★, 4★, 5★)
3. Verify filtered products match rating criteria

**Expected Result**: Products filter correctly by rating

#### 2.5 Sorting Tests
**Test Case ID**: SHOP-005
**Description**: Verify product sorting
**Steps**:
1. Navigate to Shopping section
2. Click "Sort by Name" button
3. Verify products are sorted alphabetically
4. Click "Sort by Price" button
5. Verify products are sorted by price

**Expected Result**: Products sort correctly by name and price

#### 2.6 Add to Cart Tests
**Test Case ID**: SHOP-006
**Description**: Verify add to cart functionality
**Steps**:
1. Navigate to Shopping section
2. Click "Add to Cart" button for a product
3. Verify cart count increments
4. Verify cart total updates
5. Add multiple products
6. Verify cart reflects all additions

**Expected Result**: Cart updates correctly with added products

#### 2.7 Pagination Tests
**Test Case ID**: SHOP-007
**Description**: Verify pagination functionality
**Steps**:
1. Navigate to Shopping section
2. Verify current page is Page 1
3. Click "Page 2" button
4. Verify page 2 products display
5. Click "Next page" button
6. Verify navigation works

**Expected Result**: Pagination navigates through product pages correctly

### 3. Login/Authentication Tests

#### 3.1 Login Tests
**Test Case ID**: AUTH-001
**Description**: Verify login functionality
**Steps**:
1. Click Login link
2. Enter valid credentials
3. Click submit
4. Verify successful login
5. Test invalid credentials
6. Verify error messages

**Expected Result**: Login accepts valid credentials and rejects invalid ones

### 4. Theme Toggle Tests

#### 4.1 Dark/Light Mode Tests
**Test Case ID**: UI-001
**Description**: Verify theme toggle functionality
**Steps**:
1. Note current theme
2. Click "Toggle theme" button
3. Verify theme changes
4. Toggle back
5. Verify theme reverts

**Expected Result**: Theme toggles between light and dark modes

## Test Data Requirements
- Valid login credentials (if required)
- Sample product search terms
- Expected product categories
- Price range test values

## Test Execution Priority
1. High Priority: Shopping cart, Search, Category filters
2. Medium Priority: Forms, Checkboxes, Radio buttons, Sorting
3. Low Priority: Theme toggle, Links, Pagination

## Risks and Mitigation
- Website availability: Use retry logic
- Element locator changes: Use robust locator strategies
- Timing issues: Implement explicit waits

## Success Criteria
- All test cases pass
- No critical defects
- Test coverage > 80%
