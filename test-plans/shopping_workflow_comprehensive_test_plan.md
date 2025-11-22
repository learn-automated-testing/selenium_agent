# Shopping Workflow - Comprehensive Test Plan
## Application: Practice Automated Testing - E-commerce Shopping
**URL**: https://practiceautomatedtesting.com/shopping

---

## 1. Overview
This test plan covers comprehensive testing of the e-commerce shopping application, including product browsing, filtering, searching, sorting, cart operations, and checkout workflows.

---

## 2. Test Environment
- **Base URL**: https://practiceautomatedtesting.com/shopping
- **Browser**: Chrome, Firefox, Safari
- **Test Data**: Various product categories (Electronics, Accessories, Office Supplies, Furniture)
- **Price Range**: $14.99 - $199.99

---



### 3.5 Pagination
- Page navigation (Page 1, Page 2, etc.)
- Next/Previous page buttons
- Products per page count
- Total product count

### 3.6 Shopping Cart
- Add to Cart functionality
- Cart item counter
- Cart total price display
- View cart
- Update quantities
- Remove items
- Continue shopping

### 3.7 User Authentication
- Login functionality
- Guest checkout
- User account access

### 3.8 Theme Toggle
- Light/Dark mode switching
- Theme persistence

---

## 4. Test Cases

### TC-01: Product Search Functionality
**Priority**: High  
**Category**: Search

**Test Steps**:
1. Navigate to shopping page
2. Enter "headphones" in search field
3. Verify search results display
4. Verify result count updates
5. Verify only headphone products shown

**Expected Results**:
- Search executes successfully
- Results filtered to match search term
- Product count reflects filtered results
- Relevant products displayed

**Test Data**:
- Search terms: "headphones", "lamp", "desk", "bluetooth"

---

### TC-02: Category Filter - Single Selection
**Priority**: High  
**Category**: Filtering

**Test Steps**:
1. Navigate to shopping page
2. Select "Electronics" from category dropdown
3. Verify only Electronics products displayed
4. Note product count
5. Switch to "Accessories" category
6. Verify product list updates

**Expected Results**:
- Category filter applies correctly
- Only products from selected category shown
- Product count updates accurately
- Category badge matches filter

**Test Data**:
- Categories: Electronics, Accessories, Office Supplies, Furniture

---

### TC-03: Price Range Filter
**Priority**: High  
**Category**: Filtering

**Test Steps**:
1. Navigate to shopping page
2. Set minimum price to $50
3. Set maximum price to $100
4. Verify products within range displayed
5. Verify products outside range hidden
6. Check product count updates

**Expected Results**:
- Price filter applies correctly
- All displayed products within specified range
- Product count reflects filtered results
- Price sliders update values

**Test Data**:
- Price ranges: $15-$50, $50-$100, $100-$200

---

### TC-04: Rating Filter
**Priority**: Medium  
**Category**: Filtering

**Test Steps**:
1. Navigate to shopping page
2. Click "5★" rating filter
3. Verify only 5-star products shown
4. Click "4★" rating filter
5. Verify only 4-star and above products shown
6. Click "3★" rating filter
7. Verify only 3-star and above products shown

**Expected Results**:
- Rating filter applies correctly
- Products match minimum rating selected
- Product count updates
- Rating stars display correctly on products

---

### TC-05: Availability Filter - In Stock Only
**Priority**: Medium  
**Category**: Filtering

**Test Steps**:
1. Navigate to shopping page
2. Check "In Stock Only" checkbox
3. Verify no "Out of Stock" products displayed
4. Uncheck "In Stock Only"
5. Verify out of stock products appear

**Expected Results**:
- In Stock filter applies correctly
- Out of stock products hidden when filter active
- All products shown when filter inactive
- Product availability clearly indicated

---

### TC-06: Deals Filter - On Sale Only
**Priority**: Medium  
**Category**: Filtering

**Test Steps**:
1. Navigate to shopping page
2. Check "On Sale Only" checkbox
3. Verify only products with SALE badge shown
4. Verify sale prices displayed
5. Uncheck filter
6. Verify all products appear

**Expected Results**:
- Sale filter applies correctly
- Only sale items shown when filter active
- Sale badge visible on all filtered products
- Sale prices clearly indicated

