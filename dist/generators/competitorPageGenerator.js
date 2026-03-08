import * as path from 'path';
import * as nunjucks from 'nunjucks';
// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function _formatCtaBreakdown(cta) {
    /** Format CTA breakdown dict into readable string. */
    if (!cta || Object.keys(cta).length === 0) {
        return '';
    }
    const parts = Object.entries(cta).sort((a, b) => b[1] - a[1]);
    return parts.map(([name, count]) => `${name} (${count} ad${count !== 1 ? 's' : ''})`).join(', ');
}
function _formatNewestDate(dateVal) {
    /**
     * Format newest ad date and return [formatted_string, css_class].
     * CSS class: date-fresh (<7d), date-recent (7-30d), date-stale (>30d).
     */
    if (!dateVal) {
        return ['', ''];
    }
    let dt;
    try {
        if (dateVal instanceof Date) {
            dt = dateVal;
        }
        else {
            dt = new Date(String(dateVal).substring(0, 10));
        }
    }
    catch (e) {
        return [String(dateVal), 'text-muted'];
    }
    if (isNaN(dt.getTime())) {
        return [String(dateVal), 'text-muted'];
    }
    const daysAgo = Math.floor((Date.now() - dt.getTime()) / (1000 * 3600 * 24));
    const formatted = dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    if (daysAgo < 7) {
        return [formatted, 'date-fresh'];
    }
    else if (daysAgo < 30) {
        return [formatted, 'date-recent'];
    }
    else {
        return [formatted, 'date-stale'];
    }
}
function _estimateThreat(adCount, healthScore, isNew) {
    /**
     * Estimate threat level and justification.
     * Returns [level, justification].
     */
    if (adCount >= 15 && healthScore >= 70) {
        return ['high', 'Dominant advertiser with strong activity and creative diversity'];
    }
    else if (adCount >= 8 || healthScore >= 60) {
        return ['medium_high', 'Significant ad presence and active campaigns'];
    }
    else if (adCount >= 3 || healthScore >= 40) {
        return ['medium', 'Moderate advertising activity'];
    }
    else if (isNew && adCount > 0) {
        return ['medium', 'New entrant — monitor for scaling'];
    }
    else if (adCount > 0) {
        return ['low', 'Minimal ad presence'];
    }
    else {
        return ['low', 'No active advertising detected'];
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Main Generator
// ─────────────────────────────────────────────────────────────────────────────
export function generateCompetitorPage(competitor, healthScore = 0.0, threatLevel = '', compNumber = 1, pageNum = 1, brandName = 'UPMY SKILLS', dateEn = '', dateTh = '') {
    /**
     * Generate HTML for one enhanced competitor page.
     *
     * competitor dict keys:
     *   - name: string
     *   - name_thai: string (optional)
     *   - facebook_page_id: string
     *   - ads_library_url: string
     *   - total_active_ads: number
     *   - screenshot_path: string (path to screenshot image, or null)
     *   - ad_types: string[]
     *   - main_promotions: string (bilingual)
     *   - marketing_strategy: string (bilingual)
     *   - key_usp: string (bilingual)
     *   - ad_formats: string[]
     *   - ad_variations: Record<string, number> (from Apify)
     *   - newest_ad_date: Date or string
     *   - target_segments: string[]
     *   - pricing_info: string
     *   - cta_breakdown: Record<string, number>
     *   - language_split: string
     *   - is_new_entrant: boolean
     *   - is_market_leader: boolean
     *
     * healthScore: number (0-100)
     * threatLevel: string ("high" | "medium_high" | "medium" | "low")
     *
     * Returns: HTML string (one full A4 page)
     */
    // Default dates
    if (!dateEn || !dateTh) {
        const now = new Date();
        dateEn = dateEn || now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const thaiMonths = [
            'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
            'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
        ];
        dateTh = dateTh || `${thaiMonths[now.getMonth()]} ${now.getFullYear() + 543}`;
    }
    // Format newest date
    const [newestFormatted, newestClass] = _formatNewestDate(competitor.newest_ad_date);
    // Format CTA breakdown
    const cta = _formatCtaBreakdown(competitor.cta_breakdown);
    // Auto-estimate threat if not provided
    let threatJustification = '';
    if (!threatLevel) {
        const estimated = _estimateThreat(competitor.total_active_ads || 0, healthScore, competitor.is_new_entrant || false);
        threatLevel = estimated[0];
        threatJustification = estimated[1];
    }
    else {
        // Generate justification for provided levels
        const estimated = _estimateThreat(competitor.total_active_ads || 0, healthScore, competitor.is_new_entrant || false);
        threatJustification = estimated[1];
    }
    // ── Render ──────────────────────────────────────────────────────────────
    const templateDir = path.join(__dirname, '..', 'templates');
    const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(templateDir), { autoescape: false });
    const context = {
        brand_name: brandName,
        date_en: dateEn,
        date_th: dateTh,
        comp_number: compNumber,
        page_num: pageNum,
        comp: competitor,
        health_score: healthScore,
        threat_level: threatLevel,
        threat_justification: threatJustification,
        newest_ad_formatted: newestFormatted,
        newest_ad_date_class: newestClass,
        cta_formatted: cta,
    };
    return env.render('competitor_page.html', context);
}
export function generateAllCompetitorPages(competitors, healthScores = {}, threatLevels = {}, startPage = 10, brandName = 'UPMY SKILLS', dateEn = '', dateTh = '') {
    /**
     * Generate HTML for ALL competitor pages.
     *
     * competitors: list of competitor dicts
     * healthScores: {name: score}
     * threatLevels: {name: level}
     * startPage: starting page number
     *
     * Returns: concatenated HTML for all pages
     */
    const pages = [];
    competitors.forEach((comp, i) => {
        const name = comp.name || '';
        const pageHtml = generateCompetitorPage(comp, healthScores[name] || 0.0, threatLevels[name] || '', i + 1, startPage + i, brandName, dateEn, dateTh);
        pages.push(pageHtml);
    });
    return pages.join('\n');
}
//# sourceMappingURL=competitorPageGenerator.js.map