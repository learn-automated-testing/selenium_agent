# Shopping App Test Cases
**URL:** https://practiceautomatedtesting.com/shopping

---

## 1. Search Functionality

### TC-SEARCH-001: Search with valid product name
- **Precondition:** User is on the shopping page
- **Steps:**
  1. Enter "headphones" in the search field
- **Expected Result:** Search results show 1 product (Bluetooth Headphones)

### TC-SEARCH-002: Search with partial product name
- **Precondition:** User is on the shopping page
- **Steps:**
  1. Enter "head" in the search field
- **Expected Result:** Products containing "head" in name/description are displayed

### TC-SEARCH-003: Search with non-existent product
- **Precondition:** User is on the shopping page
- **Steps:**
  1. Enter "laptop" in the search field
- **Expected Result:** "No products found matching your criteria." message displayed, 0 products shown

### TC-SEARCH-004: Clear search filter
- **Precondition:** User has searched for a product
- **Steps:**
  1. Click the "Clear (1)" button or the X in search field
- **Expected Result:** Search is cleared, all products are displayed again

### TC-SEARCH-005: Search with special characters
- **Precondition:** User is on the shopping page
- **Steps:**
  1. Enter special characters like "!@#$%" in the search field
- **Expected Result:** No products found, no application errors

---

## 2. Filter Functionality

### TC-FILTER-001: Filter by Category - Electronics
- **Precondition:** User is on the shopping page
- **Steps:**
  1. Select "Electronics" from the Category dropdown
- **Expected Result:** Only electronics products are displayed

### TC-FILTER-002: Filter by Category - Accessories
- **Precondition:** User is on the shopping page
- **Steps:**
  1. Select "Accessories" from the Category dropdown
- **Expected Result:** Only accessories products are displayed

### TC-FILTER-003: Filter by Category - Office Supplies
- **Precondition:** User is on the shopping page
- **Steps:**
  1. Select "Office Supplies" from the Category dropdown
- **Expected Result:** Only office supplies products are displayed

### TC-FILTER-004: Filter by Category - Furniture
- **Precondition:** User is on the shopping page
- **Steps:**
  1. Select "Furniture" from the Category dropdown
- **Expected Result:** Only furniture products are displayed

### TC-FILTER-005: Filter by Price Range - Minimum
- **Precondition:** User is on the shopping page
- **Steps:**
  1. Adjust the minimum price slider to $50
- **Expected Result:** Only products priced $50 or higher are displayed

### TC-FILTER-006: Filter by Price Range - Maximum
- **Precondition:** User is on the shopping page
- **Steps:**
  1. Adjust the maximum price slider to $50
- **Expected Result:** Only products priced $50 or lower are displayed

### TC-FILTER-007: Filter by Price Range - Custom Range
- **Precondition:** User is on the shopping page
- **Steps:**
  1. Set minimum price to $25
  2. Set maximum price to $75
- **Expected Result:** Only products priced between $25-$75 are displayed

### TC-FILTER-008: Filter by Minimum Rating - 3 Stars
- **Precondition:** User is on the shopping page
- **Steps:**
  1. Click the "3★" rating filter button
- **Expected Result:** Only products with 3+ star rating are displayed

### TC-FILTER-009: Filter by Minimum Rating - 4 Stars
- **Precondition:** User is on the shopping page
- **Steps:**
  1. Click the "4★" rating filter button
- **Expected Result:** Only products with 4+ star rating are displayed

### TC-FILTER-010: Filter by Minimum Rating - 5 Stars
- **Precondition:** User is on the shopping page
- **Steps:**
  1. Click the "5★" rating filter button
- **Expected Result:** Only products with exactly 5 star rating are displayed

### TC-FILTER-011: Filter by Availability - In Stock Only
- **Precondition:** User is on the shopping page
- **Steps:**
  1. Check the "In Stock Only" checkbox
- **Expected Result:** Out of stock products are hidden

### TC-FILTER-012: Filter by Deals - On Sale Only
- **Precondition:** User is on the shopping page
- **Steps:**
  1. Check the "On Sale Only" checkbox
- **Expected Result:** Only products with SALE badge are displayed

### TC-FILTER-013: Combined Filters
- **Precondition:** User is on the shopping page
- **Steps:**
  1. Select "Electronics" category
  2. Set price range $20-$100
  3. Select 4★ minimum rating
  4. Check "In Stock Only"
- **Expected Result:** Only products matching ALL criteria are displayed

### TC-FILTER-014: Clear All Filters
- **Precondition:** User has multiple filters applied
- **Steps:**
  1. Click "Clear" button in filters section
- **Expected Result:** All filters are reset, all products displayed

---

## 3. Sorting Functionality

### TC-SORT-001: Sort by Name Ascending
- **Precondition:** User is on the shopping page
- **Steps:**
  1. Click "Sort by Name ▲" button
- **Expected Result:** Products are sorted alphabetically A-Z