---

### TC-07: Combined Filters
**Priority**: High  
**Category**: Filtering

**Test Steps**:
1. Navigate to shopping page
2. Select "Electronics" category
3. Set price range $50-$150
4. Select "4★" rating
5. Check "In Stock Only"
6. Verify products match ALL criteria
7. Remove filters one by one
8. Verify product list updates correctly

**Expected Results**:
- Multiple filters work together
- Products match all active filters
- Removing filters updates results correctly
- Product count accurate throughout

**Test Data**:
- Combination 1: Electronics + $50-$100 + 4★
- Combination 2: Accessories + On Sale + In Stock
- Combination 3: All filters active

---

### TC-08: Sort by Name Ascending
**Priority**: Medium  
**Category**: Sorting

**Test Steps**:
1. Navigate to shopping page
2. Click "Sort by Name ▲" button
3. Verify products sorted alphabetically A-Z
4. Note first and last product names
5. Click button again to toggle descending
6. Verify products sorted Z-A

**Expected Results**:
- Products sort alphabetically
- Sort indicator updates (▲/▼)
- Product order changes correctly
- Sort persists during pagination

---

### TC-09: Sort by Price
**Priority**: Medium  
**Category**: Sorting

**Test Steps**:
1. Navigate to shopping page
2. Click "Sort by Price" button
3. Verify products sorted by price (low to high)
4. Note first product has lowest price
5. Click again to toggle descending
6. Verify highest price product shown first

**Expected Results**:
- Products sort by price correctly
- Lowest price first on ascending
- Highest price first on descending
- Sort indicator updates

---

### TC-10: Add Single Item to Cart
**Priority**: Critical  
**Category**: Cart Operations

**Test Steps**:
1. Navigate to shopping page
2. Note cart shows "0 items $0.00"
3. Click "Add to Cart" on first product
4. Verify cart updates to "1 items $[price]"
5. Verify product price matches cart total
6. Verify cart icon updates

**Expected Results**:
- Item added to cart successfully
- Cart counter increments to 1
- Cart total equals product price
- Visual feedback provided (animation/message)
- Product shows "In cart: 1" indicator

---

### TC-11: Add Multiple Items to Cart
**Priority**: Critical  
**Category**: Cart Operations

**Test Steps**:
1. Navigate to shopping page
2. Add first product to cart (e.g., $59.99)
3. Add second product to cart (e.g., $24.99)
4. Add third product to cart (e.g., $89.99)
5. Verify cart shows "3 items $174.97"
6. Verify cart total is sum of all prices

**Expected Results**:
- All items added successfully
- Cart counter shows correct count (3)
- Cart total is accurate sum
- Each product shows in-cart indicator

**Test Data**:
- Product combinations with various prices
- Test with 1, 3, 5, 10 items

---

### TC-12: Add Same Item Multiple Times
**Priority**: High  
**Category**: Cart Operations

**Test Steps**:
1. Navigate to shopping page
2. Click "Add to Cart" on a product
3. Note product shows "In cart: 1"
4. Click "Add to Cart" again on same product
5. Verify cart quantity behavior
6. Check if it increments or prevents duplicate

**Expected Results**:
- System handles duplicate adds consistently
- Either: quantity increments OR duplicate prevented
- Cart total updates correctly
- Clear feedback provided to user

---

### TC-13: View Cart
**Priority**: Critical  
**Category**: Cart Operations

**Test Steps**:
1. Add 2-3 items to cart
2. Click on cart button/icon
3. Verify navigation to cart page
4. Verify all cart items displayed
5. Verify item details (name, price, quantity)
6. Verify subtotal and total

**Expected Results**:
- Cart page loads successfully
- All items displayed with correct details
- Prices and quantities accurate
- Subtotal and total calculated correctly
- Cart actions available (update, remove, checkout)

---

### TC-14: Update Cart Quantity
**Priority**: High  
**Category**: Cart Operations

**Test Steps**:
1. Add item to cart
2. Navigate to cart page
3. Increase quantity to 3
4. Click update button
5. Verify quantity updates
6. Verify total price = unit price × 3
7. Decrease quantity to 1
8. Verify updates

**Expected Results**:
- Quantity updates successfully
- Price recalculates correctly
- Cart total updates
- Update button functions properly
- Minimum quantity is 1

