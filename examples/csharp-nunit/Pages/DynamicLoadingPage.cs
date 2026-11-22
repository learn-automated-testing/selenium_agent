using OpenQA.Selenium;

namespace SeleniumAiAgent.Sample.Pages;

/// <summary>/dynamic_loading/1 and /2: content that appears after about five seconds.</summary>
public class DynamicLoadingPage : BasePage
{
    private static readonly By Start = By.CssSelector("#start button");
    private static readonly By Loading = By.Id("loading");
    private static readonly By Result = By.CssSelector("#finish h4");

    public DynamicLoadingPage(IWebDriver driver) : base(driver) { }

    /// <summary>Example 1 hides the result in the page; example 2 renders it only after loading.</summary>
    public DynamicLoadingPage Open(string baseUrl, int example)
    {
        Driver.Navigate().GoToUrl($"{baseUrl}/dynamic_loading/{example}");
        Visible(Start);
        return this;
    }

    public DynamicLoadingPage ClickStart()
    {
        Click(Start);
        return this;
    }

    /// <summary>Waits for the loading bar to go away, then returns the text that appeared. No sleeps.</summary>
    public string WaitForResult()
    {
        WaitUntilGone(Loading);
        return Visible(Result).Text;
    }
}
