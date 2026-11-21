package com.example.theinternet;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.example.theinternet.pages.CheckboxesPage;

/** Plan section 3: Checkboxes (specs/the-internet.md). */
class CheckboxesTest extends BaseTest {

    @Test
    @DisplayName("3.1 Both checkboxes can be toggled")
    void togglesBothCheckboxes() {
        CheckboxesPage page = new CheckboxesPage(driver).open(BASE_URL);
        assertFalse(page.isChecked(1));
        assertTrue(page.isChecked(2));

        page.toggle(1).toggle(2);
        assertTrue(page.isChecked(1));
        assertFalse(page.isChecked(2));
    }
}
