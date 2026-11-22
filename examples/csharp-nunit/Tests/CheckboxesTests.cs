using NUnit.Framework;
using SeleniumAiAgent.Sample.Pages;

namespace SeleniumAiAgent.Sample.Tests;

/// <summary>Plan section 3: Checkboxes (specs/the-internet.md).</summary>
public class CheckboxesTests : BaseTest
{
    [Test(Description = "3.1 Both checkboxes can be toggled")]
    public void TogglesBothCheckboxes()
    {
        var page = new CheckboxesPage(Driver).Open(BaseUrl);
        Assert.That(page.IsChecked(1), Is.False);
        Assert.That(page.IsChecked(2), Is.True);

        page.Toggle(1).Toggle(2);
        Assert.That(page.IsChecked(1), Is.True);
        Assert.That(page.IsChecked(2), Is.False);
    }
}
