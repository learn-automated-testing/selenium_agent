using OpenQA.Selenium;

namespace SeleniumAiAgent.Sample.Pages;

/// <summary>/checkboxes: two checkboxes, the second one checked.</summary>
public class CheckboxesPage : BasePage
{
    private static readonly By Checkboxes = By.CssSelector("#checkboxes input[type='checkbox']");

    public CheckboxesPage(IWebDriver driver) : base(driver) { }

    public CheckboxesPage Open(string baseUrl)
    {
        Driver.Navigate().GoToUrl(baseUrl + "/checkboxes");
        Wait.Until(d => d.FindElements(Checkboxes).Count == 2);
        return this;
    }

    /// <summary>Index 1 is the first checkbox.</summary>
    public bool IsChecked(int index) => Checkbox(index).Selected;

    public CheckboxesPage Toggle(int index)
    {
        Checkbox(index).Click();
        return this;
    }

    private IWebElement Checkbox(int index) => Driver.FindElements(Checkboxes)[index - 1];
}
