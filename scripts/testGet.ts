// Use global fetch
import 'dotenv/config';

const PORT = 3001;
const URL = `http://localhost:${PORT}/api/competitors`;

async function testGet() {
    console.log('Testing GET from:', URL);
    try {
        const res = await fetch(URL, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Response:', text);
    } catch (err: any) {
        console.error('Fetch error:', err.message);
    }
}

testGet();
