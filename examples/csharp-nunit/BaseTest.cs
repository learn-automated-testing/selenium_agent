using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;

namespace SeleniumAiAgent.Sample;

/// <summary>
/// One fresh browser per test, ended with Quit() in teardown. Follows Selenium's rules for AI agents
/// (https://www.selenium.dev/documentation/ai_agents/): Selenium Manager finds the driver,
/// no implicit waits, explicit waits live in the page objects.
/// Set HEADLESS=1 to run without a window, BASE_URL to test another copy of the site.
/// </summary>
public abstract class BaseTest
{
    protected static readonly string BaseUrl =
        Environment.GetEnvironmentVariable("BASE_URL") ?? "https://the-internet.herokuapp.com";

    protected IWebDriver Driver { get; private set; } = null!;

    [SetUp]
    public void StartBrowser()
    {
        var options = new ChromeOptions();
        if (Environment.GetEnvironmentVariable("HEADLESS") != null)
        {
            options.AddArgument("--headless=new");
        }
        options.AddArgument("--window-size=1280,900");
        Driver = new ChromeDriver(options);
    }

    [TearDown]
    public void QuitBrowser()
    {
        Driver?.Quit();
    }
}
