import { ChartGenerator } from '../src/reports/charts.js';

async function testChart() {
    try {
        console.log('Testing ChartGenerator initialization...');
        const gen = new ChartGenerator();
        console.log('ChartGenerator initialized successfully!');

        // Try creating a simple chart buffer to trigger Chart.js internal logic
        const buffer = await gen.generateChart({
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar'],
                datasets: [{ label: 'Test', data: [10, 20, 30] }]
            }
        });

        if (buffer && buffer.length > 0) {
            console.log(`Success! Generated chart buffer of size: ${buffer.length}`);
        } else {
            console.log('Generated buffer is empty.');
        }
        process.exit(0);
    } catch (err) {
        console.error('ChartGenerator test failed:', err);
        process.exit(1);
    }
}

testChart();
