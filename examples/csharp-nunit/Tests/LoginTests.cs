using NUnit.Framework;
using SeleniumAiAgent.Sample.Pages;

namespace SeleniumAiAgent.Sample.Tests;

/// <summary>Plan section 1: Login (specs/the-internet.md). The site publishes these practice credentials on the page.</summary>
public class LoginTests : BaseTest
{
    [Test(Description = "1.1 Valid login opens the secure area, logout returns to the login page")]
    public void ValidLoginAndLogout()
    {
        var secure = new LoginPage(Driver).Open(BaseUrl).LoginAs("tomsmith", "SuperSecretPassword!");
        Assert.That(secure.HeadingText, Is.EqualTo("Secure Area"));
        Assert.That(secure.FlashMessage, Does.Contain("You logged into a secure area!"));

        var login = secure.LogOut();
        Assert.That(login.FlashMessage, Does.Contain("You logged out of the secure area!"));
    }

    [Test(Description = "1.2 Wrong password shows an error and stays on the login page")]
    public void WrongPassword()
    {
        var login = new LoginPage(Driver).Open(BaseUrl).SubmitInvalid("tomsmith", "wrong-password");
        Assert.That(login.FlashMessage, Does.Contain("Your password is invalid!"));
    }

    [Test(Description = "1.3 Unknown user shows an error")]
    public void UnknownUser()
    {
        var login = new LoginPage(Driver).Open(BaseUrl).SubmitInvalid("nobody", "SuperSecretPassword!");
        Assert.That(login.FlashMessage, Does.Contain("Your username is invalid!"));
    }
}