### TC-SORT-002: Sort by Name Descending
- **Precondition:** User is on the shopping page
- **Steps:**
  1. Click "Sort by Name" button twice to toggle to descending
- **Expected Result:** Products are sorted alphabetically Z-A

### TC-SORT-003: Sort by Price Ascending
- **Precondition:** User is on the shopping page
- **Steps:**
  1. Click "Sort by Price" button
- **Expected Result:** Products are sorted by price low to high

### TC-SORT-004: Sort by Price Descending
- **Precondition:** User is on the shopping page
- **Steps:**
  1. Click "Sort by Price" button twice to toggle to descending
- **Expected Result:** Products are sorted by price high to low

### TC-SORT-005: Sort persistence with filters
- **Precondition:** User has applied a sort order
- **Steps:**
  1. Sort by Price ascending
  2. Apply a category filter
- **Expected Result:** Sort order is maintained after filtering

---

## 4. Cart Functionality

### TC-CART-001: Add single product to cart
- **Precondition:** User is on the shopping page with empty cart
- **Steps:**
  1. Click "Add to Cart" on any available product
- **Expected Result:**
  - Cart counter updates to "1 items"
  - Cart total shows product price
  - Button changes to "Added!"

### TC-CART-002: Add multiple products to cart
- **Precondition:** User is on the shopping page
- **Steps:**
  1. Add first product to cart
  2. Add second product to cart
- **Expected Result:** Cart counter shows "2 items", total is sum of both prices

### TC-CART-003: Cannot add out of stock product
- **Precondition:** User is on the shopping page
- **Steps:**
  1. Locate product with "Out of Stock" button
  2. Attempt to click the button
- **Expected Result:** Button is disabled/not clickable, product not added

### TC-CART-004: Open cart/checkout modal
- **Precondition:** User has items in cart
- **Steps:**
  1. Click the cart button in header
- **Expected Result:** Checkout modal opens showing order summary

### TC-CART-005: Cart displays correct order summary
- **Precondition:** User has added Bluetooth Headphones ($59.99) to cart
- **Steps:**
  1. Open cart modal
- **Expected Result:**
  - Product: Bluetooth Headphones - $59.99
  - Subtotal: $59.99
  - Shipping: FREE
  - Tax (21%): $12.60
  - Total: $72.59

### TC-CART-006: Cart persists on page refresh
- **Precondition:** User has items in cart
- **Steps:**
  1. Refresh the page
- **Expected Result:** Cart maintains items (Note: Current behavior clears cart - potential bug)

---

## 5. Checkout Functionality

### TC-CHECKOUT-001: Verify shipping form fields
- **Precondition:** User opens checkout modal
- **Steps:**
  1. Verify all fields are present
- **Expected Result:** Fields present: Email*, Phone*, Address*, City*, Zip Code*, Country*

### TC-CHECKOUT-002: Country dropdown options
- **Precondition:** User opens checkout modal
- **Steps:**
  1. Click Country dropdown
- **Expected Result:** Options include: Netherlands, Belgium, Germany, France, United Kingdom

### TC-CHECKOUT-003: Payment method - Credit Card
- **Precondition:** User opens checkout modal
- **Steps:**
  1. Select "Credit Card" payment method
- **Expected Result:** Credit card form fields appear (Card Number, Expiry, CVV, Cardholder Name)

### TC-CHECKOUT-004: Payment method - PayPal
- **Precondition:** User opens checkout modal
- **Steps:**
  1. Select "PayPal" payment method
- **Expected Result:** PayPal payment flow/fields are displayed

### TC-CHECKOUT-005: Payment method - iDeal
- **Precondition:** User opens checkout modal
- **Steps:**
  1. Select "iDeal" payment method
- **Expected Result:** iDeal bank selection is displayed

### TC-CHECKOUT-006: Submit order with valid data
- **Precondition:** User has items in cart and checkout modal open
- **Steps:**
  1. Fill in all required shipping fields
  2. Select Credit Card payment
  3. Fill in valid card details
  4. Click "Place Order"
- **Expected Result:** Order is submitted successfully, confirmation displayed

### TC-CHECKOUT-007: Submit order with missing required fields
- **Precondition:** User has checkout modal open
- **Steps:**
  1. Leave Email field empty
  2. Click "Place Order"
- **Expected Result:** Validation error displayed for Email field

### TC-CHECKOUT-008: Email validation
- **Precondition:** User has checkout modal open
- **Steps:**
  1. Enter invalid email format (e.g., "notanemail")
  2. Click "Place Order"
- **Expected Result:** Validation error for invalid email format

### TC-CHECKOUT-009: Credit card number validation
- **Precondition:** User has checkout modal open with Credit Card selected
- **Steps:**
  1. Enter invalid card number (e.g., "1234")
  2. Click "Place Order"
- **Expected Result:** Validation error for invalid card number

### TC-CHECKOUT-010: Tax calculation
- **Precondition:** User has items in cart
- **Steps:**
  1. Add product worth $100 to cart
  2. Open checkout
