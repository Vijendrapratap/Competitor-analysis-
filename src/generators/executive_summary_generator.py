# DEPRECATED — ported to executiveSummaryGenerator.ts
"""
Executive Summary Generator — Pages 1–3 of the Competitor Intelligence Report.

Generates:
  Page 1: Executive Brief (1-page decision doc)
  Page 2: KPI Dashboard (4 KPI cards + SVG pie & bar charts)
  Page 3: Top 10 Rankings + Strategy Frequency SVG chart

Usage:
    from generators.executive_summary_generator import generate_executive_summary
    html = generate_executive_summary(report_data)
"""

import math
import os
from datetime import datetime
from jinja2 import Environment, FileSystemLoader


# ─────────────────────────────────────────────────────────────────────────────
# SVG Chart Generators
# ─────────────────────────────────────────────────────────────────────────────

def generate_pie_chart_svg(
    active: int,
    inactive: int,
    width: int = 200,
    height: int = 200,
) -> str:
    """
    SVG pie chart — "Market Participation" (Active Advertisers vs No Ads).
    Returns inline SVG string.
    """
    total = active + inactive
    if total == 0:
        return '<svg width="{}" height="{}"></svg>'.format(width, height)

    cx, cy, r = width / 2, height / 2 - 10, 70
    active_pct = active / total
    inactive_pct = inactive / total

    # Calculate arc endpoints
    active_angle = active_pct * 2 * math.pi
    active_x = cx + r * math.sin(active_angle)
    active_y = cy - r * math.cos(active_angle)
    large_arc_active = 1 if active_pct > 0.5 else 0
    large_arc_inactive = 1 if inactive_pct > 0.5 else 0

    svg = f'<svg width="{width}" height="{height + 30}" xmlns="http://www.w3.org/2000/svg">'

    if active_pct == 1:
        svg += f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#16A34A" />'
    elif inactive_pct == 1:
        svg += f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#E5E7EB" />'
    else:
        # Active slice (green)
        svg += (
            f'<path d="M {cx} {cy} L {cx} {cy - r} '
            f'A {r} {r} 0 {large_arc_active} 1 {active_x:.1f} {active_y:.1f} Z" '
            f'fill="#16A34A" />'
        )
        # Inactive slice (grey)
        svg += (
            f'<path d="M {cx} {cy} L {active_x:.1f} {active_y:.1f} '
            f'A {r} {r} 0 {large_arc_inactive} 1 {cx} {cy - r} Z" '
            f'fill="#E5E7EB" />'
        )

    # Legend
    legend_y = height + 5
    svg += f'<rect x="{cx - 70}" y="{legend_y}" width="10" height="10" fill="#16A34A" rx="2" />'
    svg += f'<text x="{cx - 55}" y="{legend_y + 9}" font-size="9" fill="#374151" font-family="Inter, sans-serif">Active ({active}, {active_pct*100:.0f}%)</text>'
    svg += f'<rect x="{cx + 20}" y="{legend_y}" width="10" height="10" fill="#E5E7EB" rx="2" />'
    svg += f'<text x="{cx + 35}" y="{legend_y + 9}" font-size="9" fill="#374151" font-family="Inter, sans-serif">No Ads ({inactive})</text>'

    svg += '</svg>'
    return svg


def generate_bar_chart_svg(
    heavy: int,
    moderate: int,
    light: int,
    none: int,
    width: int = 260,
    height: int = 180,
) -> str:
    """
    SVG horizontal bar chart — "Ad Volume Distribution by Tier".
    """
    tiers = [
        ('Heavy (10+)', heavy, '#16A34A'),
        ('Moderate (2-9)', moderate, '#F59E0B'),
        ('Light (1)', light, '#3B82F6'),
        ('None (0)', none, '#E5E7EB'),
    ]

    max_val = max(t[1] for t in tiers) or 1
    bar_h = 22
    gap = 10
    label_w = 95
    bar_area_w = width - label_w - 40

    svg = f'<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">'

    y = 15
    for label, value, color in tiers:
        # Label
        svg += (
            f'<text x="{label_w - 5}" y="{y + bar_h / 2 + 4}" '
            f'font-size="9" fill="#374151" font-family="Inter, sans-serif" text-anchor="end">'
            f'{label}</text>'
        )
        # Bar
        bar_w = max((value / max_val) * bar_area_w, 2) if value > 0 else 0
        svg += f'<rect x="{label_w}" y="{y}" width="{bar_w:.0f}" height="{bar_h}" fill="{color}" rx="3" />'
        # Value
        svg += (
            f'<text x="{label_w + bar_w + 5:.0f}" y="{y + bar_h / 2 + 4}" '
            f'font-size="10" fill="#1A2540" font-family="Inter, sans-serif" font-weight="700">'
            f'{value}</text>'
        )
        y += bar_h + gap

    svg += '</svg>'
    return svg


