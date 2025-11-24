# Shopping Filter Test Plan

## Feature: E-commerce Shopping Filters

### Test Scenarios

#### 1. Category Filter
- Verify all products are displayed when "All" is selected
- Verify only Electronics products are displayed when "Electronics" is selected
- Verify only Accessories products are displayed when "Accessories" is selected
- Verify only Office Supplies products are displayed when "Office Supplies" is selected
- Verify only Furniture products are displayed when "Furniture" is selected

#### 2. Price Range Filter
- Verify products are filtered when minimum price is adjusted
- Verify products are filtered when maximum price is adjusted
- Verify products are filtered when both min and max prices are set

#### 3. Rating Filter
- Verify all products are displayed when "All" rating is selected
- Verify only products with 3+ stars are displayed when "3★" is selected
- Verify only products with 4+ stars are displayed when "4★" is selected
- Verify only products with 5 stars are displayed when "5★" is selected

#### 4. Availability Filter
- Verify "In Stock Only" checkbox filters out-of-stock products
- Verify unchecking shows all products regardless of stock

#### 5. Deals Filter
- Verify "On Sale Only" checkbox filters products on sale
- Verify unchecking shows all products regardless of sale status

#### 6. Combined Filters
- Verify multiple filters can be applied simultaneously (Category + Price + Rating)
- Verify filter combinations work correctly

#### 7. Sorting
- Verify products can be sorted by name (ascending/descending)
- Verify products can be sorted by price

#### 8. Search with Filters
- Verify search works in combination with category filter
- Verify search results can be filtered by price range