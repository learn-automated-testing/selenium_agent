package com.example.theinternet.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;

/** /login: the form authentication page. */
public class LoginPage extends BasePage {
    private static final By USERNAME = By.id("username");
    private static final By PASSWORD = By.id("password");
    private static final By LOGIN = By.cssSelector("button[type='submit']");
    private static final By FLASH = By.id("flash");

    public LoginPage(WebDriver driver) {
        super(driver);
    }

    public LoginPage open(String baseUrl) {
        driver.get(baseUrl + "/login");
        visible(USERNAME);
        return this;
    }

    /** Logs in and waits for the secure area. */
    public SecureAreaPage loginAs(String username, String password) {
        submit(username, password);
        wait.until(ExpectedConditions.urlContains("/secure"));
        return new SecureAreaPage(driver);
    }

    /** Submits the form and stays on the login page, for the error cases. */
    public LoginPage submitInvalid(String username, String password) {
        submit(username, password);
        return this;
    }

    public String flashMessage() {
        return visible(FLASH).getText();
    }

    private void submit(String username, String password) {
        type(USERNAME, username);
        type(PASSWORD, password);
        click(LOGIN);
    }
}