def generate_strategy_chart_svg(
    strategies: list[dict],
    width: int = 500,
    height: int = 0,
) -> str:
    """
    SVG horizontal bar chart for strategy frequency.
    strategies: list of {"name": str, "count": int}
    """
    if not strategies:
        return ''

    bar_h = 18
    gap = 8
    label_w = 130
    bar_area_w = width - label_w - 50
    total_h = (bar_h + gap) * len(strategies) + 10
    if height == 0:
        height = total_h

    max_val = max(s['count'] for s in strategies) or 1

    svg = f'<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">'

    y = 5
    for s in strategies:
        svg += (
            f'<text x="{label_w - 5}" y="{y + bar_h / 2 + 4}" '
            f'font-size="9" fill="#374151" font-family="Inter, sans-serif" text-anchor="end">'
            f'{s["name"]}</text>'
        )
        bar_w = max((s['count'] / max_val) * bar_area_w, 2)
        svg += f'<rect x="{label_w}" y="{y}" width="{bar_w:.0f}" height="{bar_h}" fill="#0057B8" rx="3" />'
        svg += (
            f'<text x="{label_w + bar_w + 5:.0f}" y="{y + bar_h / 2 + 4}" '
            f'font-size="10" fill="#1A2540" font-family="Inter, sans-serif" font-weight="600">'
            f'{s["count"]}</text>'
        )
        y += bar_h + gap

    svg += '</svg>'
    return svg


# ─────────────────────────────────────────────────────────────────────────────
# Data Extraction Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _classify_ad_tier(ad_count: int) -> str:
    """Classify a competitor into an ad volume tier."""
    if ad_count >= 10:
        return 'heavy'
    elif ad_count >= 2:
        return 'moderate'
    elif ad_count == 1:
        return 'light'
    return 'none'


def _extract_strategies(competitors: list[dict]) -> list[dict]:
    """Extract strategy frequency from competitors."""
    counts: dict[str, int] = {}
    for comp in competitors:
        strategy = comp.get('marketing_strategy', comp.get('strategy', ''))
        if not strategy:
            continue
        # Split comma-separated strategies
        for s in strategy.split(','):
            s = s.strip()
            if s:
                counts[s] = counts.get(s, 0) + 1

    return sorted(
        [{'name': k, 'count': v} for k, v in counts.items()],
        key=lambda x: x['count'],
        reverse=True,
    )[:10]


# ─────────────────────────────────────────────────────────────────────────────
# Main Generator
# ─────────────────────────────────────────────────────────────────────────────

