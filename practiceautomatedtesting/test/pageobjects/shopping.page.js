/**
 * Shopping Page Object
 * Contains all selectors and methods for the shopping page
 */
class ShoppingPage {
    // Navigation elements
    get shoppingLink() { return $('a[href*="/shopping"]'); }
    get homeLink() { return $('a[href="/"]'); }
    get cartButton() { return $('button*=items'); }
    get loginLink() { return $('a*=Login'); }

    // Search elements
    get searchInput() { return $('input[type="text"][placeholder*="Search"]'); }
    get searchResults() { return $$('.product-card, [class*="product"]'); }
    get searchResultCount() { return $('*=Search Results'); }

    // Filter elements - Category
    get categoryDropdown() { return $('select'); }
    getCategoryOption(category) {
        return $(`select option*=${category}`);
    }

    // Filter elements - Price Range
    get priceMinInput() { return $('input[type="number"]'); }
    get priceMaxInput() { return $$('input[type="number"]')[1]; }
    get priceMinSlider() { return $$('input[type="range"]')[0]; }
    get priceMaxSlider() { return $$('input[type="range"]')[1]; }

    // Filter elements - Rating
    get allRatingButton() { return $('button*=All'); }
    get threeStarButton() { return $('button*=3★'); }
    get fourStarButton() { return $('button*=4★'); }
    get fiveStarButton() { return $('button*=5★'); }

    // Filter elements - Availability and Deals
    get inStockCheckbox() { return $$('input[type="checkbox"]')[0]; }
    get onSaleCheckbox() { return $$('input[type="checkbox"]')[1]; }

    // Sorting elements
    get sortByNameButton() { return $('button*=Sort by Name'); }
    get sortByPriceButton() { return $('button*=Sort by Price'); }

    // Product elements
    get productCards() { return $$('[class*="product-card"], [class*="product"]'); }
    get productNames() { return $$('[class*="product"] h3, [class*="product-name"]'); }
    get productPrices() { return $$('[class*="product"] [class*="price"]'); }
    get productRatings() { return $$('[class*="product"] [class*="rating"]'); }
    get productImages() { return $$('[class*="product"] img'); }
    get productCategories() { return $$('[class*="category"], [class*="badge"]'); }
    get saleBadges() { return $$('[class*="sale"], .sale-badge'); }
    get outOfStockBadges() { return $$('*=Out of Stock'); }
    get addToCartButtons() { return $$('button*=Add to Cart'); }

    // Pagination elements
    get page1Button() { return $('button*=Page 1'); }
    get page2Button() { return $('button*=Page 2'); }
    get nextPageButton() { return $('button*=Next'); }
    get previousPageButton() { return $('button*=Previous'); }

    /**
     * Navigate to shopping page
     */
    async open() {
        await browser.url('/shopping');
        await this.waitForPageLoad();
    }

    /**
     * Wait for page to load
     */
    async waitForPageLoad() {
        await this.searchInput.waitForDisplayed({ timeout: 10000 });
        await browser.pause(1000); // Allow time for products to render
    }

    /**
     * Search for products
     * @param {string} searchTerm - The search term to enter
     */
    async searchProducts(searchTerm) {
        await this.searchInput.waitForDisplayed();
        await this.searchInput.setValue(searchTerm);
        await browser.pause(1000); // Wait for search results
    }

    /**
     * Clear search input
     */
    async clearSearch() {
        await this.searchInput.clearValue();
        await browser.pause(1000);
    }

    /**
     * Get the number of products displayed
     * @returns {number} Number of product cards
     */
    async getProductCount() {
        const products = await this.productCards;
        return products.length;
    }

    /**
     * Get search result count from text
     * @returns {number} Number from "Search Results (X products)"
     */
    async getSearchResultCountFromText() {
        const countElement = await this.searchResultCount;
        if (await countElement.isDisplayed()) {
            const text = await countElement.getText();
            const match = text.match(/\((\d+)\s+products?\)/);
            return match ? parseInt(match[1]) : 0;
        }
        return await this.getProductCount();
    }

    /**
     * Select category from dropdown
     * @param {string} category - Category name
     */
    async selectCategory(category) {
        await this.categoryDropdown.waitForDisplayed();
        await this.categoryDropdown.selectByVisibleText(category);
        await browser.pause(1000);
    }

    /**
     * Set price range using input fields
     * @param {number} min - Minimum price
     * @param {number} max - Maximum price
     */
    async setPriceRange(min, max) {
        await this.priceMinInput.setValue(min);
        await this.priceMaxInput.setValue(max);
        await browser.pause(1000);
    }

    /**
     * Click rating filter button
     * @param {string} rating - 'all', '3', '4', or '5'
     */
    async filterByRating(rating) {
        switch(rating.toLowerCase()) {
            case 'all':
                await this.allRatingButton.click();
                break;
            case '3':
                await this.threeStarButton.click();
                break;
            case '4':
                await this.fourStarButton.click();
                break;
            case '5':
                await this.fiveStarButton.click();
                break;
        }
        await browser.pause(1000);
    }

