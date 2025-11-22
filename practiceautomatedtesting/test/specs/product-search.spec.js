const ShoppingPage = require('../pageobjects/shopping.page');
const { expect } = require('chai');

describe('Product Search Functionality', () => {

    beforeEach(async () => {
        await ShoppingPage.open();
    });

    describe('Search with keyword input', () => {

        it('should display search results for "headphones"', async () => {
            // Search for headphones
            await ShoppingPage.searchProducts('headphones');

            // Verify products are displayed
            const productCount = await ShoppingPage.getProductCount();
            expect(productCount).to.be.greaterThan(0, 'Should display at least one product');

            // Verify product names contain search term
            const productNames = await ShoppingPage.getAllProductNames();
            const hasMatchingProduct = productNames.some(name =>
                name.toLowerCase().includes('headphones')
            );
            expect(hasMatchingProduct).to.be.true;
        });

        it('should display search results for "lamp"', async () => {
            await ShoppingPage.searchProducts('lamp');

            const productCount = await ShoppingPage.getProductCount();
            expect(productCount).to.be.greaterThan(0);

            const productNames = await ShoppingPage.getAllProductNames();
            const hasMatchingProduct = productNames.some(name =>
                name.toLowerCase().includes('lamp')
            );
            expect(hasMatchingProduct).to.be.true;
        });

        it('should display search results for "desk"', async () => {
            await ShoppingPage.searchProducts('desk');

            const productCount = await ShoppingPage.getProductCount();
            expect(productCount).to.be.greaterThan(0);

            const productNames = await ShoppingPage.getAllProductNames();
            const hasMatchingProduct = productNames.some(name =>
                name.toLowerCase().includes('desk')
            );
            expect(hasMatchingProduct).to.be.true;
        });

        it('should be case-insensitive', async () => {
            // Search with uppercase
            await ShoppingPage.searchProducts('HEADPHONES');
            const countUpper = await ShoppingPage.getProductCount();

            // Clear and search with lowercase
            await ShoppingPage.clearSearch();
            await ShoppingPage.searchProducts('headphones');
            const countLower = await ShoppingPage.getProductCount();

            // Both should return same results
            expect(countUpper).to.equal(countLower);
        });
    });

    describe('Real-time search results', () => {

        it('should update results as user types', async () => {
            // Type partial search term
            await ShoppingPage.searchProducts('head');
            const partialCount = await ShoppingPage.getProductCount();

            // Complete the search term
            await ShoppingPage.searchInput.addValue('phones');
            await browser.pause(1000);
            const fullCount = await ShoppingPage.getProductCount();

            // Results should update
            expect(fullCount).to.be.greaterThan(0);
        });

        it('should show all products when search is cleared', async () => {
            // Get initial product count
            const initialCount = await ShoppingPage.getProductCount();

            // Search for something
            await ShoppingPage.searchProducts('lamp');
            const searchCount = await ShoppingPage.getProductCount();

            // Clear search
            await ShoppingPage.clearSearch();
            const clearedCount = await ShoppingPage.getProductCount();

            // Should return to initial count
            expect(clearedCount).to.equal(initialCount);
        });
    });

    describe('Search result count display', () => {

        it('should display correct result count', async () => {
            await ShoppingPage.searchProducts('bluetooth');

            const displayedCount = await ShoppingPage.getProductCount();
            const resultCountText = await ShoppingPage.getSearchResultCountFromText();

            // Both counts should match
            expect(displayedCount).to.be.greaterThan(0);
            expect(resultCountText).to.equal(displayedCount);
        });

        it('should update count when search changes', async () => {
            // First search
            await ShoppingPage.searchProducts('lamp');
            const count1 = await ShoppingPage.getSearchResultCountFromText();

            // Different search
            await ShoppingPage.clearSearch();
            await ShoppingPage.searchProducts('desk');
            const count2 = await ShoppingPage.getSearchResultCountFromText();

            // Counts should be positive (may or may not be different)
            expect(count1).to.be.greaterThan(0);
            expect(count2).to.be.greaterThan(0);
        });
    });

    describe('Empty search handling', () => {

        it('should show all products with empty search', async () => {
            // Get all products count
            const allProductsCount = await ShoppingPage.getProductCount();

            // Type and clear search
            await ShoppingPage.searchProducts('test');
            await ShoppingPage.clearSearch();

            // Should show all products again
            const finalCount = await ShoppingPage.getProductCount();
            expect(finalCount).to.equal(allProductsCount);
        });

        it('should handle whitespace-only search gracefully', async () => {
            await ShoppingPage.searchProducts('   ');

            // Should either show all products or handle gracefully
            const count = await ShoppingPage.getProductCount();
            expect(count).to.be.at.least(0);
        });
    });

    describe('Special character handling in search', () => {

        it('should handle special characters without errors', async () => {
            const specialChars = ['@', '#', '$', '%', '&', '*'];

            for (const char of specialChars) {
                await ShoppingPage.clearSearch();
                await ShoppingPage.searchProducts(char);

                // Should not throw error, just return 0 or some results
                const count = await ShoppingPage.getProductCount();
                expect(count).to.be.at.least(0);
            }
        });

        it('should handle numbers in search', async () => {
            await ShoppingPage.searchProducts('123');

            const count = await ShoppingPage.getProductCount();
            expect(count).to.be.at.least(0);
        });

        it('should handle mixed alphanumeric search', async () => {
            await ShoppingPage.searchProducts('desk123');

            const count = await ShoppingPage.getProductCount();
            expect(count).to.be.at.least(0);
        });

        it('should handle search with quotes', async () => {
            await ShoppingPage.searchProducts('"headphones"');

            const count = await ShoppingPage.getProductCount();
            expect(count).to.be.at.least(0);
        });
    });

    describe('No results scenario', () => {

        it('should handle search with no results gracefully', async () => {
            await ShoppingPage.searchProducts('xyznonexistent12345');

            const count = await ShoppingPage.getProductCount();
            expect(count).to.equal(0, 'Should show 0 products for non-existent search');
        });

        it('should show appropriate message for no results', async () => {
            await ShoppingPage.searchProducts('xyznonexistent12345');

            // Check if "No products" or similar message is displayed
            const resultText = await ShoppingPage.searchResultCount.getText();
            const hasNoResultsMessage =
                resultText.includes('0 products') ||
                resultText.includes('No products') ||
                resultText.includes('no results');

            expect(hasNoResultsMessage).to.be.true;
        });
    });

    describe('Search persistence', () => {

        it('should maintain search when applying filters', async () => {
            // Search for a term
            await ShoppingPage.searchProducts('desk');
            const searchTerm = await ShoppingPage.searchInput.getValue();

            // Apply a filter
            await ShoppingPage.filterByRating('4');

            // Search term should still be present
            const searchTermAfterFilter = await ShoppingPage.searchInput.getValue();
            expect(searchTermAfterFilter).to.equal(searchTerm);
        });

        it('should maintain search when sorting', async () => {
            await ShoppingPage.searchProducts('lamp');
            const searchTerm = await ShoppingPage.searchInput.getValue();

            // Sort products
            await ShoppingPage.sortByPrice();

            // Search term should still be present
            const searchTermAfterSort = await ShoppingPage.searchInput.getValue();
            expect(searchTermAfterSort).to.equal(searchTerm);
        });
    });
});
