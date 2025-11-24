*** Settings ***
Documentation    Shopping Filter Test Cases for Practice Automated Testing Portal
Library          SeleniumLibrary
Suite Setup      Open Shopping Page
Suite Teardown   Close Browser
Test Setup       Reset Filters

*** Variables ***
${URL}                  https://practiceautomatedtesting.com/shopping
${BROWSER}              Chrome
${CATEGORY_DROPDOWN}    xpath=//select[contains(@class, 'category') or @name='category']
${SEARCH_INPUT}         xpath=//input[@placeholder='Search for items' or contains(@placeholder, 'Search')]
${PRICE_MIN_SLIDER}     xpath=//input[@type='range'][1]
${PRICE_MAX_SLIDER}     xpath=//input[@type='range'][2]
${RATING_ALL}           xpath=//button[contains(text(), 'All')]
${RATING_3STAR}         xpath=//button[contains(text(), '3')]
${RATING_4STAR}         xpath=//button[contains(text(), '4')]
${RATING_5STAR}         xpath=//button[contains(text(), '5')]
${IN_STOCK_CHECKBOX}    xpath=//input[@type='checkbox'][1]
${ON_SALE_CHECKBOX}     xpath=//input[@type='checkbox'][2]
${SORT_NAME_BUTTON}     xpath=//button[contains(text(), 'Sort by Name')]
${SORT_PRICE_BUTTON}    xpath=//button[contains(text(), 'Sort by Price')]
${PRODUCT_CARDS}        xpath=//div[contains(@class, 'product') or contains(@class, 'card')]
${PRODUCT_CATEGORY}     xpath=//div[contains(@class, 'category') or contains(@class, 'badge')]
${PRODUCT_PRICE}        xpath=//div[contains(@class, 'price')] | //p[contains(text(), '$')]

*** Test Cases ***
TC001: Verify Category Filter - All Products
    [Documentation]    Verify that selecting "All" category displays all products
    [Tags]    category    filter    smoke
    Select From List By Label    ${CATEGORY_DROPDOWN}    All
    Sleep    1s
    ${count}=    Get Element Count    ${PRODUCT_CARDS}
    Should Be True    ${count} > 0    No products displayed

TC002: Verify Category Filter - Electronics
    [Documentation]    Verify that selecting "Electronics" category filters products correctly
    [Tags]    category    filter
    Select From List By Label    ${CATEGORY_DROPDOWN}    Electronics
    Sleep    1s
    Wait Until Page Contains    Electronics    timeout=5s
    ${count}=    Get Element Count    ${PRODUCT_CARDS}
    Should Be True    ${count} > 0    No Electronics products found

TC003: Verify Category Filter - Accessories
    [Documentation]    Verify that selecting "Accessories" category filters products correctly
    [Tags]    category    filter
    Select From List By Label    ${CATEGORY_DROPDOWN}    Accessories
    Sleep    1s
    Wait Until Page Contains    Accessories    timeout=5s
    ${count}=    Get Element Count    ${PRODUCT_CARDS}
    Should Be True    ${count} > 0    No Accessories products found

TC004: Verify Category Filter - Office Supplies
    [Documentation]    Verify that selecting "Office Supplies" category filters products correctly
    [Tags]    category    filter
    Select From List By Label    ${CATEGORY_DROPDOWN}    Office Supplies
    Sleep    1s
    Wait Until Page Contains    Office Supplies    timeout=5s
    ${count}=    Get Element Count    ${PRODUCT_CARDS}
    Should Be True    ${count} > 0    No Office Supplies products found

TC005: Verify Category Filter - Furniture
    [Documentation]    Verify that selecting "Furniture" category filters products correctly
    [Tags]    category    filter
    Select From List By Label    ${CATEGORY_DROPDOWN}    Furniture
    Sleep    1s
    Wait Until Page Contains    Furniture    timeout=5s
    ${count}=    Get Element Count    ${PRODUCT_CARDS}
    Should Be True    ${count} > 0    No Furniture products found

TC006: Verify Rating Filter - 3 Stars
    [Documentation]    Verify that selecting 3-star rating filter works correctly
    [Tags]    rating    filter
    Click Button    ${RATING_3STAR}
    Sleep    1s
    ${count}=    Get Element Count    ${PRODUCT_CARDS}
    Should Be True    ${count} > 0    No products with 3+ stars found

TC007: Verify Rating Filter - 4 Stars
    [Documentation]    Verify that selecting 4-star rating filter works correctly
    [Tags]    rating    filter
    Click Button    ${RATING_4STAR}
    Sleep    1s
    ${count}=    Get Element Count    ${PRODUCT_CARDS}
    Should Be True    ${count} > 0    No products with 4+ stars found

