const { LicenseService } = require('../dist/services/license.service');

async function test() {
    console.log('Testing License Startup...');
    await LicenseService.verifyOnStartup();
    LicenseService.stopHeartbeat();
    console.log('Test completed successfully!');
    process.exit(0);
}

test();
