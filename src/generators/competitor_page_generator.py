# DEPRECATED — ported to competitorPageGenerator.ts
"""
Competitor Page Generator — Enhanced individual competitor page.

Generates one A4 page per competitor with existing rows + 9 new enhanced rows.

Usage:
    from generators.competitor_page_generator import generate_competitor_page
    html = generate_competitor_page(competitor, health_score=72.5, threat_level='medium')
"""

import os
from datetime import datetime
from jinja2 import Environment, FileSystemLoader


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _format_cta_breakdown(cta: dict | None) -> str:
    """Format CTA breakdown dict into readable string."""
    if not cta:
        return ''
    parts = sorted(cta.items(), key=lambda x: x[1], reverse=True)
    return ', '.join(f'{name} ({count} ad{"s" if count != 1 else ""})' for name, count in parts)


def _format_newest_date(date_val) -> tuple[str, str]:
    """
    Format newest ad date and return (formatted_string, css_class).
    CSS class: date-fresh (<7d), date-recent (7-30d), date-stale (>30d).
    """
    if not date_val:
        return '', ''

    try:
        if isinstance(date_val, str):
            dt = datetime.strptime(date_val[:10], '%Y-%m-%d')
        elif isinstance(date_val, datetime):
            dt = date_val
        else:
            dt = datetime.strptime(str(date_val)[:10], '%Y-%m-%d')
    except (ValueError, TypeError):
        return str(date_val), 'text-muted'

    days_ago = (datetime.now() - dt).days
    formatted = dt.strftime('%d %b %Y')

    if days_ago < 7:
        return formatted, 'date-fresh'
    elif days_ago < 30:
        return formatted, 'date-recent'
    else:
        return formatted, 'date-stale'


def _estimate_threat(
    ad_count: int,
    health_score: float,
    is_new: bool,
) -> tuple[str, str]:
    """
    Estimate threat level and justification.
    Returns (level, justification).
    """
    if ad_count >= 15 and health_score >= 70:
        return 'high', 'Dominant advertiser with strong activity and creative diversity'
    elif ad_count >= 8 or health_score >= 60:
        return 'medium_high', 'Significant ad presence and active campaigns'
    elif ad_count >= 3 or health_score >= 40:
        return 'medium', 'Moderate advertising activity'
    elif is_new and ad_count > 0:
        return 'medium', 'New entrant — monitor for scaling'
    elif ad_count > 0:
        return 'low', 'Minimal ad presence'
    else:
        return 'low', 'No active advertising detected'


# ─────────────────────────────────────────────────────────────────────────────
# Main Generator
# ─────────────────────────────────────────────────────────────────────────────

def generate_competitor_page(
    competitor: dict,
    health_score: float = 0.0,
    threat_level: str = '',
    comp_number: int = 1,
    page_num: int = 1,
    brand_name: str = 'UPMY SKILLS',
    date_en: str = '',
    date_th: str = '',
) -> str:
    """
    Generate HTML for one enhanced competitor page.

    competitor dict keys:
      - name: str
      - name_thai: str (optional)
      - facebook_page_id: str
      - ads_library_url: str
      - total_active_ads: int
      - screenshot_path: str (path to screenshot image, or None)
      - ad_types: list[str]
      - main_promotions: str (bilingual)
      - marketing_strategy: str (bilingual)
      - key_usp: str (bilingual)
      - ad_formats: list[str]
      - ad_variations: dict {campaign_name: count} (from Apify)
      - newest_ad_date: date or str
      - target_segments: list[str]
      - pricing_info: str
      - cta_breakdown: dict {cta_type: count}
      - language_split: str
      - is_new_entrant: bool
      - is_market_leader: bool

    health_score: float (0-100)
    threat_level: str ("high" | "medium_high" | "medium" | "low")

    Returns: HTML string (one full A4 page)
    """
    # Default dates
    if not date_en or not date_th:
        now = datetime.now()
        date_en = date_en or now.strftime('%B %Y')
        thai_months = [
            '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
            'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
        ]
        date_th = date_th or f'{thai_months[now.month]} {now.year + 543}'

    # Format newest date
    newest_formatted, newest_class = _format_newest_date(
        competitor.get('newest_ad_date')
    )

    # Format CTA breakdown
    cta = _format_cta_breakdown(competitor.get('cta_breakdown'))

    # Auto-estimate threat if not provided
    threat_justification = ''
    if not threat_level:
        threat_level, threat_justification = _estimate_threat(
            competitor.get('total_active_ads', 0),
            health_score,
            competitor.get('is_new_entrant', False),
        )
    else:
        # Generate justification for provided levels
        _, threat_justification = _estimate_threat(
            competitor.get('total_active_ads', 0),
            health_score,
            competitor.get('is_new_entrant', False),
        )

    # ── Render ──────────────────────────────────────────────────────────────
    template_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'templates')
    env = Environment(loader=FileSystemLoader(template_dir), autoescape=False)
    template = env.get_template('competitor_page.html')

    return template.render(
        brand_name=brand_name,
        date_en=date_en,
        date_th=date_th,
        comp_number=comp_number,
        page_num=page_num,
        comp=competitor,
        health_score=health_score,
        threat_level=threat_level,
        threat_justification=threat_justification,
        newest_ad_formatted=newest_formatted,
        newest_ad_date_class=newest_class,
        cta_formatted=cta,
    )


def generate_all_competitor_pages(
    competitors: list[dict],
    health_scores: dict[str, float] | None = None,
    threat_levels: dict[str, str] | None = None,
    start_page: int = 10,
    brand_name: str = 'UPMY SKILLS',
    date_en: str = '',
    date_th: str = '',
) -> str:
    """
    Generate HTML for ALL competitor pages.

    competitors: list of competitor dicts
    health_scores: {name: score}
    threat_levels: {name: level}
    start_page: starting page number

    Returns: concatenated HTML for all pages
    """
    if health_scores is None:
        health_scores = {}
    if threat_levels is None:
        threat_levels = {}

    pages = []
    for i, comp in enumerate(competitors):
        name = comp.get('name', '')
        page_html = generate_competitor_page(
            competitor=comp,
            health_score=health_scores.get(name, 0.0),
            threat_level=threat_levels.get(name, ''),
            comp_number=i + 1,
            page_num=start_page + i,
            brand_name=brand_name,
            date_en=date_en,
            date_th=date_th,
        )
        pages.append(page_html)

    return '\n'.join(pages)