def generate_executive_summary(report_data: dict) -> str:
    """
    Generate HTML for the executive summary (pages 1–3).

    report_data keys:
      - competitors: list of competitor dicts
      - report_date: str (e.g. "2026-02-15")
      - client_name: str (optional)
      - client_ad_count: int (optional)
      - market_status: str ("heating_up" | "hot" | "stable")
      - threat_level: str ("high" | "medium_high" | "medium" | "low")
      - top_3_insights: list of str
      - recommended_actions: list of str
      - biggest_opportunity: str
      - biggest_threat: str

    Returns: HTML string for pages 1–3
    """
    competitors = report_data.get('competitors', [])
    report_date = report_data.get('report_date', datetime.now().strftime('%Y-%m-%d'))

    # Parse date
    try:
        dt = datetime.strptime(report_date, '%Y-%m-%d')
    except (ValueError, TypeError):
        dt = datetime.now()

    date_en = dt.strftime('%B %Y')
    # Thai month names
    thai_months = [
        '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
    ]
    thai_year = dt.year + 543
    date_th = f'{thai_months[dt.month]} {thai_year}'

    # ── KPI Calculations ────────────────────────────────────────────────────
    total_resorts = len(competitors)
    active_advertisers = sum(1 for c in competitors if c.get('total_active_ads', 0) > 0)
    active_pct = round((active_advertisers / total_resorts) * 100) if total_resorts else 0
    total_active_ads = sum(c.get('total_active_ads', 0) for c in competitors)
    avg_ads = total_active_ads / total_resorts if total_resorts else 0

    # Ad tier counts
    tier_counts = {'heavy': 0, 'moderate': 0, 'light': 0, 'none': 0}
    for c in competitors:
        tier = _classify_ad_tier(c.get('total_active_ads', 0))
        tier_counts[tier] += 1

    # ── Top 10 ──────────────────────────────────────────────────────────────
    sorted_comps = sorted(competitors, key=lambda c: c.get('total_active_ads', 0), reverse=True)
    top_10 = sorted_comps[:10]

    # Market leader
    market_leader = None
    if top_10:
        ml = top_10[0]
        ml_share = (ml.get('total_active_ads', 0) / total_active_ads * 100) if total_active_ads else 0
        market_leader = {
            'name': ml.get('name', 'Unknown'),
            'ad_count': ml.get('total_active_ads', 0),
            'market_share': ml_share,
            'strategy_summary': ml.get('marketing_strategy', 'Strategy not analyzed'),
        }

    # Client positioning
    client_name = report_data.get('client_name', '')
    client_rank = None
    client_above_avg = False
    if client_name:
        for i, c in enumerate(sorted_comps):
            if c.get('name', '').lower() == client_name.lower():
                client_rank = i + 1
                client_above_avg = c.get('total_active_ads', 0) >= avg_ads
                break

    # Top 10 formatted
    top_10_formatted = []
    for i, c in enumerate(top_10):
        ad_count = c.get('total_active_ads', 0)
        share = (ad_count / total_active_ads * 100) if total_active_ads else 0
        top_10_formatted.append({
            'name': c.get('name', 'Unknown'),
            'ad_count': ad_count,
            'market_share': share,
            'strategy': c.get('marketing_strategy', '—'),
            'is_customer': c.get('name', '').lower() == client_name.lower() if client_name else False,
            'is_new': c.get('is_new_entrant', False),
            'is_leader': i == 0,
        })

    # Challengers (rank 2-4)
    challengers = top_10_formatted[1:4] if len(top_10_formatted) > 1 else []

    # Strategy frequency
    strategies = _extract_strategies(competitors)

    # ── Generate SVG Charts ─────────────────────────────────────────────────
    pie_svg = generate_pie_chart_svg(active_advertisers, total_resorts - active_advertisers)
    bar_svg = generate_bar_chart_svg(
        tier_counts['heavy'], tier_counts['moderate'],
        tier_counts['light'], tier_counts['none'],
    )
    strategy_svg = generate_strategy_chart_svg(strategies)

    # ── Render Template ─────────────────────────────────────────────────────
    template_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'templates')
    env = Environment(
        loader=FileSystemLoader(template_dir),
        autoescape=False,
    )
    template = env.get_template('executive_summary.html')

    return template.render(
        brand_name='UPMY SKILLS',
        date_en=date_en,
        date_th=date_th,
        total_pages=report_data.get('total_pages', 25),
        report_month_year=date_en,
        market_name=report_data.get('market_name', 'Hua Hin Luxury Resort Market'),

        # Page 1 — Executive Brief
        market_status=report_data.get('market_status', 'stable'),
        ad_activity_change=report_data.get('ad_activity_change', ''),
        client_rank=client_rank,
        total_competitors=total_resorts,
        client_above_avg=client_above_avg,
        threat_level=report_data.get('threat_level', 'medium'),
        top_3_insights=report_data.get('top_3_insights', [
            'Market data not yet analyzed',
            'Run the analysis pipeline first',
            'Results will appear here',
        ]),
        recommended_actions=report_data.get('recommended_actions', [
            'Configure competitors in the system',
            'Run the first scraping job',
            'Review results in the dashboard',
        ]),
        biggest_opportunity=report_data.get('biggest_opportunity', 'Analysis pending'),
        biggest_threat=report_data.get('biggest_threat', 'Analysis pending'),

        # Page 2 — KPI Dashboard
        total_resorts=total_resorts,
        active_advertisers=active_advertisers,
        active_pct=active_pct,
        total_active_ads=total_active_ads,
        avg_ads_per_resort=avg_ads,
        pie_chart_svg=pie_svg,
        bar_chart_svg=bar_svg,

        # Page 3 — Top 10 Rankings
        top_10_advertisers=top_10_formatted,
        market_leader=market_leader,
        challengers=challengers,
        strategy_chart_svg=strategy_svg,
    )