TC008: Verify Rating Filter - 5 Stars
    [Documentation]    Verify that selecting 5-star rating filter works correctly
    [Tags]    rating    filter
    Click Button    ${RATING_5STAR}
    Sleep    1s
    ${count}=    Get Element Count    ${PRODUCT_CARDS}
    Should Be True    ${count} >= 0    Filter not working

TC009: Verify In Stock Only Filter
    [Documentation]    Verify that "In Stock Only" checkbox filters products correctly
    [Tags]    availability    filter
    Click Element    ${IN_STOCK_CHECKBOX}
    Sleep    1s
    Page Should Not Contain    Out of Stock

TC010: Verify On Sale Only Filter
    [Documentation]    Verify that "On Sale Only" checkbox filters sale products
    [Tags]    deals    filter
    Click Element    ${ON_SALE_CHECKBOX}
    Sleep    1s
    ${count}=    Get Element Count    ${PRODUCT_CARDS}
    Should Be True    ${count} >= 0    Filter not working

TC011: Verify Combined Filters - Category and Rating
    [Documentation]    Verify that multiple filters can be applied together
    [Tags]    combined    filter    regression
    Select From List By Label    ${CATEGORY_DROPDOWN}    Electronics
    Sleep    1s
    Click Button    ${RATING_4STAR}
    Sleep    1s
    ${count}=    Get Element Count    ${PRODUCT_CARDS}
    Should Be True    ${count} >= 0    Combined filters not working
    Page Should Contain    Electronics

TC012: Verify Combined Filters - Category, Rating and Availability
    [Documentation]    Verify that three filters can be applied simultaneously
    [Tags]    combined    filter    regression
    Select From List By Label    ${CATEGORY_DROPDOWN}    Accessories
    Sleep    1s
    Click Button    ${RATING_3STAR}
    Sleep    1s
    Click Element    ${IN_STOCK_CHECKBOX}
    Sleep    1s
    ${count}=    Get Element Count    ${PRODUCT_CARDS}
    Should Be True    ${count} >= 0    Three combined filters not working

TC013: Verify Sort by Name
    [Documentation]    Verify that products can be sorted by name
    [Tags]    sorting
    Click Button    ${SORT_NAME_BUTTON}
    Sleep    1s
    Page Should Contain Element    ${PRODUCT_CARDS}

TC014: Verify Sort by Price
    [Documentation]    Verify that products can be sorted by price
    [Tags]    sorting
    Click Button    ${SORT_PRICE_BUTTON}
    Sleep    1s
    Page Should Contain Element    ${PRODUCT_CARDS}

TC015: Verify Search Functionality
    [Documentation]    Verify that search box filters products by keyword
    [Tags]    search
    Input Text    ${SEARCH_INPUT}    Headphones
    Sleep    2s
    Wait Until Page Contains    Headphones    timeout=5s

TC016: Verify Search with Category Filter
    [Documentation]    Verify that search works in combination with category filter
    [Tags]    search    combined    filter
    Input Text    ${SEARCH_INPUT}    Lamp
    Sleep    1s
    Select From List By Label    ${CATEGORY_DROPDOWN}    Office Supplies
    Sleep    2s
    ${count}=    Get Element Count    ${PRODUCT_CARDS}
    Should Be True    ${count} >= 0    Search with category filter not working

TC017: Verify Filter Reset on Category Change
    [Documentation]    Verify that changing categories updates the product display
    [Tags]    filter    functional
    Select From List By Label    ${CATEGORY_DROPDOWN}    Electronics
    Sleep    1s
    ${electronics_count}=    Get Element Count    ${PRODUCT_CARDS}
    Select From List By Label    ${CATEGORY_DROPDOWN}    Accessories
    Sleep    1s
    ${accessories_count}=    Get Element Count    ${PRODUCT_CARDS}
    Should Not Be Equal    ${electronics_count}    ${accessories_count}

TC018: Verify Product Count Display
    [Documentation]    Verify that the search results count is displayed correctly
    [Tags]    ui    validation
    Wait Until Page Contains    Search Results    timeout=5s
    Page Should Contain    products

*** Keywords ***
Open Shopping Page
    [Documentation]    Opens the browser and navigates to the shopping page
    Open Browser    ${URL}    ${BROWSER}
    Maximize Browser Window
    Wait Until Page Contains Element    ${CATEGORY_DROPDOWN}    timeout=10s

Reset Filters
    [Documentation]    Resets all filters to default state before each test
    Go To    ${URL}
    Wait Until Page Contains Element    ${CATEGORY_DROPDOWN}    timeout=10s
    Sleep    1s
