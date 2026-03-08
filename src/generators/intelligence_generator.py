# DEPRECATED — ported to intelligenceGenerator.ts
"""
Intelligence Sections Generator — Sections A–F of the Competitor Intelligence Report.

Generates:
  A: Health Score Leaderboard    (1 page)
  B: Share of Voice              (1 page)
  C: Recent Activity Timeline    (1 page)
  D: Segment Targeting Analysis  (1 page)
  E: "Steal This" Playbook      (1 page)
  F: Recommended Actions         (1 page)

Usage:
    from generators.intelligence_generator import generate_intelligence_sections
    html = generate_intelligence_sections(report_data, intelligence)
"""

import os
from datetime import datetime, timedelta
from jinja2 import Environment, FileSystemLoader


# ─────────────────────────────────────────────────────────────────────────────
# Health Score Calculator
# ─────────────────────────────────────────────────────────────────────────────

def calculate_health_score(
    ad_count: int,
    newest_ad_age_days: int | None,
    max_ad_variations: int,
    strategy_count: int,
    engagement_rate: float = 0.0,
    market_leader_ads: int = 31,
) -> float:
    """
    Calculate competitor health score (0–100).

    Formula:
      Ad Volume (20%)       — capped at market leader level
      Freshness (20%)       — 1.0 if newest < 7 days, degrades to 0
      Creative Variations (20%) — capped at 8
      Strategy Diversity (20%)  — capped at 7
      Engagement (20%)      — capped at 5.0%
    """
    # Ad Volume: 0–20
    ad_score = min(ad_count / max(market_leader_ads, 1), 1.0) * 20

    # Freshness: 0–20
    if newest_ad_age_days is None:
        freshness = 0.0
    elif newest_ad_age_days <= 7:
        freshness = 1.0
    elif newest_ad_age_days <= 30:
        freshness = 1.0 - ((newest_ad_age_days - 7) / 23)
    elif newest_ad_age_days <= 90:
        freshness = 0.3 - ((newest_ad_age_days - 30) / 60 * 0.3)
    else:
        freshness = 0.0
    freshness_score = max(freshness, 0.0) * 20

    # Creative Variations: 0–20
    variation_score = min(max_ad_variations / 8, 1.0) * 20

    # Strategy Diversity: 0–20
    strategy_score = min(strategy_count / 7, 1.0) * 20

    # Engagement: 0–20
    engagement_score = min(engagement_rate / 5.0, 1.0) * 20

    return round(ad_score + freshness_score + variation_score + strategy_score + engagement_score, 1)


# ─────────────────────────────────────────────────────────────────────────────
# Share of Voice Calculator
# ─────────────────────────────────────────────────────────────────────────────

def calculate_share_of_voice(competitors: list[dict]) -> list[dict]:
    """
    Calculate share of voice (% of total ads) per competitor.
    Returns sorted list descending by percentage.
    """
    total_ads = sum(c.get('total_active_ads', 0) for c in competitors)
    if total_ads == 0:
        return [
            {
                'name': c.get('name', 'Unknown'),
                'pct': 0,
                'ad_count': 0,
                'trend': c.get('trend', 'stable'),
                'is_customer': c.get('is_customer', False),
            }
            for c in competitors
        ]

    result = []
    for c in competitors:
        ad_count = c.get('total_active_ads', 0)
        result.append({
            'name': c.get('name', 'Unknown'),
            'pct': (ad_count / total_ads) * 100,
            'ad_count': ad_count,
            'trend': c.get('trend', 'stable'),
            'is_customer': c.get('is_customer', False),
        })

    return sorted(result, key=lambda x: x['pct'], reverse=True)


# ─────────────────────────────────────────────────────────────────────────────
# Activity Timeline Builder
# ─────────────────────────────────────────────────────────────────────────────