---

### TC-15: Remove Item from Cart
**Priority**: High  
**Category**: Cart Operations

**Test Steps**:
1. Add 3 items to cart
2. Navigate to cart page
3. Click remove on second item
4. Verify item removed from cart
5. Verify cart count decreases to 2
6. Verify total price updates
7. Remove all items
8. Verify empty cart message

**Expected Results**:
- Item removed successfully
- Cart count and total update correctly
- Remaining items still displayed
- Empty cart shows appropriate message
- "Continue shopping" or similar option available

---

### TC-16: Pagination - Next Page
**Priority**: Medium  
**Category**: Pagination

**Test Steps**:
1. Navigate to shopping page
2. Note products on Page 1
3. Click "Next page" or "Page 2" button
4. Verify page 2 products load
5. Verify different products displayed
6. Note Page 2 is now active/highlighted

**Expected Results**:
- Page 2 loads successfully
- New products displayed
- Active page indicator updates
- Previous/Next buttons update state
- Product count remains accurate

---

### TC-17: Pagination - Page Navigation
**Priority**: Medium  
**Category**: Pagination

**Test Steps**:
1. Navigate to shopping page
2. Click "Page 2" button
3. Click "Page 1" button to return
4. Verify original products displayed
5. Test direct page number clicks
6. Test Previous button from Page 2

**Expected Results**:
- Page navigation works correctly
- Products update on each page change
- Active page indicated clearly
- Previous/Next buttons enabled/disabled appropriately

---

### TC-18: Pagination with Filters
**Priority**: Medium  
**Category**: Pagination + Filtering

**Test Steps**:
1. Navigate to shopping page
2. Apply category filter (e.g., Electronics)
3. Navigate to Page 2
4. Verify filter persists on Page 2
5. Verify only filtered products shown
6. Return to Page 1
7. Verify filter still active

**Expected Results**:
- Filters persist across pages
- Pagination reflects filtered results
- Page count updates based on filtered products
- Filter can be changed from any page

---

### TC-19: Search with No Results
**Priority**: Medium  
**Category**: Search

**Test Steps**:
1. Navigate to shopping page
2. Search for "xyz123nonexistent"
3. Verify "No products found" message
4. Verify product count shows 0
5. Clear search
6. Verify all products return

**Expected Results**:
- Appropriate "no results" message displayed
- No products shown
- Search can be cleared/modified
- User can easily return to full catalog

---

### TC-20: Guest Checkout Flow
**Priority**: Critical  
**Category**: Checkout

**Test Steps**:
1. Add items to cart as guest user
2. Navigate to cart
3. Click "Checkout" or "Proceed to Checkout"
4. Verify guest checkout option available
5. Fill in shipping information
6. Fill in billing information
7. Select payment method
8. Review order
9. Place order
10. Verify order confirmation

**Expected Results**:
- Guest checkout available
- All required fields present
- Form validation works
- Order summary accurate
- Payment processing (test mode)
- Order confirmation displayed
- Email confirmation sent (if applicable)

---

### TC-21: Registered User Checkout
**Priority**: Critical  
**Category**: Checkout + Authentication

**Test Steps**:
1. Click Login link
2. Login with valid credentials
3. Add items to cart
4. Proceed to checkout
5. Verify saved address pre-filled
6. Verify saved payment methods available
7. Complete checkout
8. Verify order in account orders

**Expected Results**:
- Login successful
- Saved information auto-populated
- Faster checkout for registered users
- Order saved to account history
- Account benefits displayed

---

### TC-22: Checkout - Apply Coupon Code
**Priority**: Medium  
**Category**: Checkout

**Test Steps**:
1. Add items to cart
2. Navigate to cart/checkout
3. Enter valid coupon code
4. Click Apply
5. Verify discount applied
6. Verify total price reduced
7. Try invalid coupon
8. Verify error message

**Expected Results**:
- Valid coupon applies discount
- Discount amount clearly shown
- Total recalculates correctly
- Invalid coupon shows error
- Coupon can be removed

**Test Data**:
- Valid coupons: "SAVE10", "WELCOME20"
- Invalid coupons: "EXPIRED", "INVALID123"

---

