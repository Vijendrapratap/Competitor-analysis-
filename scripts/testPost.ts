// Use global fetch
import 'dotenv/config';

const PORT = 3001;
const URL = `http://localhost:${PORT}/api/competitors`;

async function testPost() {
    console.log('Testing POST to:', URL);
    try {
        const res = await fetch(URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: 'Test Competitor ' + Date.now(),
                facebookPageId: 'test-' + Date.now(),
                facebookPageUrl: 'https://facebook.com/test',
                adsLibraryUrl: 'https://ads.facebook.com/test',
                category: 'hotel',
                priceTier: 'luxury'
            }),
        });

        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Response:', text);
    } catch (err: any) {
        console.error('Fetch error:', err.message);
    }
}

testPost();
