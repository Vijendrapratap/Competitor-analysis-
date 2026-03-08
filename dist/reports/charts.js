// =============================================================================
// Chart Generator — creates embeddable charts using Chart.js + node-canvas
// =============================================================================
import { Canvas } from 'skia-canvas';
import Chart from 'chart.js/auto';
// Disable animations globally for server-side (Node.js) rendering.
// Without this, Chart.js defers rendering to requestAnimationFrame which
// doesn't exist in Node, causing the canvas to be blank when toBuffer() is called.
Chart.defaults.animation = false;
Chart.defaults.responsive = false;
Chart.defaults.devicePixelRatio = 1;
import { createLogger } from '../utils/logger.js';
const log = createLogger('ChartGenerator');
// ─────────────────────────────────────────────────────────────────────────────
// Colour palette (navy / gold theme)
// ─────────────────────────────────────────────────────────────────────────────
const COLOURS = {
    navy: '#1a365d',
    navyLight: '#2a4a7f',
    gold: '#d69e2e',
    goldLight: '#ecc94b',
    green: '#38a169',
    red: '#e53e3e',
    blue: '#3182ce',
    purple: '#805ad5',
    pink: '#d53f8c',
    teal: '#319795',
    orange: '#dd6b20',
    cyan: '#00b5d8',
    gray: '#a0aec0',
    grayLight: '#e2e8f0',
};
/** Rotating palette for multi-series charts */
const PALETTE = [
    COLOURS.navy,
    COLOURS.gold,
    COLOURS.green,
    COLOURS.blue,
    COLOURS.red,
    COLOURS.purple,
    COLOURS.pink,
    COLOURS.teal,
    COLOURS.orange,
    COLOURS.cyan,
];
/** Lighter versions for fills / backgrounds */
const PALETTE_LIGHT = [
    '#1a365d33',
    '#d69e2e33',
    '#38a16933',
    '#3182ce33',
    '#e53e3e33',
    '#805ad533',
    '#d53f8c33',
    '#31979533',
    '#dd6b2033',
    '#00b5d833',
];
// ─────────────────────────────────────────────────────────────────────────────
// ChartGenerator
// ─────────────────────────────────────────────────────────────────────────────
export class ChartGenerator {
    width;
    height;
    constructor(width = 700, height = 400) {
        this.width = width;
        this.height = height;
        log.info('ChartGenerator initialised', { width, height });
    }
    // ── Private render helper ──────────────────────────────────────────────────
    async renderToDataUrl(config) {
        const canvas = new Canvas(this.width, this.height);
        const ctx = canvas.getContext('2d');
        // Fill white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, this.width, this.height);
        // Merge animation:false into every chart config to guarantee sync rendering
        const chartConfig = {
            ...config,
            options: {
                ...config.options,
                animation: false,
                responsive: false,
            },
        };
        // Create chart instance, force a synchronous render, then clean up
        const chart = new Chart(ctx, chartConfig);
        chart.render();
        const buffer = await canvas.toBuffer('png');
        chart.destroy();
        const base64 = buffer.toString('base64');
        return `<img src="data:image/png;base64,${base64}" width="${this.width}" height="${this.height}" alt="${String(config.options?.['chartTitle'] ?? 'chart')}" style="max-width:100%;height:auto;" />`;
    }
    // ── 1. Share of Voice Pie ──────────────────────────────────────────────────
    async shareOfVoicePie(entries) {
        log.info('Generating Share of Voice pie chart', { entries: entries.length });
        const sorted = [...entries].sort((a, b) => b.adCount - a.adCount);
        // Show top 8, group rest as "Others"
        const top = sorted.slice(0, 8);
        const othersTotal = sorted.slice(8).reduce((s, e) => s + e.adCount, 0);
        if (othersTotal > 0) {
            top.push({ name: 'Others', adCount: othersTotal });
        }
        const total = top.reduce((s, e) => s + e.adCount, 0) || 1;
        const labels = top.map((e) => `${e.name} (${Math.round((e.adCount / total) * 100)}%)`);
        const data = top.map((e) => e.adCount);
        const bgColors = top.map((e, i) => e.isCustomer ? COLOURS.gold : PALETTE[i % PALETTE.length]);
        return this.renderToDataUrl({
            type: 'pie',
            data: {
                labels,
                datasets: [{ data, backgroundColor: bgColors, borderWidth: 2, borderColor: '#fff' }],
            },
            options: {
                responsive: false,
                plugins: {
                    title: { display: true, text: 'Share of Voice — Active Ads', font: { size: 14 } },
                    legend: { position: 'right', labels: { font: { size: 10 }, boxWidth: 12 } },
                },
                chartTitle: 'Share of Voice',
            },
        });
    }
    // ── 2. Health Score Bars ───────────────────────────────────────────────────
    async healthScoreBars(entries) {
        log.info('Generating Health Score bar chart', { entries: entries.length });
        const sorted = [...entries].sort((a, b) => b.totalScore - a.totalScore).slice(0, 15);
        const labels = sorted.map((e) => e.name);
        const barColors = sorted.map((e) => {
            if (e.isCustomer)
                return COLOURS.gold;
            if (e.totalScore >= 70)
                return COLOURS.green;
            if (e.totalScore >= 40)
                return COLOURS.navyLight;
            return COLOURS.red;
        });
        return this.renderToDataUrl({
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Paid',
                        data: sorted.map((e) => e.paidScore),
                        backgroundColor: sorted.map((e) => e.isCustomer ? '#d69e2e99' : '#1a365d99'),
                    },
                    {
                        label: 'Organic',
                        data: sorted.map((e) => e.organicScore),
                        backgroundColor: sorted.map((e) => e.isCustomer ? '#ecc94b99' : '#38a16999'),
                    },
                ],
            },
            options: {
                responsive: false,
                indexAxis: 'y',
                scales: {
                    x: { stacked: true, max: 200, title: { display: true, text: 'Score (Paid + Organic)' } },
                    y: { stacked: true },
                },
                plugins: {
                    title: { display: true, text: 'Health Scores — Paid vs Organic', font: { size: 14 } },
                    legend: { position: 'top' },
                },
                chartTitle: 'Health Score Bars',
            },
        });
    }
    // ── 3. Trend Lines ─────────────────────────────────────────────────────────
    async trendLines(entries) {
        log.info('Generating trend lines chart', { keywords: entries.length });
        // Collect all unique dates and sort chronologically
        const allDates = new Set();
        for (const entry of entries) {
            for (const dp of entry.dataPoints)
                allDates.add(dp.date);
        }
        const sortedDates = [...allDates].sort();
        const datasets = entries.map((entry, i) => {
            const dateMap = new Map(entry.dataPoints.map((dp) => [dp.date, dp.value]));
            return {
                label: entry.keyword,
                data: sortedDates.map((d) => dateMap.get(d) ?? NaN),
                borderColor: PALETTE[i % PALETTE.length],
                backgroundColor: PALETTE_LIGHT[i % PALETTE_LIGHT.length],
                fill: false,
                tension: 0.3,
                pointRadius: 1,
                borderWidth: 2,
            };
        });
        // Thin out labels if too many
        const labelEvery = Math.max(1, Math.floor(sortedDates.length / 12));
        const labels = sortedDates.map((d, i) => (i % labelEvery === 0 ? d.slice(5) : ''));
        return this.renderToDataUrl({
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: false,
                scales: {
                    y: { min: 0, max: 100, title: { display: true, text: 'Interest (0–100)' } },
                },
                plugins: {
                    title: { display: true, text: 'Google Trends — Keyword Interest Over Time', font: { size: 14 } },
                    legend: { position: 'bottom', labels: { font: { size: 9 }, boxWidth: 12 } },
                },
                chartTitle: 'Trend Lines',
            },
        });
    }
    // ── 4. Segment Distribution ────────────────────────────────────────────────
    async segmentDistribution(entries) {
        log.info('Generating segment distribution chart', { segments: entries.length });
        const sorted = [...entries].sort((a, b) => b.count - a.count);
        const labels = sorted.map((e) => e.segment);
        const data = sorted.map((e) => e.count);
        return this.renderToDataUrl({
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                        data,
                        backgroundColor: sorted.map((_, i) => PALETTE[i % PALETTE.length]),
                        borderWidth: 2,
                        borderColor: '#fff',
                    }],
            },
            options: {
                responsive: false,
                plugins: {
                    title: { display: true, text: 'Target Segment Distribution', font: { size: 14 } },
                    legend: { position: 'right', labels: { font: { size: 10 }, boxWidth: 12 } },
                },
                chartTitle: 'Segment Distribution',
            },
        });
    }
    // ── 5. Engagement Comparison ───────────────────────────────────────────────
    async engagementComparison(entries) {
        log.info('Generating engagement comparison chart', { entries: entries.length });
        const sorted = [...entries].sort((a, b) => b.engagementRate - a.engagementRate).slice(0, 15);
        const labels = sorted.map((e) => e.name);
        const bgColors = sorted.map((e) => e.isCustomer ? COLOURS.gold : COLOURS.navy);
        const borderColors = sorted.map((e) => e.isCustomer ? COLOURS.goldLight : COLOURS.navyLight);
        return this.renderToDataUrl({
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Engagement Rate (%)',
                        data: sorted.map((e) => e.engagementRate),
                        backgroundColor: bgColors,
                        borderColor: borderColors,
                        borderWidth: 1,
                    },
                ],
            },
            options: {
                responsive: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Engagement Rate (%)' } },
                    x: { ticks: { maxRotation: 45, minRotation: 30, font: { size: 9 } } },
                },
                plugins: {
                    title: { display: true, text: 'Facebook Engagement Rate Comparison', font: { size: 14 } },
                    legend: { display: false },
                },
                chartTitle: 'Engagement Comparison',
            },
        });
    }
    // ── 6. Posting Frequency ───────────────────────────────────────────────────
    async postingFrequency(entries) {
        log.info('Generating posting frequency chart', { entries: entries.length });
        const sorted = [...entries].sort((a, b) => b.postsLast30d - a.postsLast30d).slice(0, 15);
        const labels = sorted.map((e) => e.name);
        const bgColors = sorted.map((e) => e.isCustomer ? COLOURS.gold : COLOURS.green);
        return this.renderToDataUrl({
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Posts (Last 30d)',
                        data: sorted.map((e) => e.postsLast30d),
                        backgroundColor: bgColors,
                        borderWidth: 0,
                    },
                ],
            },
            options: {
                responsive: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Number of Posts' } },
                    x: { ticks: { maxRotation: 45, minRotation: 30, font: { size: 9 } } },
                },
                plugins: {
                    title: { display: true, text: 'Posting Frequency (Last 30 Days)', font: { size: 14 } },
                    legend: { display: false },
                },
                chartTitle: 'Posting Frequency',
            },
        });
    }
    // ── Generate all charts for a report ───────────────────────────────────────
    async generateAll(data) {
        log.info('Generating all charts');
        const charts = {};
        const tasks = [];
        if (data.shareOfVoice?.length)
            tasks.push(['shareOfVoicePie', () => this.shareOfVoicePie(data.shareOfVoice)]);
        if (data.healthScores?.length)
            tasks.push(['healthScoreBars', () => this.healthScoreBars(data.healthScores)]);
        if (data.trendLines?.length)
            tasks.push(['trendLines', () => this.trendLines(data.trendLines)]);
        if (data.segments?.length)
            tasks.push(['segmentDistribution', () => this.segmentDistribution(data.segments)]);
        if (data.engagement?.length)
            tasks.push(['engagementComparison', () => this.engagementComparison(data.engagement)]);
        if (data.postFrequency?.length)
            tasks.push(['postingFrequency', () => this.postingFrequency(data.postFrequency)]);
        // Generate sequentially to avoid node-canvas concurrency issues
        for (const [key, fn] of tasks) {
            try {
                charts[key] = await fn();
                log.info(`Chart generated: ${key}`);
            }
            catch (err) {
                log.error(`Failed to generate chart: ${key}`, { error: err instanceof Error ? err.message : String(err) });
                charts[key] = `<div style="padding:2rem;text-align:center;color:#a0aec0;border:1px dashed #e2e8f0;border-radius:8px;">Chart unavailable: ${key}</div>`;
            }
        }
        log.info(`All charts generated: ${Object.keys(charts).length} total`);
        return charts;
    }
}
//# sourceMappingURL=charts.js.map