### TC-23: Checkout - Shipping Options
**Priority**: High  
**Category**: Checkout

**Test Steps**:
1. Add items to cart
2. Proceed to checkout
3. View available shipping options
4. Select standard shipping
5. Note shipping cost
6. Select express shipping
7. Verify shipping cost updates
8. Verify total includes shipping

**Expected Results**:
- Multiple shipping options available
- Shipping costs clearly displayed
- Total updates with shipping selection
- Delivery estimates shown
- Free shipping threshold indicated (if applicable)

---

### TC-24: Checkout - Payment Methods
**Priority**: Critical  
**Category**: Checkout

**Test Steps**:
1. Add items to cart
2. Proceed to checkout
3. View available payment methods
4. Select Credit Card
5. Enter test card details
6. Verify card validation
7. Try different payment methods (PayPal, etc.)
8. Complete payment

**Expected Results**:
- Multiple payment options available
- Payment forms secure (HTTPS)
- Card validation works
- Error messages for invalid data
- Payment processes successfully (test mode)

**Test Data**:
- Test credit card: 4242 4242 4242 4242
- Expiry: Future date
- CVV: 123

---

### TC-25: Checkout - Order Review
**Priority**: High  
**Category**: Checkout

**Test Steps**:
1. Add multiple items to cart
2. Proceed through checkout
3. Reach order review page
4. Verify all items listed
5. Verify quantities and prices
6. Verify shipping address
7. Verify billing address
8. Verify payment method
9. Verify subtotal, tax, shipping, total
10. Click "Place Order"

**Expected Results**:
- Order review shows all details
- All information accurate
- Edit options available
- Total calculation correct
- Place order button works
- Order confirmation generated

---

### TC-26: Checkout - Tax Calculation
**Priority**: Medium  
**Category**: Checkout

**Test Steps**:
1. Add items to cart
2. Proceed to checkout
3. Enter shipping address in taxable region
4. Verify tax calculated and displayed
5. Verify tax rate appropriate for region
6. Verify total includes tax
7. Change to non-taxable region
8. Verify tax updates or removes

**Expected Results**:
- Tax calculated correctly based on location
- Tax amount clearly itemized
- Tax rate displayed
- Total includes tax
- Tax updates with address changes

---

### TC-27: Product Details View
**Priority**: Medium  
**Category**: Product Browsing

**Test Steps**:
1. Navigate to shopping page
2. Click on a product image or name
3. Verify product details page opens
4. Verify product information displayed:
   - Full description
   - Specifications
   - Reviews
   - Rating
   - Availability
   - Add to cart button
5. Add to cart from details page
6. Verify cart updates

**Expected Results**:
- Product details page loads
- All product information visible
- Images display correctly
- Add to cart works from details page
- Back/breadcrumb navigation available

---

### TC-28: Theme Toggle Functionality
**Priority**: Low  
**Category**: UI/UX

**Test Steps**:
1. Navigate to shopping page (default theme)
2. Click "Toggle theme" button
3. Verify theme switches (light ↔ dark)
4. Verify all elements visible in new theme
5. Add items to cart
6. Toggle theme again
7. Verify cart persists
8. Refresh page
9. Verify theme preference saved

**Expected Results**:
- Theme toggles successfully
- All elements readable in both themes
- User actions persist across theme changes
- Theme preference saved in browser
- No broken UI elements

---

### TC-29: Empty Cart Validation
**Priority**: Medium  
**Category**: Cart Operations

**Test Steps**:
1. Navigate to shopping page with empty cart
2. Click on cart button
3. Verify empty cart message
4. Verify no checkout button available
5. Verify "Continue Shopping" link present
6. Click continue shopping
7. Verify returns to shop

**Expected Results**:
- Empty cart message displayed
- Checkout disabled with empty cart
- Clear call-to-action to shop
- Navigation back to shopping works

---

### TC-30: Responsive Design - Mobile View
**Priority**: Medium  
**Category**: Responsive Design

**Test Steps**:
1. Open shopping page on mobile device or resize browser
2. Verify mobile layout activates
3. Verify filters accessible (hamburger/accordion)
4. Verify products display in grid/list
5. Verify cart accessible
6. Test all functionality on mobile:
   - Search
   - Filter
   - Sort
   - Add to cart
   - Pagination
