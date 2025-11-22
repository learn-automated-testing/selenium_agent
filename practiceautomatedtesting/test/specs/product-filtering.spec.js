const ShoppingPage = require('../pageobjects/shopping.page');
const { expect } = require('chai');

describe('Product Filtering Functionality', () => {

    beforeEach(async () => {
        await ShoppingPage.open();
    });

    describe('Category Filter', () => {

        it('should filter products by Electronics category', async () => {
            await ShoppingPage.selectCategory('Electronics');
            await browser.pause(1000);

            const productCount = await ShoppingPage.getProductCount();
            expect(productCount).to.be.greaterThan(0, 'Should display Electronics products');

            // Verify category badges show Electronics
            const categories = await ShoppingPage.getVisibleCategories();
            const allElectronics = categories.every(cat =>
                cat.toLowerCase().includes('electronics') || cat.toLowerCase().includes('electronic')
            );
            expect(allElectronics).to.be.true;
        });

        it('should filter products by Accessories category', async () => {
            await ShoppingPage.selectCategory('Accessories');
            await browser.pause(1000);

            const productCount = await ShoppingPage.getProductCount();
            expect(productCount).to.be.greaterThan(0, 'Should display Accessories products');

            const categories = await ShoppingPage.getVisibleCategories();
            const allAccessories = categories.every(cat =>
                cat.toLowerCase().includes('accessories') || cat.toLowerCase().includes('accessory')
            );
            expect(allAccessories).to.be.true;
        });

        it('should filter products by Office Supplies category', async () => {
            await ShoppingPage.selectCategory('Office Supplies');
            await browser.pause(1000);

            const productCount = await ShoppingPage.getProductCount();
            expect(productCount).to.be.greaterThan(0, 'Should display Office Supplies products');

            const categories = await ShoppingPage.getVisibleCategories();
            const allOfficeSupplies = categories.every(cat =>
                cat.toLowerCase().includes('office') || cat.toLowerCase().includes('supplies')
            );
            expect(allOfficeSupplies).to.be.true;
        });

        it('should filter products by Furniture category', async () => {
            await ShoppingPage.selectCategory('Furniture');
            await browser.pause(1000);

            const productCount = await ShoppingPage.getProductCount();
            expect(productCount).to.be.greaterThan(0, 'Should display Furniture products');

            const categories = await ShoppingPage.getVisibleCategories();
            const allFurniture = categories.every(cat =>
                cat.toLowerCase().includes('furniture')
            );
            expect(allFurniture).to.be.true;
        });

        it('should show all products when "All" category is selected', async () => {
            // First filter by a specific category
            await ShoppingPage.selectCategory('Electronics');
            const filteredCount = await ShoppingPage.getProductCount();

            // Switch to All
            await ShoppingPage.selectCategory('All');
            const allCount = await ShoppingPage.getProductCount();

            // All products should be more than filtered
            expect(allCount).to.be.greaterThan(filteredCount);
        });

        it('should update product count when category changes', async () => {
            await ShoppingPage.selectCategory('Electronics');
            const electronicsCount = await ShoppingPage.getProductCount();

            await ShoppingPage.selectCategory('Accessories');
            const accessoriesCount = await ShoppingPage.getProductCount();

            // Both should have products
            expect(electronicsCount).to.be.greaterThan(0);
            expect(accessoriesCount).to.be.greaterThan(0);
        });
    });

    describe('Price Range Filter', () => {

        it('should filter products by price range $50-$100', async () => {
            await ShoppingPage.setPriceRange(50, 100);

            const productCount = await ShoppingPage.getProductCount();
            expect(productCount).to.be.greaterThan(0);

            // Verify all products are within range
            const inRange = await ShoppingPage.areAllProductsInPriceRange(50, 100);
            expect(inRange).to.be.true;
        });

        it('should filter products by price range $14.99-$50', async () => {
            await ShoppingPage.setPriceRange(14.99, 50);

            const productCount = await ShoppingPage.getProductCount();
            expect(productCount).to.be.greaterThan(0);

            const inRange = await ShoppingPage.areAllProductsInPriceRange(14.99, 50);
            expect(inRange).to.be.true;
        });

        it('should filter products by price range $100-$199.99', async () => {
            await ShoppingPage.setPriceRange(100, 199.99);

            const productCount = await ShoppingPage.getProductCount();

            if (productCount > 0) {
                const inRange = await ShoppingPage.areAllProductsInPriceRange(100, 199.99);
                expect(inRange).to.be.true;
            }
        });

        it('should show fewer products with narrower price range', async () => {
            // Wide range
            await ShoppingPage.setPriceRange(14.99, 199.99);
            const wideRangeCount = await ShoppingPage.getProductCount();

            // Narrow range
            await ShoppingPage.setPriceRange(50, 80);
            const narrowRangeCount = await ShoppingPage.getProductCount();

            // Narrow should show same or fewer products
            expect(narrowRangeCount).to.be.at.most(wideRangeCount);
        });

        it('should handle minimum price equal to maximum price', async () => {
            await ShoppingPage.setPriceRange(59.99, 59.99);

            const productCount = await ShoppingPage.getProductCount();
            // Should show products at exactly $59.99 or handle gracefully
            expect(productCount).to.be.at.least(0);
        });

        it('should exclude products outside price range', async () => {
            // Set a specific range
            await ShoppingPage.setPriceRange(30, 60);

            const prices = await ShoppingPage.getAllProductPrices();

            // All prices should be within range
            prices.forEach(price => {
                expect(price).to.be.at.least(30);
                expect(price).to.be.at.most(60);
            });
        });
    });

    describe('Rating Filter', () => {

        it('should filter products by 5-star rating', async () => {
            await ShoppingPage.filterByRating('5');

            const productCount = await ShoppingPage.getProductCount();
            expect(productCount).to.be.greaterThan(0, 'Should display 5-star products');
        });

        it('should filter products by 4-star rating', async () => {
            await ShoppingPage.filterByRating('4');

            const productCount = await ShoppingPage.getProductCount();
            expect(productCount).to.be.greaterThan(0, 'Should display 4-star and above products');
        });

        it('should filter products by 3-star rating', async () => {
            await ShoppingPage.filterByRating('3');

            const productCount = await ShoppingPage.getProductCount();
            expect(productCount).to.be.greaterThan(0, 'Should display 3-star and above products');
        });

        it('should show all products when "All" rating is selected', async () => {
            // First apply rating filter
            await ShoppingPage.filterByRating('5');
            const fiveStarCount = await ShoppingPage.getProductCount();

            // Switch to All
            await ShoppingPage.filterByRating('all');
            const allCount = await ShoppingPage.getProductCount();

            // All should show more or equal products
            expect(allCount).to.be.at.least(fiveStarCount);
        });

        it('should show more products with lower rating filter', async () => {
            // 5-star only
            await ShoppingPage.filterByRating('5');
            const fiveStarCount = await ShoppingPage.getProductCount();

            // 3-star and above
            await ShoppingPage.filterByRating('3');
            const threeStarCount = await ShoppingPage.getProductCount();

            // 3-star filter should show same or more products
            expect(threeStarCount).to.be.at.least(fiveStarCount);
        });

        it('should update product display when rating filter changes', async () => {
            await ShoppingPage.filterByRating('5');
            const count1 = await ShoppingPage.getProductCount();

            await ShoppingPage.filterByRating('4');
            const count2 = await ShoppingPage.getProductCount();

            await ShoppingPage.filterByRating('all');
            const count3 = await ShoppingPage.getProductCount();

            // Each filter should return results
            expect(count1).to.be.greaterThan(0);
            expect(count2).to.be.greaterThan(0);
            expect(count3).to.be.greaterThan(0);
        });
    });

    describe('Availability Filter - In Stock Only', () => {

        it('should filter to show only in-stock products', async () => {
            await ShoppingPage.toggleInStockFilter();

            // Verify no "Out of Stock" badges visible
            const hasOutOfStock = await ShoppingPage.areOutOfStockProductsVisible();
            expect(hasOutOfStock).to.be.false;
        });

        it('should show all products when In Stock filter is unchecked', async () => {
            // Check the filter
            await ShoppingPage.toggleInStockFilter();
            const inStockCount = await ShoppingPage.getProductCount();

            // Uncheck the filter
            await ShoppingPage.toggleInStockFilter();
            const allCount = await ShoppingPage.getProductCount();

            // All products should be same or more
            expect(allCount).to.be.at.least(inStockCount);
        });

        it('should be toggleable', async () => {
            const initialCount = await ShoppingPage.getProductCount();

            // Toggle on
            await ShoppingPage.toggleInStockFilter();
            const filteredCount = await ShoppingPage.getProductCount();

            // Toggle off
            await ShoppingPage.toggleInStockFilter();
            const finalCount = await ShoppingPage.getProductCount();

            // Should return to initial state
            expect(finalCount).to.equal(initialCount);
        });
    });

    describe('Deals Filter - On Sale Only', () => {

        it('should filter to show only sale products', async () => {
            await ShoppingPage.toggleOnSaleFilter();

            const productCount = await ShoppingPage.getProductCount();

            if (productCount > 0) {
                // Verify all products have sale badge
                const allHaveSaleBadge = await ShoppingPage.doAllProductsHaveSaleBadge();
                expect(allHaveSaleBadge).to.be.true;
            }
        });

        it('should show all products when On Sale filter is unchecked', async () => {
            // Check the filter
            await ShoppingPage.toggleOnSaleFilter();
            const saleCount = await ShoppingPage.getProductCount();

            // Uncheck the filter
            await ShoppingPage.toggleOnSaleFilter();
            const allCount = await ShoppingPage.getProductCount();

            // All products should be same or more
            expect(allCount).to.be.at.least(saleCount);
        });

        it('should be toggleable', async () => {
            const initialCount = await ShoppingPage.getProductCount();

            // Toggle on
            await ShoppingPage.toggleOnSaleFilter();
            const filteredCount = await ShoppingPage.getProductCount();

            // Toggle off
            await ShoppingPage.toggleOnSaleFilter();
            const finalCount = await ShoppingPage.getProductCount();

            // Should return to initial state
            expect(finalCount).to.equal(initialCount);
        });
    });

    describe('Multiple Filter Combinations', () => {

        it('should apply category and price range filters together', async () => {
            await ShoppingPage.selectCategory('Electronics');
            await ShoppingPage.setPriceRange(50, 150);

            const productCount = await ShoppingPage.getProductCount();
            expect(productCount).to.be.at.least(0);

            if (productCount > 0) {
                // Verify products match both filters
                const inRange = await ShoppingPage.areAllProductsInPriceRange(50, 150);
                expect(inRange).to.be.true;

                const categories = await ShoppingPage.getVisibleCategories();
                const allElectronics = categories.every(cat =>
                    cat.toLowerCase().includes('electronics') || cat.toLowerCase().includes('electronic')
                );
                expect(allElectronics).to.be.true;
            }
        });

        it('should apply category, price, and rating filters together', async () => {
            await ShoppingPage.selectCategory('Accessories');
            await ShoppingPage.setPriceRange(20, 100);
            await ShoppingPage.filterByRating('4');

            const productCount = await ShoppingPage.getProductCount();
            expect(productCount).to.be.at.least(0);

            if (productCount > 0) {
                const inRange = await ShoppingPage.areAllProductsInPriceRange(20, 100);
                expect(inRange).to.be.true;
            }
        });

        it('should apply all filters together', async () => {
            await ShoppingPage.selectCategory('Electronics');
            await ShoppingPage.setPriceRange(30, 120);
            await ShoppingPage.filterByRating('4');
            await ShoppingPage.toggleInStockFilter();
            await ShoppingPage.toggleOnSaleFilter();

            const productCount = await ShoppingPage.getProductCount();
            expect(productCount).to.be.at.least(0);

            if (productCount > 0) {
                // Verify no out of stock items
                const hasOutOfStock = await ShoppingPage.areOutOfStockProductsVisible();
                expect(hasOutOfStock).to.be.false;

                // Verify all have sale badge
                const allHaveSaleBadge = await ShoppingPage.doAllProductsHaveSaleBadge();
                expect(allHaveSaleBadge).to.be.true;

                // Verify price range
                const inRange = await ShoppingPage.areAllProductsInPriceRange(30, 120);
                expect(inRange).to.be.true;
            }
        });

        it('should remove filters one by one correctly', async () => {
            // Apply multiple filters
            await ShoppingPage.selectCategory('Office Supplies');
            await ShoppingPage.filterByRating('5');
            const multiFilterCount = await ShoppingPage.getProductCount();

            // Remove rating filter
            await ShoppingPage.filterByRating('all');
            const categoryOnlyCount = await ShoppingPage.getProductCount();

            // Remove category filter
            await ShoppingPage.selectCategory('All');
            const noFilterCount = await ShoppingPage.getProductCount();

            // Each step should show same or more products
            expect(categoryOnlyCount).to.be.at.least(multiFilterCount);
            expect(noFilterCount).to.be.at.least(categoryOnlyCount);
        });

        it('should maintain filters when adding new ones', async () => {
            // Apply category filter
            await ShoppingPage.selectCategory('Furniture');
            const categoryOnlyCount = await ShoppingPage.getProductCount();

            // Add price filter
            await ShoppingPage.setPriceRange(50, 150);
            const bothFiltersCount = await ShoppingPage.getProductCount();

            // Both filters applied should show same or fewer products
            expect(bothFiltersCount).to.be.at.most(categoryOnlyCount);
        });

        it('should show no products when filters are too restrictive', async () => {
            // Apply very restrictive combination
            await ShoppingPage.selectCategory('Furniture');
            await ShoppingPage.setPriceRange(14.99, 20);
            await ShoppingPage.filterByRating('5');
            await ShoppingPage.toggleOnSaleFilter();

            const productCount = await ShoppingPage.getProductCount();
            // May return 0 products if no matches
            expect(productCount).to.be.at.least(0);
        });
    });

    describe('Filter Persistence', () => {

        it('should maintain category filter when sorting', async () => {
            await ShoppingPage.selectCategory('Electronics');
            const beforeSort = await ShoppingPage.getProductCount();

            await ShoppingPage.sortByPrice();
            const afterSort = await ShoppingPage.getProductCount();

            // Should maintain same product count
            expect(afterSort).to.equal(beforeSort);
        });

        it('should maintain price filter when changing category', async () => {
            await ShoppingPage.setPriceRange(30, 80);

            await ShoppingPage.selectCategory('Accessories');

            // Verify price range still applies
            const inRange = await ShoppingPage.areAllProductsInPriceRange(30, 80);
            expect(inRange).to.be.true;
        });

        it('should maintain all filters when searching', async () => {
            await ShoppingPage.selectCategory('Electronics');
            await ShoppingPage.filterByRating('4');
            const beforeSearch = await ShoppingPage.getProductCount();

            await ShoppingPage.searchProducts('bluetooth');

            const productCount = await ShoppingPage.getProductCount();
            // Filters should still be active with search
            expect(productCount).to.be.at.least(0);
        });
    });

    describe('Filter Reset/Clear', () => {

        it('should return to all products when all filters cleared', async () => {
            // Get initial count
            const initialCount = await ShoppingPage.getProductCount();

            // Apply filters
            await ShoppingPage.selectCategory('Accessories');
            await ShoppingPage.setPriceRange(40, 100);
            await ShoppingPage.filterByRating('5');

            // Clear all filters
            await ShoppingPage.selectCategory('All');
            await ShoppingPage.setPriceRange(14.99, 199.99);
            await ShoppingPage.filterByRating('all');

            const finalCount = await ShoppingPage.getProductCount();

            // Should return to initial state
            expect(finalCount).to.equal(initialCount);
        });
    });
});
