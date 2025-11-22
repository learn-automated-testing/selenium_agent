# Practice Automated Testing - Test Suite

Comprehensive UI automation test suite for https://practiceautomatedtesting.com using Pytest and Selenium.

## Project Structure

```
practiceautomatedtesting/
├── README.md                      # This file
├── test_plan.md                   # Detailed test plan
├── requirements.txt               # Python dependencies
├── pytest.ini                     # Pytest configuration
├── conftest.py                    # Pytest fixtures and setup
├── test_shopping_complete.py      # Shopping section tests
├── test_web_elements.py           # Web elements section tests
└── test_shopping_cart.py          # Generated test (if exists)
```

## Test Coverage

### Shopping Section Tests
- ✅ Add single product to cart
- ✅ Add multiple products to cart
- ✅ Price range filtering
- ✅ Rating filters
- ✅ Sort by name
- ✅ Sort by price
- ⏸️ Pagination (skipped - needs verification)

### Web Elements Section Tests
- ✅ Simple input form submission
- ✅ Checkbox selection/deselection
- ✅ Radio button single selection
- ✅ Web tables display
- ✅ Links clickable
- ✅ Select dropdown functionality

## Setup Instructions

### 1. Create Virtual Environment

```bash
cd practiceautomatedtesting
python -m venv venv
```

### 2. Activate Virtual Environment

**macOS/Linux:**
```bash
source venv/bin/activate
```

**Windows:**
```bash
venv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Verify Chrome is Installed

The tests use Chrome browser. Ensure you have Chrome installed.
The `webdriver-manager` package will automatically download and manage ChromeDriver.

## Running Tests

### Run All Tests
```bash
pytest
```

### Run Specific Test File
```bash
pytest test_shopping_complete.py
```

### Run Specific Test Class
```bash
pytest test_shopping_complete.py::TestShoppingCart
```

### Run Specific Test Method
```bash
pytest test_shopping_complete.py::TestShoppingCart::test_add_single_product_to_cart
```

### Run with Verbose Output
```bash
pytest -v
```

### Run Tests by Marker
```bash
pytest -m shopping
pytest -m webelements
```

### Run in Headless Mode
To run tests in headless mode, modify the fixture in `conftest.py` to use `headless_driver` instead of `driver`.

### Generate HTML Report
```bash
pytest --html=report.html --self-contained-html
```

## Test Results

Tests will output to the console with detailed information about:
- Test execution status (PASSED/FAILED)
- Error messages and tracebacks (if any)
- Test duration

## Troubleshooting

### ChromeDriver Issues
If you encounter ChromeDriver issues:
1. Ensure Chrome browser is up to date
2. Clear webdriver-manager cache: `rm -rf ~/.wdm`
3. Reinstall webdriver-manager: `pip install --upgrade webdriver-manager`

### Element Not Found Errors
If tests fail with element not found:
1. Check if website structure has changed
2. Increase implicit wait time in `conftest.py`
3. Add explicit waits for dynamic elements
4. Verify the website is accessible

### Timeout Errors
If tests timeout:
1. Increase timeout values in WebDriverWait calls
2. Check internet connection
3. Verify website is responding

## Best Practices

1. **Run tests regularly** to catch regressions early
2. **Update locators** when website changes
3. **Use explicit waits** for dynamic content
4. **Keep tests independent** - each test should work standalone
5. **Use meaningful test names** that describe what is being tested

## Generated with Selenium MCP Server

These tests were created using the Selenium MCP Server, which provides:
- Automated test planning
- Test generation from recorded actions
- Intelligent element location strategies
- Best practices for web automation

## Contributing

When adding new tests:
1. Follow the existing test structure
2. Use descriptive test names starting with `test_`
3. Add appropriate markers in pytest.ini
4. Update this README with new test coverage
5. Ensure tests are independent and can run in any order

## Test Plan

For detailed test scenarios, steps, and expected results, see `test_plan.md`.

## License

This test suite is for educational and testing purposes.