- **Expected Result:** Tax is calculated at 21% of subtotal

---

## 6. Pagination Functionality

### TC-PAGE-001: Navigate to page 2
- **Precondition:** User is on shopping page with multiple pages of products
- **Steps:**
  1. Click "Page 2" or "Next page" button
- **Expected Result:** Page 2 products are displayed

### TC-PAGE-002: Navigate back to page 1
- **Precondition:** User is on page 2
- **Steps:**
  1. Click "Page 1" or "Previous page" button
- **Expected Result:** Page 1 products are displayed

### TC-PAGE-003: Previous button disabled on first page
- **Precondition:** User is on page 1
- **Steps:**
  1. Observe "Previous page" button state
- **Expected Result:** Previous button is disabled

### TC-PAGE-004: Pagination with filters
- **Precondition:** User has applied filters reducing results to 1 page
- **Steps:**
  1. Apply restrictive filter
- **Expected Result:** Pagination adjusts to show correct number of pages

### TC-PAGE-005: Product count display
- **Precondition:** User is on shopping page
- **Steps:**
  1. Observe "Search Results (X products)" count
- **Expected Result:** Count accurately reflects number of products matching current filters

---

## 7. Product Display

### TC-PRODUCT-001: Product card displays all information
- **Precondition:** User is on shopping page
- **Steps:**
  1. Observe any product card
- **Expected Result:** Card shows: Image, Name, Category, Rating (stars + count), Description, Price, Add to Cart button

### TC-PRODUCT-002: SALE badge display
- **Precondition:** User is on shopping page
- **Steps:**
  1. Locate product with sale
- **Expected Result:** Red "SALE" badge is visible on product card

### TC-PRODUCT-003: Out of Stock badge display
- **Precondition:** User is on shopping page
- **Steps:**
  1. Locate out of stock product
- **Expected Result:** "Out of Stock" label displayed, Add to Cart button disabled/replaced

---

## 8. UI/Theme

### TC-THEME-001: Toggle dark/light theme
- **Precondition:** User is on shopping page
- **Steps:**
  1. Click theme toggle button in header
- **Expected Result:** Theme switches between dark and light mode

### TC-THEME-002: Theme persistence
- **Precondition:** User has selected a theme
- **Steps:**
  1. Refresh the page
- **Expected Result:** Selected theme is maintained

---

## 9. Navigation

### TC-NAV-001: Login link navigation
- **Precondition:** User is on shopping page
- **Steps:**
  1. Click "Login" link in header
- **Expected Result:** **BUG FOUND** - Returns 404 page not found

### TC-NAV-002: Navigate to other sections
- **Precondition:** User is on shopping page
- **Steps:**
  1. Click "Web Elements" in navigation
- **Expected Result:** User is navigated to Web Elements section

---

## 10. Negative/Edge Cases

### TC-EDGE-001: Empty cart checkout
- **Precondition:** User has empty cart
- **Steps:**
  1. Try to open cart/checkout
- **Expected Result:** Appropriate message or disabled checkout

### TC-EDGE-002: Very long search query
- **Precondition:** User is on shopping page
- **Steps:**
  1. Enter 500+ character search query
- **Expected Result:** Application handles gracefully without errors

### TC-EDGE-003: Price filter - min greater than max
- **Precondition:** User is on shopping page
- **Steps:**
  1. Set min price higher than max price
- **Expected Result:** Application prevents invalid range or shows 0 results

### TC-EDGE-004: Rapid filter changes
- **Precondition:** User is on shopping page
- **Steps:**
  1. Quickly toggle multiple filters on and off
- **Expected Result:** UI remains responsive, no race conditions

---

## Known Issues

1. **Login Page 404** - The login link in the header navigates to `/login` which returns a 404 error
2. **Cart Not Persistent** - Cart items are cleared on page refresh

---

## Test Data

| Product | Category | Price | Rating | Availability |
|---------|----------|-------|--------|--------------|
| Bluetooth Headphones | Accessories | $59.99 | 5 stars | In Stock |
| Desk Lamp | Office Supplies | $24.99 | 4 stars | In Stock |
| Monitor (assumed) | Electronics | - | - | Out of Stock |

---

## Locators Reference

```python
# Search
search_input = "[data-testid='search-input']" or "input[placeholder='Search for items']"

# Filters
category_dropdown = "select"
price_min_slider = "input[type='range']:first"
price_max_slider = "input[type='range']:last"
rating_all_btn = "button:contains('All')"
rating_3_btn = "button:contains('3★')"
rating_4_btn = "button:contains('4★')"
rating_5_btn = "button:contains('5★')"

# Cart
cart_button = "[data-testid='cart-button']"
add_to_cart_btn = "button:contains('Add to Cart')"

# Checkout
email_input = "input[type='email']"
place_order_btn = "button:contains('Place Order')"

# Pagination
next_page_btn = "button:contains('Next page')"
prev_page_btn = "button:contains('Previous page')"
```
