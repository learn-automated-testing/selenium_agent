using System;
using System.Threading;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Support.UI;

namespace Legacy
{
    // Selenium 3 style on purpose: the migrator sample. Do not copy these patterns.
    public class DynamicControlsTests : BaseTest
    {
        [Test]
        public void EnablesTheTextField()
        {
            driver.Navigate().GoToUrl("https://the-internet.herokuapp.com/dynamic_controls");
            driver.FindElement(By.CssSelector("#input-example button")).Click();
            var wait = new WebDriverWait(driver, TimeSpan.FromSeconds(10));
            wait.Until(ExpectedConditions.ElementToBeClickable(By.CssSelector("#input-example input")));
            driver.FindElementByCssSelector("#input-example input").SendKeys("Selenium");
            Assert.AreEqual("Selenium", driver.FindElement(By.CssSelector("#input-example input")).GetAttribute("value"));
        }

        [Test]
        public void RemovesTheCheckbox()
        {
            driver.Navigate().GoToUrl("https://the-internet.herokuapp.com/dynamic_controls");
            driver.FindElement(By.XPath("/html/body/div[2]/div/div[1]/form[1]/button")).Click();
            Thread.Sleep(4000);
            Assert.AreEqual("It's gone!", driver.FindElementById("message").Text);
        }
    }
}
