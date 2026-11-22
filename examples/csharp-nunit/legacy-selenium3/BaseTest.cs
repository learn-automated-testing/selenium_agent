using System;
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;

namespace Legacy
{
    // Selenium 3 style on purpose: the migrator sample. Do not copy these patterns.
    public abstract class BaseTest
    {
        protected IWebDriver driver;

        [SetUp]
        public void SetUp()
        {
            var options = new ChromeOptions();
            if (Environment.GetEnvironmentVariable("HEADLESS") != null)
            {
                options.AddArgument("--headless");
            }
            options.AddAdditionalCapability("acceptInsecureCerts", true, true);
            driver = new ChromeDriver("/usr/local/bin", options);
            driver.Manage().Timeouts().ImplicitlyWait(TimeSpan.FromSeconds(10));
        }

        [TearDown]
        public void TearDown()
        {
            driver.Close();
        }
    }
}
