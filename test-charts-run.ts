import { ChartGenerator } from './src/reports/charts.js';

async function main() {
    const gen = new ChartGenerator(700, 400);
    console.log('Generating charts...');
    const result = await gen.generateAll({
        shareOfVoice: [
            { name: 'Competitor A', adCount: 15 },
            { name: 'Competitor B', adCount: 5 }
        ]
    });
    console.log('Result length:', Object.keys(result).length);
    console.log('First 50 chars of shareOfVoicePie:', result.shareOfVoicePie?.substring(0, 50));
}

main().catch(console.error);