7. Complete checkout on mobile

**Expected Results**:
- Responsive design activates appropriately
- All features accessible on mobile
- Touch-friendly interface
- No horizontal scrolling
- Forms easy to fill on mobile
- Checkout completes successfully

---

## 5. Priority Matrix

| Priority | Test Cases |
|----------|------------|
| **Critical** | TC-10, TC-11, TC-13, TC-20, TC-21, TC-24 |
| **High** | TC-01, TC-02, TC-03, TC-07, TC-12, TC-14, TC-15, TC-23, TC-25 |
| **Medium** | TC-04, TC-05, TC-06, TC-08, TC-09, TC-16, TC-17, TC-18, TC-19, TC-22, TC-26, TC-27, TC-29, TC-30 |
| **Low** | TC-28 |

---

## 6. Test Data Requirements

### User Accounts
- Valid user: username/email + password
- Invalid user: incorrect credentials
- Guest user: no account

### Products
- Various categories (Electronics, Accessories, Office Supplies, Furniture)
- Different price ranges ($14.99 - $199.99)
- Different ratings (3★, 4★, 5★)
- In stock and out of stock items
- Sale and regular price items

### Payment Information
- Test credit cards
- Test PayPal account (if applicable)
- Various billing addresses

### Coupon Codes
- Valid coupons: percentage and fixed amount
- Expired coupons
- Invalid coupons

---

## 7. Environment Setup

### Pre-requisites
1. Browser drivers installed (ChromeDriver, GeckoDriver)
2. Selenium WebDriver configured
3. Test framework installed (pytest, unittest, etc.)
4. Test data prepared
5. Environment variables configured

### Configuration
```python
BASE_URL = "https://practiceautomatedtesting.com/shopping"
BROWSER = "chrome"
IMPLICIT_WAIT = 10
EXPLICIT_WAIT = 30
```

---

## 8. Execution Strategy

### Phase 1: Smoke Tests (Critical)
- TC-10: Add Single Item to Cart
- TC-13: View Cart  
- TC-20: Guest Checkout Flow

### Phase 2: Core Features (High Priority)
- All search, filter, sort tests
- All cart operation tests
- All checkout tests

### Phase 3: Extended Features (Medium Priority)
- Pagination tests
- Product details tests
- Responsive design tests

### Phase 4: Nice-to-Have (Low Priority)
- Theme toggle
- Additional UI/UX tests

---

## 9. Success Criteria

- ✅ All Critical tests pass: 100%
- ✅ All High priority tests pass: ≥95%
- ✅ All Medium priority tests pass: ≥90%
- ✅ Low priority tests pass: ≥80%
- ✅ No critical bugs identified
- ✅ Performance acceptable (page load <3s)

---

## 10. Defect Tracking

Any defects found during testing should be logged with:
- **Defect ID**
- **Test Case ID**
- **Severity**: Critical, High, Medium, Low
- **Description**: Clear description of issue
- **Steps to Reproduce**
- **Expected vs Actual Result**
- **Screenshots/Videos**
- **Environment Details**

---

## 11. Automation Scope

All test cases in this plan can be automated using Selenium WebDriver with pytest/unittest framework.

### Recommended Automation Priority:
1. **Phase 1**: Critical cart and checkout flows (TC-10, TC-13, TC-20)
2. **Phase 2**: Search, filter, sort (TC-01, TC-02, TC-03, TC-07, TC-08, TC-09)
3. **Phase 3**: Cart operations (TC-11, TC-12, TC-14, TC-15)
4. **Phase 4**: Complete checkout scenarios (TC-21, TC-22, TC-23, TC-24, TC-25)
5. **Phase 5**: Pagination and edge cases (TC-16, TC-17, TC-18, TC-19)

---

## 12. Notes

- Tests should be independent and can run in any order
- Clean up cart before each test (or use fresh browser session)
- Consider data-driven testing for filter combinations
- Implement Page Object Model for maintainability
- Add explicit waits for dynamic elements
- Capture screenshots on test failures
- Log all actions for debugging

---

**Document Version**: 1.0  
**Created**: 2025-11-22  
**Test Framework**: Selenium WebDriver + pytest/unittest  
**Estimated Effort**: 40-60 hours for complete automation