package com.example.theinternet;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import com.example.theinternet.pages.DynamicLoadingPage;

/** Plan section 2: Dynamic loading (specs/the-internet.md). */
class DynamicLoadingTest extends BaseTest {

    @ParameterizedTest(name = "2.{0} Example {0} shows Hello World! after loading")
    @ValueSource(ints = {1, 2})
    @DisplayName("2 Dynamic loading")
    void showsHelloWorld(int example) {
        String result = new DynamicLoadingPage(driver).open(BASE_URL, example).start().waitForResult();
        assertEquals("Hello World!", result);
    }
}
