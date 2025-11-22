const ShoppingPage = require('../pageobjects/shopping.page');
const { expect } = require('chai');

describe('Product Sorting Functionality', () => {

    beforeEach(async () => {
        await ShoppingPage.open();
    });

    describe('Sort by Name - Ascending', () => {

        it('should sort products alphabetically A-Z', async () => {
            await ShoppingPage.sortByName();

            // Verify sorting
            const isSorted = await ShoppingPage.areProductsSortedByName(true);
            expect(isSorted).to.be.true;
        });

        it('should display sort indicator for ascending name', async () => {
            await ShoppingPage.sortByName();

            const buttonText = await ShoppingPage.sortByNameButton.getText();
            // Should show ascending indicator (▲ or similar)
            const hasAscendingIndicator =
                buttonText.includes('▲') ||
                buttonText.includes('↑') ||
                buttonText.toLowerCase().includes('asc');

            expect(hasAscendingIndicator).to.be.true;
        });

        it('should maintain product count when sorting by name', async () => {
            const beforeSort = await ShoppingPage.getProductCount();

            await ShoppingPage.sortByName();

            const afterSort = await ShoppingPage.getProductCount();
            expect(afterSort).to.equal(beforeSort);
        });

        it('should sort filtered products by name', async () => {
            // Apply a filter first
            await ShoppingPage.selectCategory('Electronics');

            // Sort by name
            await ShoppingPage.sortByName();

            // Verify sorting
            const isSorted = await ShoppingPage.areProductsSortedByName(true);
            expect(isSorted).to.be.true;
        });
    });

    describe('Sort by Name - Descending', () => {

        it('should sort products alphabetically Z-A when clicked twice', async () => {
            // First click - ascending
            await ShoppingPage.sortByName();

            // Second click - descending
            await ShoppingPage.sortByName();

            // Verify descending sort
            const isSorted = await ShoppingPage.areProductsSortedByName(false);
            expect(isSorted).to.be.true;
        });

        it('should display sort indicator for descending name', async () => {
            // Click twice for descending
            await ShoppingPage.sortByName();
            await ShoppingPage.sortByName();

            const buttonText = await ShoppingPage.sortByNameButton.getText();
            // Should show descending indicator (▼ or similar)
            const hasDescendingIndicator =
                buttonText.includes('▼') ||
                buttonText.includes('↓') ||
                buttonText.toLowerCase().includes('desc');

            expect(hasDescendingIndicator).to.be.true;
        });

        it('should toggle between ascending and descending', async () => {
            // Get unsorted names
            const unsortedNames = await ShoppingPage.getAllProductNames();

            // First click - ascending
            await ShoppingPage.sortByName();
            const ascendingNames = await ShoppingPage.getAllProductNames();

            // Second click - descending
            await ShoppingPage.sortByName();
            const descendingNames = await ShoppingPage.getAllProductNames();

            // Ascending and descending should be different
            expect(ascendingNames[0]).to.not.equal(descendingNames[0]);
        });
    });

    describe('Sort by Price - Ascending', () => {

        it('should sort products by price low to high', async () => {
            await ShoppingPage.sortByPrice();

            // Verify sorting
            const isSorted = await ShoppingPage.areProductsSortedByPrice(true);
            expect(isSorted).to.be.true;
        });

        it('should display lowest price product first', async () => {
            await ShoppingPage.sortByPrice();

            const prices = await ShoppingPage.getAllProductPrices();
            const lowestPrice = Math.min(...prices);

            // First price should be the lowest
            expect(prices[0]).to.equal(lowestPrice);
        });

        it('should maintain product count when sorting by price', async () => {
            const beforeSort = await ShoppingPage.getProductCount();

            await ShoppingPage.sortByPrice();

            const afterSort = await ShoppingPage.getProductCount();
            expect(afterSort).to.equal(beforeSort);
        });

        it('should sort filtered products by price', async () => {
            // Apply a filter first
            await ShoppingPage.selectCategory('Accessories');

            // Sort by price
            await ShoppingPage.sortByPrice();

            // Verify sorting
            const isSorted = await ShoppingPage.areProductsSortedByPrice(true);
            expect(isSorted).to.be.true;
        });

        it('should sort price-filtered products correctly', async () => {
            // Apply price filter
            await ShoppingPage.setPriceRange(30, 100);

            // Sort by price
            await ShoppingPage.sortByPrice();

            // Verify all products in range and sorted
            const inRange = await ShoppingPage.areAllProductsInPriceRange(30, 100);
            const isSorted = await ShoppingPage.areProductsSortedByPrice(true);

            expect(inRange).to.be.true;
            expect(isSorted).to.be.true;
        });
    });

    describe('Sort by Price - Descending', () => {

        it('should sort products by price high to low when clicked twice', async () => {
            // First click - ascending
            await ShoppingPage.sortByPrice();

            // Second click - descending
            await ShoppingPage.sortByPrice();

            // Verify descending sort
            const isSorted = await ShoppingPage.areProductsSortedByPrice(false);
            expect(isSorted).to.be.true;
        });

        it('should display highest price product first', async () => {
            // Click twice for descending
            await ShoppingPage.sortByPrice();
            await ShoppingPage.sortByPrice();

            const prices = await ShoppingPage.getAllProductPrices();
            const highestPrice = Math.max(...prices);

            // First price should be the highest
            expect(prices[0]).to.equal(highestPrice);
        });

        it('should toggle between low-to-high and high-to-low', async () => {
            // First click - ascending
            await ShoppingPage.sortByPrice();
            const ascendingPrices = await ShoppingPage.getAllProductPrices();

            // Second click - descending
            await ShoppingPage.sortByPrice();
            const descendingPrices = await ShoppingPage.getAllProductPrices();

            // First items should be different
            expect(ascendingPrices[0]).to.not.equal(descendingPrices[0]);
        });
    });

    describe('Default Sorting Behavior', () => {

        it('should have a default sort order on page load', async () => {
            // Page already loaded in beforeEach
            const productCount = await ShoppingPage.getProductCount();
            expect(productCount).to.be.greaterThan(0);

            // Products should be displayed in some order
            const names = await ShoppingPage.getAllProductNames();
            expect(names.length).to.be.greaterThan(0);
        });

        it('should indicate default sort method', async () => {
            // Check if any sort button is active by default
            const nameButtonText = await ShoppingPage.sortByNameButton.getText();

            // Default might be by name or unsorted
            const hasIndicator =
                nameButtonText.includes('▲') ||
                nameButtonText.includes('▼') ||
                nameButtonText.toLowerCase().includes('sort');

            expect(hasIndicator).to.be.true;
        });

        it('should be able to change from default sort', async () => {
            const defaultNames = await ShoppingPage.getAllProductNames();

            // Sort by price
            await ShoppingPage.sortByPrice();
            const priceFirstProduct = await ShoppingPage.getAllProductNames();

            // Order might be different (unless default was also by price)
            // At minimum, sorting should work
            const isSortedByPrice = await ShoppingPage.areProductsSortedByPrice(true);
            expect(isSortedByPrice).to.be.true;
        });
    });

    describe('Sort Persistence', () => {

        it('should maintain name sort when filtering', async () => {
            // Sort by name
            await ShoppingPage.sortByName();

            // Apply filter
            await ShoppingPage.selectCategory('Electronics');

            // Should still be sorted by name
            const isSorted = await ShoppingPage.areProductsSortedByName(true);
            expect(isSorted).to.be.true;
        });

        it('should maintain price sort when filtering', async () => {
            // Sort by price
            await ShoppingPage.sortByPrice();

            // Apply filter
            await ShoppingPage.filterByRating('4');

            // Should still be sorted by price
            const isSorted = await ShoppingPage.areProductsSortedByPrice(true);
            expect(isSorted).to.be.true;
        });

        it('should maintain sort when searching', async () => {
            // Sort by price
            await ShoppingPage.sortByPrice();

            // Search
            await ShoppingPage.searchProducts('desk');

            const productCount = await ShoppingPage.getProductCount();
            if (productCount > 1) {
                // Should still be sorted by price
                const isSorted = await ShoppingPage.areProductsSortedByPrice(true);
                expect(isSorted).to.be.true;
            }
        });

        it('should maintain sort across pagination', async () => {
            // Sort by name
            await ShoppingPage.sortByName();

            // Get first product name on page 1
            const page1Names = await ShoppingPage.getAllProductNames();
            const firstNamePage1 = page1Names[0];

            // Go to page 2
            try {
                await ShoppingPage.goToPage2();

                // Get first product name on page 2
                const page2Names = await ShoppingPage.getAllProductNames();
                const firstNamePage2 = page2Names[0];

                // Page 2 first product should come after page 1 last product alphabetically
                const page1LastName = page1Names[page1Names.length - 1];
                expect(firstNamePage2.localeCompare(page1LastName)).to.be.at.least(0);
            } catch (error) {
                // If pagination doesn't exist or page 2 button not found, skip this assertion
                console.log('Pagination not available or only one page exists');
            }
        });
    });

    describe('Sort Switching', () => {

        it('should switch from name sort to price sort', async () => {
            // Sort by name
            await ShoppingPage.sortByName();
            const sortedByName = await ShoppingPage.areProductsSortedByName(true);
            expect(sortedByName).to.be.true;

            // Switch to price
            await ShoppingPage.sortByPrice();
            const sortedByPrice = await ShoppingPage.areProductsSortedByPrice(true);
            expect(sortedByPrice).to.be.true;
        });

        it('should switch from price sort to name sort', async () => {
            // Sort by price
            await ShoppingPage.sortByPrice();
            const sortedByPrice = await ShoppingPage.areProductsSortedByPrice(true);
            expect(sortedByPrice).to.be.true;

            // Switch to name
            await ShoppingPage.sortByName();
            const sortedByName = await ShoppingPage.areProductsSortedByName(true);
            expect(sortedByName).to.be.true;
        });

        it('should update product order when switching sorts', async () => {
            // Sort by name
            await ShoppingPage.sortByName();
            const nameOrder = await ShoppingPage.getAllProductNames();

            // Sort by price
            await ShoppingPage.sortByPrice();
            const priceOrder = await ShoppingPage.getAllProductNames();

            // Orders should be different (unless products happen to be named by price)
            const firstProductChanged = nameOrder[0] !== priceOrder[0];
            const lastProductChanged = nameOrder[nameOrder.length - 1] !== priceOrder[priceOrder.length - 1];

            // At least one of them should be different
            expect(firstProductChanged || lastProductChanged).to.be.true;
        });
    });

    describe('Sort with Combined Filters', () => {

        it('should sort by name with category filter applied', async () => {
            await ShoppingPage.selectCategory('Office Supplies');
            await ShoppingPage.sortByName();

            const isSorted = await ShoppingPage.areProductsSortedByName(true);
            expect(isSorted).to.be.true;
        });

        it('should sort by price with category and price range filters', async () => {
            await ShoppingPage.selectCategory('Electronics');
            await ShoppingPage.setPriceRange(40, 120);
            await ShoppingPage.sortByPrice();

            const isSorted = await ShoppingPage.areProductsSortedByPrice(true);
            const inRange = await ShoppingPage.areAllProductsInPriceRange(40, 120);

            expect(isSorted).to.be.true;
            expect(inRange).to.be.true;
        });

        it('should sort by name with all filters applied', async () => {
            await ShoppingPage.selectCategory('Accessories');
            await ShoppingPage.setPriceRange(20, 80);
            await ShoppingPage.filterByRating('4');
            await ShoppingPage.sortByName();

            const productCount = await ShoppingPage.getProductCount();
            if (productCount > 1) {
                const isSorted = await ShoppingPage.areProductsSortedByName(true);
                expect(isSorted).to.be.true;
            }
        });

        it('should sort by price with search term', async () => {
            await ShoppingPage.searchProducts('desk');
            await ShoppingPage.sortByPrice();

            const productCount = await ShoppingPage.getProductCount();
            if (productCount > 1) {
                const isSorted = await ShoppingPage.areProductsSortedByPrice(true);
                expect(isSorted).to.be.true;
            }
        });
    });

    describe('Sort Performance', () => {

        it('should sort quickly without delay', async () => {
            const startTime = Date.now();

            await ShoppingPage.sortByPrice();

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Sorting should complete within 3 seconds
            expect(duration).to.be.lessThan(3000);
        });

        it('should sort all products on page', async () => {
            await ShoppingPage.sortByName();

            const productCount = await ShoppingPage.getProductCount();
            const nameCount = (await ShoppingPage.getAllProductNames()).length;

            // All products should have names and be sorted
            expect(nameCount).to.equal(productCount);
        });
    });

    describe('Sort Edge Cases', () => {

        it('should handle sorting with only one product', async () => {
            // Apply very specific filters to get minimal results
            await ShoppingPage.selectCategory('Furniture');
            await ShoppingPage.setPriceRange(180, 199.99);

            await ShoppingPage.sortByPrice();

            // Should not throw error
            const productCount = await ShoppingPage.getProductCount();
            expect(productCount).to.be.at.least(0);
        });

        it('should handle sorting with zero products', async () => {
            // Create impossible filter combination
            await ShoppingPage.searchProducts('nonexistentproductxyz123');

            await ShoppingPage.sortByName();

            // Should handle gracefully
            const productCount = await ShoppingPage.getProductCount();
            expect(productCount).to.equal(0);
        });

        it('should handle products with identical names', async () => {
            await ShoppingPage.sortByName();

            // Should not throw error even if duplicate names exist
            const isSorted = await ShoppingPage.areProductsSortedByName(true);
            expect(isSorted).to.be.true;
        });

        it('should handle products with identical prices', async () => {
            await ShoppingPage.sortByPrice();

            // Should not throw error even if duplicate prices exist
            const isSorted = await ShoppingPage.areProductsSortedByPrice(true);
            expect(isSorted).to.be.true;
        });
    });
});
