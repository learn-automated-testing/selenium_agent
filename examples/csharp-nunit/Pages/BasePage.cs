using OpenQA.Selenium;
using OpenQA.Selenium.Support.UI;

namespace SeleniumAiAgent.Sample.Pages;

/// <summary>
/// Shared helpers for the page objects: every lookup waits for the condition it needs.
/// Selenium 4 .NET has no ExpectedConditions, so each wait is a lambda.
/// </summary>
public abstract class BasePage
{
    protected readonly IWebDriver Driver;
    protected readonly WebDriverWait Wait;

    protected BasePage(IWebDriver driver)
    {
        Driver = driver;
        Wait = new WebDriverWait(driver, TimeSpan.FromSeconds(10));
        Wait.IgnoreExceptionTypes(typeof(StaleElementReferenceException));
    }

    protected IWebElement Visible(By locator) =>
        Wait.Until(d =>
        {
            var element = d.FindElement(locator);
            return element.Displayed ? element : null;
        })!;

    protected void Click(By locator) =>
        Wait.Until(d =>
        {
            var element = d.FindElement(locator);
            return element.Displayed && element.Enabled ? element : null;
        })!.Click();

    protected void Type(By locator, string text)
    {
        var field = Visible(locator);
        field.Clear();
        field.SendKeys(text);
    }

    protected void WaitUntilGone(By locator) =>
        Wait.Until(d => d.FindElements(locator).All(e => !e.Displayed));

    protected void WaitForUrl(string part) =>
        Wait.Until(d => d.Url.Contains(part));
}
