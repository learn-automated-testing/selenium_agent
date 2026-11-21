package legacy;

import org.openqa.selenium.By;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;
import org.testng.annotations.Test;

// Selenium 3 style on purpose: the migrator sample. Do not copy these patterns.
public class DynamicControlsTest extends BaseTest {

    @Test
    public void enablesTheTextField() throws InterruptedException {
        driver.get("https://the-internet.herokuapp.com/dynamic_controls");
        driver.findElement(By.cssSelector("#input-example button")).click();
        new WebDriverWait(driver, 10).until(ExpectedConditions.elementToBeClickable(By.cssSelector("#input-example input")));
        driver.findElement(By.cssSelector("#input-example input")).sendKeys("Selenium");
        Assert.assertEquals(driver.findElement(By.cssSelector("#input-example input")).getAttribute("value"), "Selenium");
    }

    @Test
    public void removesTheCheckbox() throws InterruptedException {
        driver.get("https://the-internet.herokuapp.com/dynamic_controls");
        driver.findElement(By.xpath("/html/body/div[2]/div/div[1]/form[1]/button")).click();
        Thread.sleep(4000);
        Assert.assertEquals(driver.findElement(By.id("message")).getText(), "It's gone!");
    }
}
