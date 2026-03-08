import fs from 'node:fs';
import path from 'node:path';
import nunjucks from 'nunjucks';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.resolve(__dirname, '../templates');
// ─────────────────────────────────────────────────────────────────────────────
// Setup Nunjucks Environment
// ─────────────────────────────────────────────────────────────────────────────
const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(TEMPLATES_DIR), {
    autoescape: false,
});
// Add a custom 'format' filter to mimic Python's "%.1f%%" | format(val)
env.addFilter('format', function (val, formatString) {
    if (typeof val !== 'number')
        return String(val);
    // Very simplistic format string parser for the specific cases used in templates:
    // "%.1f%%", "%d / %d%%", "%.1f"
    if (formatString === '%.1f%%') {
        return `${val.toFixed(1)}%`;
    }
    else if (formatString === '%.1f') {
        return val.toFixed(1);
    }
    else if (formatString === '%d / %d%%' && Array.isArray(val)) {
        // Nunjucks doesn't quite pass multiple arguments to format the same way, 
        // but the template uses: "%d / %d%%" | format(active_advertisers, active_pct)
        // Actually Nunjucks passes the pipe input as the first arg, we need to handle it.
        // If we get an array like `[val1, val2]` we can format it.
    }
    return String(val);
});
// Fix for Nunjucks format filter when multiple arguments are passed
// Jinja2: `"%d / %d%%" | format(active_advertisers, active_pct)`
// Nunjucks: The format string is passed as `val`, and the args are passed after.
env.addFilter('format_jinja', function (str, ...args) {
    let i = 0;
    return str.replace(/%([.0-9]*)?[df]/g, (match, p1) => {
        const arg = args[i++];
        if (typeof arg !== 'number')
            return String(arg);
        if (p1 && p1.startsWith('.')) {
            const precision = parseInt(p1.substring(1), 10);
            return arg.toFixed(precision);
        }
        return Math.round(arg).toString();
    });
});
// ─────────────────────────────────────────────────────────────────────────────
// SVG Chart Generators
// ─────────────────────────────────────────────────────────────────────────────
export function generatePieChartSvg(active, inactive, width = 200, height = 200) {
    const total = active + inactive;
    if (total === 0) {
        return `<svg width="${width}" height="${height}"></svg>`;
    }
    const cx = width / 2;
    const cy = height / 2 - 10;
    const r = 70;
    const activePct = active / total;
    const inactivePct = inactive / total;
    // Calculate arc endpoints
    const activeAngle = activePct * 2 * Math.PI;
    const activeX = cx + r * Math.sin(activeAngle);
    const activeY = cy - r * Math.cos(activeAngle);
    const largeArcActive = activePct > 0.5 ? 1 : 0;
    const largeArcInactive = inactivePct > 0.5 ? 1 : 0;
    let svg = `<svg width="${width}" height="${height + 30}" xmlns="http://www.w3.org/2000/svg">`;
    if (activePct === 1) {
        svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#16A34A" />`;
    }
    else if (inactivePct === 1) {
        svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#E5E7EB" />`;
    }
    else {
        // Active slice (green)
        svg += `<path d="M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${largeArcActive} 1 ${activeX.toFixed(1)} ${activeY.toFixed(1)} Z" fill="#16A34A" />`;
        // Inactive slice (grey)
        svg += `<path d="M ${cx} ${cy} L ${activeX.toFixed(1)} ${activeY.toFixed(1)} A ${r} ${r} 0 ${largeArcInactive} 1 ${cx} ${cy - r} Z" fill="#E5E7EB" />`;
    }
    // Legend
    const legendY = height + 5;
    svg += `<rect x="${cx - 70}" y="${legendY}" width="10" height="10" fill="#16A34A" rx="2" />`;
    svg += `<text x="${cx - 55}" y="${legendY + 9}" font-size="9" fill="#374151" font-family="Inter, sans-serif">Active (${active}, ${(activePct * 100).toFixed(0)}%)</text>`;
    svg += `<rect x="${cx + 20}" y="${legendY}" width="10" height="10" fill="#E5E7EB" rx="2" />`;
    svg += `<text x="${cx + 35}" y="${legendY + 9}" font-size="9" fill="#374151" font-family="Inter, sans-serif">No Ads (${inactive})</text>`;
    svg += '</svg>';
    return svg;
}
export function generateBarChartSvg(heavy, moderate, light, none, width = 260, height = 180) {
    const tiers = [
        { label: 'Heavy (10+)', value: heavy, color: '#16A34A' },
        { label: 'Moderate (2-9)', value: moderate, color: '#F59E0B' },
        { label: 'Light (1)', value: light, color: '#3B82F6' },
        { label: 'None (0)', value: none, color: '#E5E7EB' },
    ];
    const maxVal = Math.max(...tiers.map(t => t.value)) || 1;
    const barH = 22;
    const gap = 10;
    const labelW = 95;
    const barAreaW = width - labelW - 40;
    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
    let y = 15;
    for (const { label, value, color } of tiers) {
        svg += `<text x="${labelW - 5}" y="${y + barH / 2 + 4}" font-size="9" fill="#374151" font-family="Inter, sans-serif" text-anchor="end">${label}</text>`;
        const barW = value > 0 ? Math.max((value / maxVal) * barAreaW, 2) : 0;
        svg += `<rect x="${labelW}" y="${y}" width="${barW.toFixed(0)}" height="${barH}" fill="${color}" rx="3" />`;
        svg += `<text x="${(labelW + barW + 5).toFixed(0)}" y="${y + barH / 2 + 4}" font-size="10" fill="#1A2540" font-family="Inter, sans-serif" font-weight="700">${value}</text>`;
        y += barH + gap;
    }
    svg += '</svg>';
    return svg;
}
export function generateStrategyChartSvg(strategies, width = 500, height = 0) {
    if (!strategies || strategies.length === 0) {
        return '';
    }
    const barH = 18;
    const gap = 8;
    const labelW = 130;
    const barAreaW = width - labelW - 50;
    const totalH = (barH + gap) * strategies.length + 10;
    if (height === 0) {
        height = totalH;
    }
    const maxVal = Math.max(...strategies.map(s => s.count)) || 1;
    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
    let y = 5;
    for (const s of strategies) {
        svg += `<text x="${labelW - 5}" y="${y + barH / 2 + 4}" font-size="9" fill="#374151" font-family="Inter, sans-serif" text-anchor="end">${s.name}</text>`;
        const barW = Math.max((s.count / maxVal) * barAreaW, 2);
        svg += `<rect x="${labelW}" y="${y}" width="${barW.toFixed(0)}" height="${barH}" fill="#0057B8" rx="3" />`;
        svg += `<text x="${(labelW + barW + 5).toFixed(0)}" y="${y + barH / 2 + 4}" font-size="10" fill="#1A2540" font-family="Inter, sans-serif" font-weight="600">${s.count}</text>`;
        y += barH + gap;
    }
    svg += '</svg>';
    return svg;
}
// ─────────────────────────────────────────────────────────────────────────────
// Data Extraction Helpers
// ─────────────────────────────────────────────────────────────────────────────
function classifyAdTier(adCount) {
    if (adCount >= 10)
        return 'heavy';
    if (adCount >= 2)
        return 'moderate';
    if (adCount === 1)
        return 'light';
    return 'none';
}
function extractStrategies(competitors) {
    const counts = {};
    for (const comp of competitors) {
        const strategy = comp.marketing_strategy || comp.strategy || '';
        if (!strategy)
            continue;
        for (const s of strategy.split(',')) {
            const trimmed = s.trim();
            if (trimmed) {
                counts[trimmed] = (counts[trimmed] || 0) + 1;
            }
        }
    }
    return Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
}
// ─────────────────────────────────────────────────────────────────────────────
// Main Generator
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Generate HTML for the executive summary (pages 1–3).
 */
