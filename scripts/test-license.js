const axios = require('axios');

async function runTests() {
    const serverUrl = 'http://localhost:4000/api/v1/license/verify';

    console.log('\n--- 🧪 TEST 1: Verifikasi Key Valid ---');
    try {
        const res1 = await axios.post(serverUrl, {
            licenseKey: 'ZYRO-A75921-03B91E-66373B',
            hwid: 'hwid-machine-vps-01'
        });
        console.log('✅ Response 1 (Valid Key):', res1.data);
    } catch (err) {
        console.error('❌ Test 1 Error:', err.response ? err.response.data : err.message);
    }

    console.log('\n--- 🧪 TEST 2: Verifikasi Key Palsu / Invalid ---');
    try {
        await axios.post(serverUrl, {
            licenseKey: 'ZYRO-PALSU-KEY-99999',
            hwid: 'hwid-machine-vps-01'
        });
        console.error('❌ Test 2 Gagal: Seharusnya ditolak tapi malah lolos!');
    } catch (err) {
        console.log('✅ Response 2 (Expected Rejection):', err.response ? err.response.data : err.message);
    }

    console.log('\n--- 🧪 TEST 3: Verifikasi HWID Mismatch (Key dishare ke VPS lain) ---');
    try {
        await axios.post(serverUrl, {
            licenseKey: 'ZYRO-A75921-03B91E-66373B',
            hwid: 'hwid-mesin-bajakan-vps-02'
        });
        console.error('❌ Test 3 Gagal: Seharusnya ditolak karena HWID beda!');
    } catch (err) {
        console.log('✅ Response 3 (Expected HWID Mismatch):', err.response ? err.response.data : err.message);
    }
}

runTests();
