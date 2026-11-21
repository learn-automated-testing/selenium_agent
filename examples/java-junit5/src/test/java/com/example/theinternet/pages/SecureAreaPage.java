package com.example.theinternet.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;

/** /secure: the page behind the login. */
public class SecureAreaPage extends BasePage {
    private static final By HEADING = By.tagName("h2");
    private static final By FLASH = By.id("flash");
    private static final By LOGOUT = By.cssSelector("a[href='/logout']");

    public SecureAreaPage(WebDriver driver) {
        super(driver);
    }

    public String heading() {
        return visible(HEADING).getText();
    }

    public String flashMessage() {
        return visible(FLASH).getText();
    }

    public LoginPage logout() {
        click(LOGOUT);
        wait.until(ExpectedConditions.urlContains("/login"));
        return new LoginPage(driver);
    }
}
