# Test plan: the-internet.herokuapp.com

Practice site: <https://the-internet.herokuapp.com>. The login credentials below are the practice credentials the site shows on its own login page.

## 1. Login

### 1.1 Valid login opens the secure area, logout returns to the login page

1. Open `/login`
2. Enter username `tomsmith` and password `SuperSecretPassword!`, click Login
   - expect: the URL contains `/secure` and the heading is "Secure Area"
   - expect: the message says "You logged into a secure area!"
3. Click Logout
   - expect: the login page says "You logged out of the secure area!"

### 1.2 Wrong password shows an error and stays on the login page

1. Open `/login`, enter `tomsmith` with a wrong password, click Login
   - expect: the message says "Your password is invalid!"

### 1.3 Unknown user shows an error

1. Open `/login`, enter an unknown username, click Login
   - expect: the message says "Your username is invalid!"

## 2. Dynamic loading

### 2.1 Hidden element appears after loading

1. Open `/dynamic_loading/1`, click Start
   - expect: "Loading..." appears and goes away after about 5 seconds
   - expect: "Hello World!" is visible

### 2.2 Element is rendered after loading

1. Open `/dynamic_loading/2`, click Start
   - expect: "Hello World!" is added to the page and visible

## 3. Checkboxes

### 3.1 Both checkboxes can be toggled

1. Open `/checkboxes`
   - expect: checkbox 1 is unchecked, checkbox 2 is checked
2. Click both checkboxes
   - expect: checkbox 1 is checked, checkbox 2 is unchecked

## 4. Dropdown (no test yet: let the generator write it)

### 4.1 Choose an option

1. Open `/dropdown`
   - expect: "Please select an option" is selected and cannot be chosen
2. Select "Option 2"
   - expect: "Option 2" is selected, with value `2`