export function generateExecutiveSummary(reportData) {
    const competitors = reportData.competitors || [];
    const reportDate = reportData.report_date || new Date().toISOString().substring(0, 10);
    let dt = new Date(reportDate);
    if (isNaN(dt.getTime())) {
        dt = new Date();
    }
    const dateEn = dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const thaiMonths = [
        '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
    ];
    const thaiYear = dt.getFullYear() + 543;
    const dateTh = `${thaiMonths[dt.getMonth() + 1]} ${thaiYear}`;
    // ── KPI Calculations ────────────────────────────────────────────────────
    const totalResorts = competitors.length;
    const activeAdvertisers = competitors.filter((c) => (c.total_active_ads || 0) > 0).length;
    const activePct = totalResorts ? Math.round((activeAdvertisers / totalResorts) * 100) : 0;
    const totalActiveAds = competitors.reduce((sum, c) => sum + (c.total_active_ads || 0), 0);
    const avgAds = totalResorts ? totalActiveAds / totalResorts : 0;
    // Ad tier counts
    const tierCounts = { heavy: 0, moderate: 0, light: 0, none: 0 };
    for (const c of competitors) {
        const tier = classifyAdTier(c.total_active_ads || 0);
        tierCounts[tier]++;
    }
    // ── Top 10 ──────────────────────────────────────────────────────────────
    const sortedComps = [...competitors].sort((a, b) => (b.total_active_ads || 0) - (a.total_active_ads || 0));
    const top10 = sortedComps.slice(0, 10);
    // Market leader
    let marketLeader = null;
    if (top10.length > 0) {
        const ml = top10[0];
        const mlShare = totalActiveAds ? ((ml.total_active_ads || 0) / totalActiveAds * 100) : 0;
        marketLeader = {
            name: ml.name || 'Unknown',
            ad_count: ml.total_active_ads || 0,
            market_share: mlShare,
            strategy_summary: ml.marketing_strategy || 'Strategy not analyzed',
        };
    }
    // Client positioning
    const clientName = reportData.client_name || '';
    let clientRank = null;
    let clientAboveAvg = false;
    if (clientName) {
        for (let i = 0; i < sortedComps.length; i++) {
            const c = sortedComps[i];
            if ((c.name || '').toLowerCase() === clientName.toLowerCase()) {
                clientRank = i + 1;
                clientAboveAvg = (c.total_active_ads || 0) >= avgAds;
                break;
            }
        }
    }
    // Top 10 formatted
    const top10Formatted = top10.map((c, i) => {
        const adCount = c.total_active_ads || 0;
        const share = totalActiveAds ? (adCount / totalActiveAds * 100) : 0;
        return {
            name: c.name || 'Unknown',
            ad_count: adCount,
            market_share: share,
            strategy: c.marketing_strategy || '—',
            is_customer: clientName ? (c.name || '').toLowerCase() === clientName.toLowerCase() : false,
            is_new: c.is_new_entrant || false,
            is_leader: i === 0,
        };
    });
    // Challengers (rank 2-4)
    const challengers = top10Formatted.slice(1, 4);
    // Strategy frequency
    const strategies = extractStrategies(competitors);
    // ── Generate SVG Charts ─────────────────────────────────────────────────
    const pieSvg = generatePieChartSvg(activeAdvertisers, totalResorts - activeAdvertisers);
    const barSvg = generateBarChartSvg(tierCounts.heavy, tierCounts.moderate, tierCounts.light, tierCounts.none);
    const strategySvg = generateStrategyChartSvg(strategies);
    // ── Render Template ─────────────────────────────────────────────────────
    // Nunjucks doesn't natively support Python's str.format like {{ "%.1f%%" | format(var) }}
    // We need to preprocess the template string slightly, or pass formatted strings directly.
    // Instead of complex template replacements, let's pass pre-formatted values that the template expects,
    // or use the 'format_jinja' filter we registered above which needs to be applied in the template.
    // Alternatively, modify the template in-memory before rendering.
    let templateContent = fs.readFileSync(path.join(TEMPLATES_DIR, 'executive_summary.html'), 'utf-8');
    // Convert Python Jinja filters to Nunjucks format
    templateContent = templateContent.replace(/\{\{\s*"([^"]+)"\s*\|\s*format\(([^)]+)\)\s*\}\}/g, '{{ "$1" | format_jinja($2) }}');
    return env.renderString(templateContent, {
        brand_name: 'UPMY SKILLS',
        date_en: dateEn,
        date_th: dateTh,
        total_pages: reportData.total_pages || 25,
        report_month_year: dateEn,
        market_name: reportData.market_name || 'Hua Hin Luxury Resort Market',
        // Page 1 — Executive Brief
        market_status: reportData.market_status || 'stable',
        ad_activity_change: reportData.ad_activity_change || '',
        client_rank: clientRank,
        total_competitors: totalResorts,
        client_above_avg: clientAboveAvg,
        threat_level: reportData.threat_level || 'medium',
        top_3_insights: reportData.top_3_insights || [
            'Market data not yet analyzed',
            'Run the analysis pipeline first',
            'Results will appear here',
        ],
        recommended_actions: reportData.recommended_actions || [
            'Configure competitors in the system',
            'Run the first scraping job',
            'Review results in the dashboard',
        ],
        biggest_opportunity: reportData.biggest_opportunity || 'Analysis pending',
        biggest_threat: reportData.biggest_threat || 'Analysis pending',
        // Page 2 — KPI Dashboard
        total_resorts: totalResorts,
        active_advertisers: activeAdvertisers,
        active_pct: activePct,
        total_active_ads: totalActiveAds,
        avg_ads_per_resort: avgAds,
        pie_chart_svg: pieSvg,
        bar_chart_svg: barSvg,
        // Page 3 — Top 10 Rankings
        top_10_advertisers: top10Formatted,
        market_leader: marketLeader,
        challengers: challengers,
        strategy_chart_svg: strategySvg,
    });
}
//# sourceMappingURL=executiveSummaryGenerator.js.map