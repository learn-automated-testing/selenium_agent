using OpenQA.Selenium;

namespace SeleniumAiAgent.Sample.Pages;

/// <summary>/login: the form authentication page.</summary>
public class LoginPage : BasePage
{
    private static readonly By Username = By.Id("username");
    private static readonly By Password = By.Id("password");
    private static readonly By LoginButton = By.CssSelector("button[type='submit']");
    private static readonly By Flash = By.Id("flash");

    public LoginPage(IWebDriver driver) : base(driver) { }

    public LoginPage Open(string baseUrl)
    {
        Driver.Navigate().GoToUrl(baseUrl + "/login");
        Visible(Username);
        return this;
    }

    /// <summary>Logs in and waits for the secure area.</summary>
    public SecureAreaPage LoginAs(string username, string password)
    {
        Submit(username, password);
        WaitForUrl("/secure");
        return new SecureAreaPage(Driver);
    }

    /// <summary>Submits the form and stays on the login page, for the error cases.</summary>
    public LoginPage SubmitInvalid(string username, string password)
    {
        Submit(username, password);
        return this;
    }

    public string FlashMessage => Visible(Flash).Text;

    private void Submit(string username, string password)
    {
        Type(Username, username);
        Type(Password, password);
        Click(LoginButton);
    }
}
