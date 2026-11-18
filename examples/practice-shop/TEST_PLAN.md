# Test plan: Practice Automated Testing web shop

Application: https://practiceautomatedtesting.com/shopping
Created by: Claude with the [Selenium AI Agent](https://www.npmjs.com/package/selenium-ai-agent), after an exploratory test of the shop.

## What the shop does (requirements found while exploring)

| # | Requirement |
|---|---|
| R1 | Catalogue of 10 products in 4 categories (Electronics, Accessories, Office Supplies, Furniture), 6 per page with pagination |
| R2 | Live search: results and the result counter update while typing |
| R3 | Filters: category, price range, minimum rating, in stock only, on sale only; "Clear" shows how many filters are active |
| R4 | Sorting by name or price, ascending and descending |
| R5 | Badges: SALE shows the old price crossed out; Out of Stock disables "Add to Cart" |
| R6 | Product details: price, saving ("Save $50.00!"), availability, rating, Add to Cart |
| R7 | Cart button shows the number of items and the running total |
| R8 | Checkout: billing details, payment by credit card, PayPal or iDeal (with bank choice), order summary with subtotal, free shipping, 21% VAT and total; required fields are enforced |

## Test scenario: search, filter, buy with iDeal

| Step | Action | Expected |
|---|---|---|
| 1 | Search for "chair" | 1 result: Ergonomic Chair (SALE) |
| 2 | Clear search; category Electronics, In Stock Only, sort by price | 4 products, HD Monitor (out of stock) is not shown |
| 3 | Add Mechanical Keyboard to the cart | Cart: 1 item, $89.99 |
| 4 | Search "chair", open the Ergonomic Chair | $199.99 instead of $249.99, "Save $50.00!" |
| 5 | Add to cart from the details | Cart: 2 items, $289.98 |
| 6 | Open checkout | Subtotal $289.98, shipping FREE, VAT 21% $60.90, total $350.88 |
| 7 | Fill in billing details (test data), pay with iDeal, choose a bank | No card fields for iDeal; all required fields filled |
| 8 | Place Order | "Payment Successful!" |

Test data is fictional: Test Demo, test.demo@example.com, Teststraat 1, 1011 AB Amsterdam.

## Findings

1. **No cart step.** The cart button goes straight to checkout: no quantity +/-, no Remove, no "Continue Shopping" and no "Your cart is empty", while the scenarios listed on the page describe them.
2. **After "Payment Successful!" the cart still holds the items** and no order number is shown. To check whether that is intended for the practice site.
3. A fast double click on "Add to Cart" adds the product once (possibly intended debounce).

## Run the automated test

```bash
pip install selenium pytest
pytest test_shopping_checkout.py -v
```
