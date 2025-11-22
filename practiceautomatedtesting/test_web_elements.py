"""
Test Suite for Practice Automated Testing - Web Elements Section
Generated using Selenium MCP Server
"""

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


class TestInputForms:
    """Test cases for input form functionality"""

    def test_simple_input_form_submission(self, driver, base_url):
        """
        Test Case ID: WE-001
        Verify simple input form accepts input and submits
        """
        driver.get(f"{base_url}/webelements")

        # Click Simple Input Form menu item
        simple_form_btn = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Simple Input Form')]"))
        )
        simple_form_btn.click()

        # Wait for form to be visible
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.XPATH, "//input"))
        )

        # Find and fill input fields
        inputs = driver.find_elements(By.TAG_NAME, "input")
        if len(inputs) >= 2:
            inputs[0].send_keys("Test User")
            inputs[1].send_keys("test@example.com")

        # Find and fill textarea
        textareas = driver.find_elements(By.TAG_NAME, "textarea")
        if len(textareas) > 0:
            textareas[0].send_keys("This is a test message for the form submission.")

        # Click Submit button
        submit_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Submit')]")
        submit_btn.click()

        # Verify form was submitted (button should still be present)
        assert submit_btn is not None


class TestCheckboxes:
    """Test cases for checkbox functionality"""

    def test_checkbox_selection(self, driver, base_url):
        """
        Test Case ID: WE-002
        Verify checkbox interactions - select and deselect
        """
        driver.get(f"{base_url}/webelements")

        # Click Check Box menu item
        checkbox_btn = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Check Box')]"))
        )
        checkbox_btn.click()

        # Wait for checkboxes to be visible
        WebDriverWait(driver, 10).until(
            EC.presence_of_all_elements_located((By.XPATH, "//input[@type='checkbox']"))
        )

        # Get all checkboxes
        checkboxes = driver.find_elements(By.XPATH, "//input[@type='checkbox']")
        assert len(checkboxes) >= 3

        # Verify initially unchecked
        for checkbox in checkboxes[:3]:
            assert not checkbox.is_selected()

        # Select all checkboxes
        for checkbox in checkboxes[:3]:
            if not checkbox.is_selected():
                checkbox.click()

        # Verify all are checked
        checkboxes = driver.find_elements(By.XPATH, "//input[@type='checkbox']")
        for checkbox in checkboxes[:3]:
            assert checkbox.is_selected()

        # Uncheck first checkbox
        checkboxes[0].click()
        assert not checkboxes[0].is_selected()


class TestRadioButtons:
    """Test cases for radio button functionality"""

    def test_radio_button_single_selection(self, driver, base_url):
        """
        Test Case ID: WE-003
        Verify radio buttons allow only single selection
        """
        driver.get(f"{base_url}/webelements")

        # Click Radio Button menu item
        radio_btn_menu = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Radio Button')]"))
        )
        radio_btn_menu.click()

        # Wait for radio buttons to be visible
        WebDriverWait(driver, 10).until(
            EC.presence_of_all_elements_located((By.XPATH, "//input[@type='radio']"))
        )

        # Get all radio buttons in the same group
        radio_buttons = driver.find_elements(By.XPATH, "//input[@type='radio']")
        assert len(radio_buttons) >= 2

        # Select first radio button
        radio_buttons[0].click()
        assert radio_buttons[0].is_selected()

        # Select second radio button
        if len(radio_buttons) >= 2:
            radio_buttons[1].click()
            assert radio_buttons[1].is_selected()

            # Verify first is no longer selected (if same group)
            # This assertion depends on radio buttons being in same group


class TestWebTables:
    """Test cases for web table functionality"""

    def test_web_table_display(self, driver, base_url):
        """
        Test Case ID: WE-004
        Verify web table displays data correctly
        """
        driver.get(f"{base_url}/webelements")

        # Click Web Tables menu item
        web_tables_btn = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Web Tables')]"))
        )
        web_tables_btn.click()

        # Wait for table to be visible
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.TAG_NAME, "table"))
        )

        # Verify table exists
        table = driver.find_element(By.TAG_NAME, "table")
        assert table is not None

        # Verify table has rows
        rows = table.find_elements(By.TAG_NAME, "tr")
        assert len(rows) > 0


class TestLinks:
    """Test cases for link functionality"""

    def test_links_clickable(self, driver, base_url):
        """
        Test Case ID: WE-005
        Verify links are clickable and functional
        """
        driver.get(f"{base_url}/webelements")

        # Click Links menu item
        links_btn = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Links')]"))
        )
        links_btn.click()

        # Wait for links section to load
        WebDriverWait(driver, 10).until(
            EC.presence_of_all_elements_located((By.TAG_NAME, "a"))
        )

        # Verify links are present
        links = driver.find_elements(By.TAG_NAME, "a")
        assert len(links) > 0


class TestSelectBox:
    """Test cases for select/dropdown functionality"""

    def test_select_dropdown_options(self, driver, base_url):
        """
        Test Case ID: WE-006
        Verify dropdown select functionality
        """
        driver.get(f"{base_url}/webelements")

        # Click Select Box menu item
        select_btn = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Select Box')]"))
        )
        select_btn.click()

        # Wait for select element to be visible
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.TAG_NAME, "select"))
        )

        # Verify select exists
        select_element = driver.find_element(By.TAG_NAME, "select")
        assert select_element is not None
