package com.example.theinternet;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;

/**
 * One fresh browser per test, closed in teardown. Follows Selenium's rules for AI agents
 * (https://www.selenium.dev/documentation/ai_agents/): Selenium Manager finds the driver,
 * no implicit waits, explicit waits live in the page objects.
 *
 * <p>Set HEADLESS=1 to run without a window, BASE_URL to test another copy of the site.
 */
abstract class BaseTest {
    static final String BASE_URL = System.getenv().getOrDefault("BASE_URL", "https://the-internet.herokuapp.com");

    protected WebDriver driver;

    @BeforeEach
    void startBrowser() {
        ChromeOptions options = new ChromeOptions();
        if (System.getenv("HEADLESS") != null) {
            options.addArguments("--headless=new");
        }
        options.addArguments("--window-size=1280,900");
        driver = new ChromeDriver(options);
    }

    @AfterEach
    void quitBrowser() {
        if (driver != null) {
            driver.quit();
        }
    }
}
