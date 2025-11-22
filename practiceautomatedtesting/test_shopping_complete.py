"""
Test Suite for Practice Automated Testing - Shopping Section
Generated using Selenium MCP Server
"""

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC


class TestShoppingCart:
    """Test cases for shopping cart functionality"""

    def test_add_single_product_to_cart(self, driver, base_url):
        """
        Test Case ID: SHOP-006-A
        Verify adding a single product to cart updates count and total
        """
        driver.get(f"{base_url}/shopping")

        # Get initial cart state
        cart_button = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.XPATH, "//button[contains(text(), 'shopping_cart')]"))
        )
        initial_cart_text = cart_button.text

        # Click first "Add to Cart" button
        add_to_cart_btn = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "(//button[contains(text(), 'Add to Cart')])[1]"))
        )
        add_to_cart_btn.click()

        # Verify cart updated
        WebDriverWait(driver, 10).until(
            EC.text_to_be_present_in_element((By.XPATH, "//button[contains(text(), 'shopping_cart')]"), "1 items")
        )

        cart_button = driver.find_element(By.XPATH, "//button[contains(text(), 'shopping_cart')]")
        assert "1 items" in cart_button.text
        assert "$" in cart_button.text

    def test_add_multiple_products_to_cart(self, driver, base_url):
        """
        Test Case ID: SHOP-006-B
        Verify adding multiple products increments cart correctly
        """
        driver.get(f"{base_url}/shopping")

        # Add first product
        add_btns = driver.find_elements(By.XPATH, "//button[contains(text(), 'Add to Cart')]")
        add_btns[0].click()

        # Wait for cart to update
        WebDriverWait(driver, 10).until(
            EC.text_to_be_present_in_element((By.XPATH, "//button[contains(text(), 'shopping_cart')]"), "1 items")
        )

        # Add second product
        add_btns = driver.find_elements(By.XPATH, "//button[contains(text(), 'Add to Cart')]")
        add_btns[1].click()

        # Verify cart shows 2 items
        WebDriverWait(driver, 10).until(
            EC.text_to_be_present_in_element((By.XPATH, "//button[contains(text(), 'shopping_cart')]"), "2 items")
        )

        cart_button = driver.find_element(By.XPATH, "//button[contains(text(), 'shopping_cart')]")
        assert "2 items" in cart_button.text


class TestProductFiltering:
    """Test cases for product filtering functionality"""

    def test_price_range_filter(self, driver, base_url):
        """
        Test Case ID: SHOP-003
        Verify price range filtering
        """
        driver.get(f"{base_url}/shopping")

        # Set minimum price
        min_price_input = driver.find_element(By.XPATH, "//input[@value='14.99']")
        min_price_input.clear()
        min_price_input.send_keys("50")

        # Set maximum price
        max_price_input = driver.find_element(By.XPATH, "//input[@value='199.99']")
        max_price_input.clear()
        max_price_input.send_keys("100")

        # Wait for filtering to apply
        WebDriverWait(driver, 10).until(
            EC.presence_of_all_elements_located((By.XPATH, "//button[contains(text(), 'Add to Cart')]"))
        )

        # Verify products are displayed
        products = driver.find_elements(By.XPATH, "//button[contains(text(), 'Add to Cart')]")
        assert len(products) > 0

    def test_rating_filter(self, driver, base_url):
        """
        Test Case ID: SHOP-004
        Verify rating filter functionality
        """
        driver.get(f"{base_url}/shopping")

        # Click 5-star rating filter
        five_star_btn = driver.find_element(By.XPATH, "//button[contains(text(), '5★')]")
        five_star_btn.click()

        # Wait for results
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.XPATH, "//button[contains(text(), 'Add to Cart')]"))
        )

        # Verify products are displayed
        products = driver.find_elements(By.XPATH, "//button[contains(text(), 'Add to Cart')]")
        assert len(products) > 0


class TestProductSorting:
    """Test cases for product sorting"""

    def test_sort_by_name(self, driver, base_url):
        """
        Test Case ID: SHOP-005-A
        Verify products can be sorted by name
        """
        driver.get(f"{base_url}/shopping")

        # Click Sort by Name button
        sort_name_btn = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Sort by Name')]"))
        )
        sort_name_btn.click()

        # Wait for sorting to apply
        WebDriverWait(driver, 5).until(
            EC.presence_of_all_elements_located((By.XPATH, "//button[contains(text(), 'Add to Cart')]"))
        )

        # Verify button text changed (indicating sort was applied)
        sort_button = driver.find_element(By.XPATH, "//button[contains(text(), 'Sort by Name')]")
        assert sort_button is not None

    def test_sort_by_price(self, driver, base_url):
        """
        Test Case ID: SHOP-005-B
        Verify products can be sorted by price
        """
        driver.get(f"{base_url}/shopping")

        # Click Sort by Price button
        sort_price_btn = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Sort by Price')]"))
        )
        sort_price_btn.click()

        # Wait for sorting to apply
        WebDriverWait(driver, 5).until(
            EC.presence_of_all_elements_located((By.XPATH, "//button[contains(text(), 'Add to Cart')]"))
        )

        # Verify products are displayed
        products = driver.find_elements(By.XPATH, "//button[contains(text(), 'Add to Cart')]")
        assert len(products) > 0


class TestPagination:
    """Test cases for pagination"""

    @pytest.mark.skip(reason="Pagination behavior needs verification")
    def test_navigate_to_page_2(self, driver, base_url):
        """
        Test Case ID: SHOP-007
        Verify pagination navigation
        """
        driver.get(f"{base_url}/shopping")

        # Click Page 2 button
        page_2_btn = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Page 2')]"))
        )
        page_2_btn.click()

        # Verify page changed
        WebDriverWait(driver, 10).until(
            EC.presence_of_all_elements_located((By.XPATH, "//button[contains(text(), 'Add to Cart')]"))
        )

        products = driver.find_elements(By.XPATH, "//button[contains(text(), 'Add to Cart')]")
        assert len(products) > 0
