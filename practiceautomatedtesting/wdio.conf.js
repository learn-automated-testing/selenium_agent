exports.config = {
    runner: 'local',
    specs: [
        './test/specs/**/*.spec.js'
    ],
    exclude: [],
    maxInstances: 1,
    capabilities: [{
        browserName: 'chrome',
        'goog:chromeOptions': {
            args: ['--disable-blink-features=AutomationControlled']
        }
    }],
    logLevel: 'info',
    bail: 0,
    baseUrl: 'https://practiceautomatedtesting.com',
    waitforTimeout: 10000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,
    framework: 'mocha',
    reporters: ['spec'],
    mochaOpts: {
        ui: 'bdd',
        timeout: 60000
    },

    before: function (capabilities, specs) {
        browser.maximizeWindow();
    },
}
