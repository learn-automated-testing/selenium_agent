package com.example.theinternet.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;

/** /dynamic_loading/1 and /2: content that appears after about five seconds. */
public class DynamicLoadingPage extends BasePage {
    private static final By START = By.cssSelector("#start button");
    private static final By LOADING = By.id("loading");
    private static final By RESULT = By.cssSelector("#finish h4");

    public DynamicLoadingPage(WebDriver driver) {
        super(driver);
    }

    /** Example 1 hides the result in the page; example 2 renders it only after loading. */
    public DynamicLoadingPage open(String baseUrl, int example) {
        driver.get(baseUrl + "/dynamic_loading/" + example);
        visible(START);
        return this;
    }

    public DynamicLoadingPage start() {
        click(START);
        return this;
    }

    /** Waits for the loading bar to go away, then returns the text that appeared. No sleeps. */
    public String waitForResult() {
        wait.until(ExpectedConditions.invisibilityOfElementLocated(LOADING));
        return visible(RESULT).getText();
    }
}
