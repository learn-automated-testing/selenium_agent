package com.example.theinternet.pages;

import java.util.List;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;

/** /checkboxes: two checkboxes, the second one checked. */
public class CheckboxesPage extends BasePage {
    private static final By CHECKBOXES = By.cssSelector("#checkboxes input[type='checkbox']");

    public CheckboxesPage(WebDriver driver) {
        super(driver);
    }

    public CheckboxesPage open(String baseUrl) {
        driver.get(baseUrl + "/checkboxes");
        wait.until(ExpectedConditions.numberOfElementsToBe(CHECKBOXES, 2));
        return this;
    }

    /** Index 1 is the first checkbox. */
    public boolean isChecked(int index) {
        return checkbox(index).isSelected();
    }

    public CheckboxesPage toggle(int index) {
        checkbox(index).click();
        return this;
    }

    private WebElement checkbox(int index) {
        List<WebElement> boxes = driver.findElements(CHECKBOXES);
        return boxes.get(index - 1);
    }
}
