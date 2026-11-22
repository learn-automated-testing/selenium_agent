using NUnit.Framework;
using SeleniumAiAgent.Sample.Pages;

namespace SeleniumAiAgent.Sample.Tests;

/// <summary>Plan section 2: Dynamic loading (specs/the-internet.md).</summary>
public class DynamicLoadingTests : BaseTest
{
    [TestCase(1, Description = "2.1 Hidden element appears after loading")]
    [TestCase(2, Description = "2.2 Element is rendered after loading")]
    public void ShowsHelloWorld(int example)
    {
        var result = new DynamicLoadingPage(Driver).Open(BaseUrl, example).ClickStart().WaitForResult();
        Assert.That(result, Is.EqualTo("Hello World!"));
    }
}
