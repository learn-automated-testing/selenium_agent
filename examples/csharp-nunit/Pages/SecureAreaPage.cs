using OpenQA.Selenium;

namespace SeleniumAiAgent.Sample.Pages;

/// <summary>/secure: the page behind the login.</summary>
public class SecureAreaPage : BasePage
{
    private static readonly By Heading = By.TagName("h2");
    private static readonly By Flash = By.Id("flash");
    private static readonly By Logout = By.CssSelector("a[href='/logout']");

    public SecureAreaPage(IWebDriver driver) : base(driver) { }

    public string HeadingText => Visible(Heading).Text;

    public string FlashMessage => Visible(Flash).Text;

    public LoginPage LogOut()
    {
        Click(Logout);
        WaitForUrl("/login");
        return new LoginPage(Driver);
    }
}
