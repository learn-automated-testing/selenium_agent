package com.example.theinternet;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.example.theinternet.pages.LoginPage;
import com.example.theinternet.pages.SecureAreaPage;

/** Plan section 1: Login (specs/the-internet.md). The site publishes these practice credentials on the page. */
class LoginTest extends BaseTest {

    @Test
    @DisplayName("1.1 Valid login opens the secure area, logout returns to the login page")
    void validLoginAndLogout() {
        SecureAreaPage secure = new LoginPage(driver).open(BASE_URL).loginAs("tomsmith", "SuperSecretPassword!");
        assertEquals("Secure Area", secure.heading());
        assertTrue(secure.flashMessage().contains("You logged into a secure area!"));

        LoginPage login = secure.logout();
        assertTrue(login.flashMessage().contains("You logged out of the secure area!"));
    }

    @Test
    @DisplayName("1.2 Wrong password shows an error and stays on the login page")
    void wrongPassword() {
        LoginPage login = new LoginPage(driver).open(BASE_URL).submitInvalid("tomsmith", "wrong-password");
        assertTrue(login.flashMessage().contains("Your password is invalid!"));
    }

    @Test
    @DisplayName("1.3 Unknown user shows an error")
    void unknownUser() {
        LoginPage login = new LoginPage(driver).open(BASE_URL).submitInvalid("nobody", "SuperSecretPassword!");
        assertTrue(login.flashMessage().contains("Your username is invalid!"));
    }
}