def build_activity_timeline(competitors: list[dict], report_date: datetime | None = None) -> dict:
    """
    Build 4-week activity timeline, last-7-days list, gone-dark list,
    and campaign velocity stats.
    """
    if report_date is None:
        report_date = datetime.now()

    # Generate 4 weekly buckets
    weeks = []
    for i in range(4):
        week_start = report_date - timedelta(days=7 * (i + 1))
        week_end = report_date - timedelta(days=7 * i)
        weeks.append({
            'label': f'Week {4 - i} ({week_start.strftime("%d %b")} – {week_end.strftime("%d %b")})',
            'start': week_start,
            'end': week_end,
            'events': [],
        })

    last_7 = []
    gone_dark = []
    velocity = []

    for c in competitors:
        name = c.get('name', 'Unknown')
        newest_date_str = c.get('newest_ad_date', None)
        ad_count = c.get('total_active_ads', 0)

        if newest_date_str:
            try:
                newest = datetime.strptime(str(newest_date_str)[:10], '%Y-%m-%d')
            except (ValueError, TypeError):
                newest = None
        else:
            newest = None

        # Calculate days since newest ad
        if newest:
            days_ago = (report_date - newest).days
        else:
            days_ago = None

        # Classify event type
        is_new = c.get('is_new_entrant', False)
        if is_new:
            event_type = 'new_entrant'
        elif ad_count >= 5:
            event_type = 'scaling'
        elif ad_count > 0:
            event_type = 'refreshed'
        else:
            event_type = 'dark'

        # Assign to weekly bucket
        if newest:
            for week in weeks:
                if week['start'] <= newest < week['end']:
                    week['events'].append({'name': name, 'type': event_type})
                    break

        # Last 7 days
        if days_ago is not None and days_ago <= 7:
            last_7.append(f'{name} — {ad_count} ads (newest {days_ago}d ago)')

        # Gone dark
        if days_ago is not None and days_ago > 30:
            gone_dark.append(name)
        elif days_ago is None and ad_count == 0:
            gone_dark.append(name)

        # Campaign velocity (ads / 4 weeks)
        velocity.append({
            'name': name,
            'rate': ad_count / 4.0,
        })

    # Sort velocity descending, top 5
    velocity.sort(key=lambda x: x['rate'], reverse=True)

    return {
        'weeks': weeks,
        'last_7_days': last_7[:8],
        'gone_dark': gone_dark[:8],
        'campaign_velocity': velocity[:5],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Segment Analysis
# ─────────────────────────────────────────────────────────────────────────────

DEFAULT_SEGMENTS = [
    'Families', 'Couples/Romance', 'Weddings', 'MICE/Corporate',
    'Pet Owners', 'Wellness', 'Thai Residents', 'International',
]


def build_segment_matrix(
    competitors: list[dict],
    segment_data: dict | None = None,
) -> list[dict]:
    """
    Build segment targeting matrix.

    segment_data: optional pre-computed dict {segment: {active_count, saturation, opportunity}}
    If not provided, infers from competitor target_segments fields.
    """
    if segment_data:
        # Use pre-computed data
        rows = []
        for seg_name, data in segment_data.items():
            opp = data.get('opportunity', 50)
            rows.append({
                'name': seg_name,
                'active_count': data.get('active_count', 0),
                'saturation': data.get('saturation', 'medium'),
                'opportunity_score': opp,
                'is_top_opportunity': opp >= 75,
            })
        return sorted(rows, key=lambda x: x['opportunity_score'], reverse=True)

    # Infer from competitor data
    total = len(competitors)
    seg_counts: dict[str, int] = {s: 0 for s in DEFAULT_SEGMENTS}

    for c in competitors:
        targets = c.get('target_segments', [])
        for seg in targets:
            seg_norm = seg.strip()
            if seg_norm in seg_counts:
                seg_counts[seg_norm] += 1
            else:
                # Try fuzzy match
                for key in seg_counts:
                    if seg_norm.lower() in key.lower() or key.lower() in seg_norm.lower():
                        seg_counts[key] += 1
                        break

    rows = []
    for seg, count in seg_counts.items():
        pct = (count / total * 100) if total else 0
        if pct >= 50:
            saturation = 'high'
        elif pct >= 25:
            saturation = 'medium'
        else:
            saturation = 'low'

        # Opportunity inversely related to saturation
        opportunity = max(0, min(100, round(100 - pct * 1.2)))

        rows.append({
            'name': seg,
            'active_count': count,
            'saturation': saturation,
            'opportunity_score': opportunity,
            'is_top_opportunity': opportunity >= 75,
        })

    return sorted(rows, key=lambda x: x['opportunity_score'], reverse=True)


# ─────────────────────────────────────────────────────────────────────────────
# Main Generator
# ─────────────────────────────────────────────────────────────────────────────

def generate_intelligence_sections(report_data: dict, intelligence: dict) -> str:
    """
    Generate HTML for intelligence sections A–F.

    report_data keys:
      - competitors: list of competitor dicts
      - report_date: str
      - client_name: str (optional)

    intelligence keys (from LLM layer):
      - health_scores: dict {competitor_name: score} (optional — calculated if missing)
      - share_of_voice: dict {competitor_name: percentage} (optional)
      - trends: dict {competitor_name: "gaining"|"stable"|"declining"|"dark"}
      - segment_matrix: dict {segment: {active_count, saturation, opportunity}}
      - playbook: list of {campaign_name, competitor, why_it_works, evidence, your_move}
      - urgent_actions: list of str
      - important_actions: list of str
      - strategic_opportunities: list of str

    Returns: HTML string for 6 pages
    """
    competitors = report_data.get('competitors', [])
    client_name = report_data.get('client_name', '')

    # Parse date
    report_date_str = report_data.get('report_date', datetime.now().strftime('%Y-%m-%d'))
    try:
        report_dt = datetime.strptime(report_date_str, '%Y-%m-%d')
    except (ValueError, TypeError):
        report_dt = datetime.now()

    date_en = report_dt.strftime('%B %Y')
    thai_months = [
        '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
    ]
    date_th = f'{thai_months[report_dt.month]} {report_dt.year + 543}'

    total_competitors = len(competitors)

    # ── A: Health Scores ────────────────────────────────────────────────────
    supplied_scores = intelligence.get('health_scores', {})
    max_ads = max((c.get('total_active_ads', 0) for c in competitors), default=1) or 1

    health_entries = []
    for c in competitors:
        name = c.get('name', 'Unknown')
        if name in supplied_scores:
            score = supplied_scores[name]
        else:
            ad_count = c.get('total_active_ads', 0)
            newest = c.get('newest_ad_date')
            if newest:
                try:
                    age = (report_dt - datetime.strptime(str(newest)[:10], '%Y-%m-%d')).days
                except (ValueError, TypeError):
                    age = None
            else:
                age = None

            variations = max(c.get('ad_variations', {}).values(), default=0) if c.get('ad_variations') else 0
            strats = len(c.get('marketing_strategy', '').split(',')) if c.get('marketing_strategy') else 0
            engagement = c.get('engagement_rate', 0.0)

            score = calculate_health_score(
                ad_count=ad_count,
                newest_ad_age_days=age,
                max_ad_variations=variations,
                strategy_count=strats,
                engagement_rate=engagement,
                market_leader_ads=max_ads,
            )

        health_entries.append({
            'name': name,
            'score': score,
            'is_customer': name.lower() == client_name.lower() if client_name else False,
            'is_leader': c.get('is_market_leader', False),
            'is_inactive': c.get('total_active_ads', 0) == 0,
            'is_new': c.get('is_new_entrant', False),
        })

    health_entries.sort(key=lambda x: x['score'], reverse=True)

    # ── B: Share of Voice ───────────────────────────────────────────────────
    trends = intelligence.get('trends', {})
    for c in competitors:
        c['trend'] = trends.get(c.get('name', ''), 'stable')
        c['is_customer'] = (
            c.get('name', '').lower() == client_name.lower() if client_name else False
        )

    sov = calculate_share_of_voice(competitors)

    customer_sov = None
    if client_name:
        for i, entry in enumerate(sov):
            if entry['is_customer']:
                customer_sov = {
                    **entry,
                    'rank': i + 1,
                    'rank_score': max(0, 100 - (i / max(total_competitors, 1)) * 100),
                }
                break

    # ── C: Activity Timeline ────────────────────────────────────────────────
    timeline = build_activity_timeline(competitors, report_dt)

    # ── D: Segments ─────────────────────────────────────────────────────────
    segment_data = intelligence.get('segment_matrix', None)
    segments = build_segment_matrix(competitors, segment_data)

    # ── E: Playbook ─────────────────────────────────────────────────────────
    playbook = intelligence.get('playbook', [
        {
            'campaign_name': 'Analysis pending',
            'competitor': 'N/A',
            'why_it_works': 'Run the AI analysis pipeline to generate playbook insights.',
            'evidence': 'No data yet',
            'your_move': 'Complete the data collection and analysis workflow.',
        },
    ])

    # ── F: Actions ──────────────────────────────────────────────────────────
    urgent = intelligence.get('urgent_actions', ['Run the competitor analysis pipeline to generate actionable insights.'])
    important = intelligence.get('important_actions', ['Configure all competitor profiles.'])
    strategic = intelligence.get('strategic_opportunities', ['Review market positioning.'])

    # ── Render ──────────────────────────────────────────────────────────────
    template_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'templates')
    env = Environment(loader=FileSystemLoader(template_dir), autoescape=False)
    template = env.get_template('intelligence_sections.html')

    return template.render(
        brand_name='UPMY SKILLS',
        date_en=date_en,
        date_th=date_th,
        total_competitors=total_competitors,
        page_offset=report_data.get('page_offset', 3),

        # A
        health_leaderboard=health_entries,

        # B
        share_of_voice=sov,
        customer_sov=customer_sov,

        # C
        activity_weeks=timeline['weeks'],
        last_7_days=timeline['last_7_days'],
        gone_dark=timeline['gone_dark'],
        campaign_velocity=timeline['campaign_velocity'],

        # D
        segments=segments,

        # E
        playbook=playbook,

        # F
        urgent_actions=urgent,
        important_actions=important,
        strategic_opportunities=strategic,
    )