    /**
     * Toggle In Stock Only filter
     */
    async toggleInStockFilter() {
        await this.inStockCheckbox.click();
        await browser.pause(1000);
    }

    /**
     * Toggle On Sale Only filter
     */
    async toggleOnSaleFilter() {
        await this.onSaleCheckbox.click();
        await browser.pause(1000);
    }

    /**
     * Sort products by name
     */
    async sortByName() {
        await this.sortByNameButton.click();
        await browser.pause(1000);
    }

    /**
     * Sort products by price
     */
    async sortByPrice() {
        await this.sortByPriceButton.click();
        await browser.pause(1000);
    }

    /**
     * Get all product names
     * @returns {Array<string>} Array of product names
     */
    async getAllProductNames() {
        const names = await this.productNames;
        const nameTexts = [];
        for (const name of names) {
            nameTexts.push(await name.getText());
        }
        return nameTexts;
    }

    /**
     * Get all product prices
     * @returns {Array<number>} Array of product prices
     */
    async getAllProductPrices() {
        const prices = await this.productPrices;
        const priceValues = [];
        for (const price of prices) {
            const text = await price.getText();
            const value = parseFloat(text.replace(/[$,]/g, ''));
            priceValues.push(value);
        }
        return priceValues;
    }

    /**
     * Check if products are sorted alphabetically
     * @param {boolean} ascending - True for A-Z, false for Z-A
     * @returns {boolean} True if sorted correctly
     */
    async areProductsSortedByName(ascending = true) {
        const names = await this.getAllProductNames();
        for (let i = 0; i < names.length - 1; i++) {
            const compare = names[i].localeCompare(names[i + 1]);
            if (ascending && compare > 0) return false;
            if (!ascending && compare < 0) return false;
        }
        return true;
    }

    /**
     * Check if products are sorted by price
     * @param {boolean} ascending - True for low to high, false for high to low
     * @returns {boolean} True if sorted correctly
     */
    async areProductsSortedByPrice(ascending = true) {
        const prices = await this.getAllProductPrices();
        for (let i = 0; i < prices.length - 1; i++) {
            if (ascending && prices[i] > prices[i + 1]) return false;
            if (!ascending && prices[i] < prices[i + 1]) return false;
        }
        return true;
    }

    /**
     * Verify all products are within price range
     * @param {number} min - Minimum price
     * @param {number} max - Maximum price
     * @returns {boolean} True if all products within range
     */
    async areAllProductsInPriceRange(min, max) {
        const prices = await this.getAllProductPrices();
        return prices.every(price => price >= min && price <= max);
    }

    /**
     * Get visible category badges
     * @returns {Array<string>} Array of category names
     */
    async getVisibleCategories() {
        const badges = await this.productCategories;
        const categories = [];
        for (const badge of badges) {
            if (await badge.isDisplayed()) {
                categories.push(await badge.getText());
            }
        }
        return categories;
    }

    /**
     * Check if all products have sale badge
     * @returns {boolean} True if all visible products have sale badge
     */
    async doAllProductsHaveSaleBadge() {
        const productCount = await this.getProductCount();
        const saleBadges = await this.saleBadges;
        const visibleSaleBadges = [];
        for (const badge of saleBadges) {
            if (await badge.isDisplayed()) {
                visibleSaleBadges.push(badge);
            }
        }
        return visibleSaleBadges.length === productCount;
    }

    /**
     * Check if any out of stock products are visible
     * @returns {boolean} True if out of stock products found
     */
    async areOutOfStockProductsVisible() {
        const badges = await this.outOfStockBadges;
        for (const badge of badges) {
            if (await badge.isDisplayed()) {
                return true;
            }
        }
        return false;
    }

    /**
     * Verify product display elements
     * @returns {object} Object with display element status
     */
    async verifyProductDisplayElements() {
        return {
            hasImages: (await this.productImages).length > 0,
            hasNames: (await this.productNames).length > 0,
            hasPrices: (await this.productPrices).length > 0,
            hasRatings: (await this.productRatings).length > 0,
            hasAddToCart: (await this.addToCartButtons).length > 0
        };
    }

    /**
     * Add first product to cart
     */
    async addFirstProductToCart() {
        const buttons = await this.addToCartButtons;
        if (buttons.length > 0) {
            await buttons[0].click();
            await browser.pause(1000);
        }
    }

    /**
     * Go to next page
     */
    async goToNextPage() {
        await this.nextPageButton.click();
        await browser.pause(1000);
    }

    /**
     * Go to page 2
     */
    async goToPage2() {
        await this.page2Button.click();
        await browser.pause(1000);
    }

    /**
     * Get cart item count from cart button
     * @returns {number} Number of items in cart
     */
    async getCartItemCount() {
        const cartText = await this.cartButton.getText();
        const match = cartText.match(/(\d+)\s+items?/);
        return match ? parseInt(match[1]) : 0;
    }

    /**
     * Get cart total from cart button
     * @returns {number} Total cart value
     */
    async getCartTotal() {
        const cartText = await this.cartButton.getText();
        const match = cartText.match(/\$(\d+\.\d+)/);
        return match ? parseFloat(match[1]) : 0;
    }
}

module.exports = new ShoppingPage();
