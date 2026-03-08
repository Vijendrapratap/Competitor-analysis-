# DEPRECATED — ported to llmAnalyzer.ts
"""
==============================================================================
LLM Intelligence Layer — OpenRouter API
==============================================================================

Uses OpenRouter (OpenAI-compatible endpoint) for all AI analysis.
Supports caching, fallback models, structured JSON extraction, and logging.

Models:
  Primary   → anthropic/claude-sonnet-4-5
  Fallback  → google/gemini-2.0-flash-001

Every API call is cached on disk for 24 h (MD5 of the prompt).
All calls are logged to logs/llm_calls.log with token usage + cost.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Optional: use the OpenAI SDK (pip install openai)
# ---------------------------------------------------------------------------
try:
    from openai import OpenAI
except ImportError:
    OpenAI = None  # type: ignore[assignment, misc]

# ===========================================================================
# Configuration
# ===========================================================================

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_API_KEY  = os.environ.get("OPENROUTER_API_KEY", "")

PRIMARY_MODEL  = os.environ.get("OPENROUTER_PRIMARY_MODEL", "anthropic/claude-sonnet-4-5")
FALLBACK_MODEL = os.environ.get("OPENROUTER_FALLBACK_MODEL", "google/gemini-2.0-flash-001")

EXTRA_HEADERS = {
    "HTTP-Referer": "https://pratap.ai",
    "X-Title": "Hua Hin Competitor Intelligence",
}

MAX_TOKENS   = int(os.environ.get("OPENROUTER_MAX_TOKENS", "2000"))
MAX_RETRIES  = int(os.environ.get("OPENROUTER_MAX_RETRIES", "2"))
TEMPERATURE  = 0.3

# Cache settings
CACHE_DIR = Path("cache/llm")
CACHE_TTL = timedelta(hours=24)

# Logging
LOG_DIR  = Path("logs")
LOG_FILE = LOG_DIR / "llm_calls.log"

# ===========================================================================
# Logging setup
# ===========================================================================

LOG_DIR.mkdir(parents=True, exist_ok=True)

_file_handler = logging.FileHandler(LOG_FILE, encoding="utf-8")
_file_handler.setFormatter(
    logging.Formatter("%(asctime)s | %(levelname)s | %(message)s")
)

log = logging.getLogger("llm_analyzer")
log.setLevel(logging.INFO)
log.addHandler(_file_handler)
log.addHandler(logging.StreamHandler())

# Running cost accumulator (reset per process)
_session_stats: dict[str, Any] = {
    "calls": 0,
    "prompt_tokens": 0,
    "completion_tokens": 0,
    "total_tokens": 0,
    "cache_hits": 0,
    "errors": 0,
}

# ===========================================================================
# OpenRouter client
# ===========================================================================

def _get_client() -> "OpenAI":
    """Return a configured OpenAI client pointing at OpenRouter."""
    if OpenAI is None:
        raise ImportError(
            "The 'openai' package is required.  Install with:  pip install openai"
        )
    if not OPENROUTER_API_KEY:
        raise EnvironmentError(
            "OPENROUTER_API_KEY is not set.  "
            "Get your key at https://openrouter.ai/keys"
        )
    return OpenAI(
        base_url=OPENROUTER_BASE_URL,
        api_key=OPENROUTER_API_KEY,
        default_headers=EXTRA_HEADERS,
    )


# ===========================================================================
# Disk-based cache
# ===========================================================================

def _cache_key(prompt: str, model: str) -> str:
    """Deterministic cache key from prompt + model."""
    raw = f"{model}::{prompt}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


def _cache_path(key: str) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return CACHE_DIR / f"{key}.json"


def _read_cache(key: str) -> dict | None:
    """Return cached response if it exists and is within TTL."""
    path = _cache_path(key)
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        cached_at = datetime.fromisoformat(data.get("cached_at", ""))
        if datetime.now(timezone.utc) - cached_at > CACHE_TTL:
            path.unlink(missing_ok=True)
            return None
        _session_stats["cache_hits"] += 1
        log.info("Cache HIT  key=%s", key[:12])
        return data.get("response")
    except Exception:
        return None


def _write_cache(key: str, response: dict) -> None:
    """Persist an API response to disk."""
    path = _cache_path(key)
    payload = {
        "cached_at": datetime.now(timezone.utc).isoformat(),
        "response": response,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    log.info("Cache WRITE key=%s", key[:12])


# ===========================================================================
# Low-level call with retry + fallback
# ===========================================================================

def _call_llm(
    system_prompt: str,
    user_prompt: str,
    *,
    model: str | None = None,
    max_tokens: int = MAX_TOKENS,
    temperature: float = TEMPERATURE,
    use_cache: bool = True,
) -> dict[str, Any]:
    """
    Send a chat-completion request to OpenRouter.

    Returns dict with keys:
      content   – raw text response
      model     – model that actually answered
      usage     – {prompt_tokens, completion_tokens, total_tokens}
      cached    – whether the response came from cache
    """
    model = model or PRIMARY_MODEL
    full_prompt = f"{system_prompt}\n\n{user_prompt}"

    # ── Check cache ──
    if use_cache:
        key = _cache_key(full_prompt, model)
        cached = _read_cache(key)
        if cached is not None:
            return {**cached, "cached": True}
    else:
        key = ""

    # ── API call with retry ──
    client = _get_client()
    models_to_try = [model]
    if model == PRIMARY_MODEL and FALLBACK_MODEL and FALLBACK_MODEL != model:
        models_to_try.append(FALLBACK_MODEL)

    last_error: Exception | None = None
    for attempt_model in models_to_try:
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                t0 = time.monotonic()
                resp = client.chat.completions.create(
                    model=attempt_model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    max_tokens=max_tokens,
                    temperature=temperature,
                )
                elapsed = time.monotonic() - t0

                usage = {
                    "prompt_tokens": resp.usage.prompt_tokens if resp.usage else 0,
                    "completion_tokens": resp.usage.completion_tokens if resp.usage else 0,
                    "total_tokens": resp.usage.total_tokens if resp.usage else 0,
                }
                _session_stats["calls"] += 1
                _session_stats["prompt_tokens"] += usage["prompt_tokens"]
                _session_stats["completion_tokens"] += usage["completion_tokens"]
                _session_stats["total_tokens"] += usage["total_tokens"]

                content = resp.choices[0].message.content or ""

                log.info(
                    "LLM OK  model=%s  tokens=%d  elapsed=%.1fs",
                    attempt_model,
                    usage["total_tokens"],
                    elapsed,
                )

                result = {
                    "content": content,
                    "model": attempt_model,
                    "usage": usage,
                    "cached": False,
                }

                if use_cache and key:
                    _write_cache(key, result)

                return result

            except Exception as exc:
                last_error = exc
                _session_stats["errors"] += 1
                log.warning(
                    "LLM ERROR  model=%s  attempt=%d/%d  error=%s",
                    attempt_model,
                    attempt,
                    MAX_RETRIES,
                    str(exc)[:200],
                )
                if attempt < MAX_RETRIES:
                    time.sleep(2 ** attempt)  # exponential back-off

    raise RuntimeError(
        f"All LLM attempts failed.  Last error: {last_error}"
    )


# ===========================================================================
# JSON extraction helper
# ===========================================================================

def _extract_json(text: str) -> dict | list:
    """
    Extract a JSON object or array from LLM output.
    Handles markdown code-fence wrapping, trailing commas, etc.
    """
    # Strip markdown fences
    text = re.sub(r"```(?:json)?\s*", "", text)
    text = re.sub(r"```\s*$", "", text)
    text = text.strip()

    # Try to locate JSON boundaries
    for start_char, end_char in [("{", "}"), ("[", "]")]:
        start = text.find(start_char)
        end = text.rfind(end_char)
        if start != -1 and end != -1 and end > start:
            candidate = text[start : end + 1]
            # Remove trailing commas before closing braces / brackets
            candidate = re.sub(r",\s*([}\]])", r"\1", candidate)
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                continue

    raise ValueError(f"Could not extract JSON from LLM response: {text[:200]}")


# ===========================================================================
# Prompt 5A — Analyze a single competitor's strategy
# ===========================================================================

COMPETITOR_SYSTEM_PROMPT = """You are a senior competitive intelligence analyst specializing in the hospitality and hotel industry in Hua Hin, Thailand.

You will receive structured data about a competitor's Facebook posts, Meta ads, and ad categories. Analyze their marketing strategy and return your analysis as a JSON object.

IMPORTANT: Return ONLY valid JSON — no markdown, no commentary, no explanation outside the JSON."""

COMPETITOR_USER_TEMPLATE = """Analyze the following competitor data and return a JSON object with these exact keys:

{{
  "strategy_summary": "2-3 sentence summary of their overall marketing strategy",
  "primary_strategy": "one of: brand_awareness | direct_response | engagement | promotional | mixed",
  "usp_detected": ["list of unique selling propositions you can identify"],
  "target_segments": ["list of customer segments they appear to target"],
  "cta_patterns": ["list of call-to-action patterns used"],
  "content_themes": ["list of recurring content themes"],
  "ad_spend_indicator": "one of: heavy | moderate | light | minimal",
  "threat_level": "one of: high | medium | low",
  "threat_reasoning": "1-2 sentence explanation of threat assessment",
  "opportunities": ["list of gaps or opportunities you see vs this competitor"],
  "language_split": {{
    "thai_pct": 0,
    "english_pct": 0,
    "mixed_pct": 0
  }},
  "posting_cadence": "one of: daily | several_per_week | weekly | sporadic | dormant",
  "estimated_monthly_budget_thb": "one of: <50k | 50-200k | 200-500k | 500k-1M | 1M+"
}}

=== COMPETITOR DATA ===
Competitor Name: {competitor_name}

Recent Posts ({post_count} posts, last 7 days):
{posts_summary}

Active Ads ({ad_count} ads):
{ads_summary}

Ad Categories:
{categories_summary}

Engagement Metrics:
- Average engagement per post: {avg_engagement}
- Top post engagement: {top_engagement}
"""


def analyze_competitor_strategy(competitor_data: dict) -> dict:
    """
    Analyze a single competitor's strategy using the LLM.

    Parameters
    ----------
    competitor_data : dict
        Aggregated data for one competitor with keys like:
        competitorName, recentPosts, activeAds, adsByCategory, summary

    Returns
    -------
    dict  — structured analysis with strategy, segments, threat level, etc.
    """
    name = competitor_data.get("competitorName", "Unknown")
    posts = competitor_data.get("recentPosts", [])
    ads = competitor_data.get("activeAds", [])
    cats = competitor_data.get("adsByCategory", {})
    summary = competitor_data.get("summary", {})

    # ── Build text summaries for the prompt ──
    posts_lines = []
    for p in posts[:10]:
        text = (p.get("postText") or "")[:200]
        eng = p.get("likes", 0) + p.get("comments", 0) + p.get("shares", 0)
        posts_lines.append(f"  - [{p.get('postDate', '?')}] {text}  (engagement: {eng})")
    posts_summary = "\n".join(posts_lines) if posts_lines else "  No recent posts available."

    ads_lines = []
    for a in ads[:8]:
        headline = (a.get("adHeadline") or "")[:150]
        ad_text = (a.get("adText") or "")[:150]
        cta = a.get("callToAction", "None")
        platforms = ", ".join(a.get("platforms", ["Facebook"]))
        ads_lines.append(f"  - [{cta}] {headline} | {ad_text}  ({platforms})")
    ads_summary = "\n".join(ads_lines) if ads_lines else "  No active ads found."

    cat_lines = []
    for cat_name, cat_ads in cats.items():
        count = len(cat_ads) if isinstance(cat_ads, list) else 0
        cat_lines.append(f"  - {cat_name}: {count} ads")
    categories_summary = "\n".join(cat_lines) if cat_lines else "  No category data."

    user_prompt = COMPETITOR_USER_TEMPLATE.format(
        competitor_name=name,
        post_count=len(posts),
        posts_summary=posts_summary,
        ad_count=len(ads),
        ads_summary=ads_summary,
        categories_summary=categories_summary,
        avg_engagement=summary.get("avgEngagementPerPost", 0),
        top_engagement=(
            sum(
                (summary.get("topPerformingPost") or {}).get(k, 0)
                for k in ("likes", "comments", "shares")
            )
            if summary.get("topPerformingPost")
            else 0
        ),
    )

    log.info("Analyzing competitor: %s", name)
    result = _call_llm(COMPETITOR_SYSTEM_PROMPT, user_prompt)

    try:
        analysis = _extract_json(result["content"])
    except ValueError:
        # Retry once if JSON extraction fails
        log.warning("JSON parse failed for %s — retrying with stricter prompt", name)
        retry = _call_llm(
            COMPETITOR_SYSTEM_PROMPT,
            user_prompt + "\n\nREMINDER: Return ONLY the JSON object, nothing else.",
            use_cache=False,
        )
        analysis = _extract_json(retry["content"])

    if isinstance(analysis, dict):
        analysis["_meta"] = {
            "model": result.get("model"),
            "cached": result.get("cached", False),
            "tokens": result.get("usage", {}),
            "analyzed_at": datetime.now(timezone.utc).isoformat(),
        }

    return analysis


# ===========================================================================
# Prompt 5B — Generate market-wide intelligence
# ===========================================================================

MARKET_SYSTEM_PROMPT = """You are a senior market intelligence strategist specializing in the Hua Hin, Thailand hospitality sector.

You will receive a summary of all competitors in the market. Produce a comprehensive market intelligence report as a JSON object.

IMPORTANT: Return ONLY valid JSON — no markdown, no commentary."""

MARKET_USER_TEMPLATE = """Analyze the following market data and return a JSON object with these exact keys:

{{
  "market_overview": "3-4 sentence overview of the competitive landscape",
  "dominant_strategies": [
    {{"strategy": "name", "competitors": ["who uses it"], "effectiveness": "high/medium/low"}}
  ],
  "market_segments": [
    {{"segment": "name", "saturation": "high/medium/low", "competitors_targeting": ["names"]}}
  ],
  "content_trends": [
    {{"trend": "description", "direction": "rising/stable/declining", "examples": ["competitor examples"]}}
  ],
  "playbook": [
    {{"action": "specific tactical recommendation", "priority": "high/medium/low", "rationale": "why", "expected_impact": "what it achieves"}}
  ],
  "recommended_actions": [
    {{"action": "actionable step", "timeframe": "immediate/short_term/medium_term", "effort": "low/medium/high", "impact": "high/medium/low"}}
  ],
  "gaps_and_opportunities": [
    {{"opportunity": "description", "evidence": "supporting data"}}
  ],
  "risk_factors": [
    {{"risk": "description", "severity": "high/medium/low", "mitigation": "suggested response"}}
  ]
}}

=== MARKET DATA ===
Total competitors analyzed: {total_competitors}
Report date: {report_date}

{competitors_block}
"""


def generate_market_intelligence(all_competitors: list[dict]) -> dict:
    """
    Generate market-wide intelligence from all competitor data.

    Parameters
    ----------
    all_competitors : list[dict]
        List of aggregated competitor data dicts (same shape as
        the items passed to analyze_competitor_strategy).

    Returns
    -------
    dict — market intelligence with playbook, actions, trends, segments.
    """
    # Build condensed competitor block
    blocks = []
    for comp in all_competitors:
        name = comp.get("competitorName", "Unknown")
        s = comp.get("summary", {})
        blocks.append(
            f"## {name}\n"
            f"  Posts (7d): {s.get('totalPostsFound', 0)}\n"
            f"  Active ads: {s.get('activeAdsCount', 0)}\n"
            f"  Avg engagement: {s.get('avgEngagementPerPost', 0)}\n"
            f"  Ad categories: {list(comp.get('adsByCategory', {}).keys())}\n"
            f"  Top post: {(comp.get('summary', {}).get('topPerformingPost') or {}).get('postText', 'N/A')[:120]}\n"
        )

    user_prompt = MARKET_USER_TEMPLATE.format(
        total_competitors=len(all_competitors),
        report_date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        competitors_block="\n".join(blocks),
    )

    log.info("Generating market intelligence for %d competitors", len(all_competitors))
    result = _call_llm(
        MARKET_SYSTEM_PROMPT,
        user_prompt,
        max_tokens=3000,
    )

    try:
        intel = _extract_json(result["content"])
    except ValueError:
        log.warning("JSON parse failed for market intel — retrying")
        retry = _call_llm(
            MARKET_SYSTEM_PROMPT,
            user_prompt + "\n\nREMINDER: Return ONLY the JSON object.",
            max_tokens=3000,
            use_cache=False,
        )
        intel = _extract_json(retry["content"])

    if isinstance(intel, dict):
        intel["_meta"] = {
            "model": result.get("model"),
            "cached": result.get("cached", False),
            "tokens": result.get("usage", {}),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    return intel


# ===========================================================================
# Prompt 5C — Generate executive brief text (pure data transform, no API)
# ===========================================================================

def generate_executive_brief_text(market_intel: dict) -> str:
    """
    Format market intelligence JSON into a concise executive summary.

    This is a pure data transform — no LLM call.  Designed to produce a
    plain-text brief suitable for email, Slack, or the report cover page.

    Parameters
    ----------
    market_intel : dict
        Output from generate_market_intelligence().

    Returns
    -------
    str — formatted executive brief text.
    """
    lines: list[str] = []
    timestamp = (market_intel.get("_meta") or {}).get(
        "generated_at", datetime.now(timezone.utc).isoformat()
    )

    lines.append("=" * 60)
    lines.append("  EXECUTIVE INTELLIGENCE BRIEF")
    lines.append(f"  Generated: {timestamp[:10]}")
    lines.append("=" * 60)
    lines.append("")

    # Market overview
    overview = market_intel.get("market_overview", "No overview available.")
    lines.append("📊 MARKET OVERVIEW")
    lines.append(f"   {overview}")
    lines.append("")

    # Dominant strategies
    strategies = market_intel.get("dominant_strategies", [])
    if strategies:
        lines.append("🎯 DOMINANT STRATEGIES")
        for s in strategies[:5]:
            eff = s.get("effectiveness", "?")
            comps = ", ".join(s.get("competitors", [])[:3])
            lines.append(f"   • {s.get('strategy', '?')} [{eff}] — {comps}")
        lines.append("")

    # Top recommended actions
    actions = market_intel.get("recommended_actions", [])
    if actions:
        lines.append("✅ RECOMMENDED ACTIONS")
        for i, a in enumerate(actions[:5], 1):
            tf = a.get("timeframe", "?")
            lines.append(f"   {i}. [{tf.upper()}] {a.get('action', '?')}")
        lines.append("")

    # Key opportunities
    opps = market_intel.get("gaps_and_opportunities", [])
    if opps:
        lines.append("💡 KEY OPPORTUNITIES")
        for o in opps[:3]:
            lines.append(f"   • {o.get('opportunity', '?')}")
            lines.append(f"     Evidence: {o.get('evidence', 'N/A')}")
        lines.append("")

    # Risk factors
    risks = market_intel.get("risk_factors", [])
    if risks:
        lines.append("⚠️  RISK FACTORS")
        for r in risks[:3]:
            sev = r.get("severity", "?")
            lines.append(f"   • [{sev.upper()}] {r.get('risk', '?')}")
            lines.append(f"     Mitigation: {r.get('mitigation', 'N/A')}")
        lines.append("")

    # Session stats
    lines.append("─" * 60)
    lines.append("  LLM Session Stats")
    lines.append(f"  API calls: {_session_stats['calls']}")
    lines.append(f"  Cache hits: {_session_stats['cache_hits']}")
    lines.append(f"  Total tokens: {_session_stats['total_tokens']:,}")
    lines.append(f"  Errors: {_session_stats['errors']}")
    lines.append("─" * 60)

    return "\n".join(lines)


# ===========================================================================
# Cost summary (convenience)
# ===========================================================================

def get_session_cost_summary() -> dict:
    """
    Return current session usage stats.

    Rough cost estimation based on typical OpenRouter pricing:
      claude-sonnet-4-5  ≈ $3/M input, $15/M output
      gemini-2.0-flash   ≈ $0.10/M input, $0.40/M output
    """
    stats = dict(_session_stats)
    # Conservative estimate using Claude pricing
    input_cost = (stats["prompt_tokens"] / 1_000_000) * 3.0
    output_cost = (stats["completion_tokens"] / 1_000_000) * 15.0
    stats["estimated_cost_usd"] = round(input_cost + output_cost, 4)
    return stats


# ===========================================================================
# Module self-test
# ===========================================================================

if __name__ == "__main__":
    print("LLM Analyzer — module loaded successfully")
    print(f"  Primary model:  {PRIMARY_MODEL}")
    print(f"  Fallback model: {FALLBACK_MODEL}")
    print(f"  Cache dir:      {CACHE_DIR.resolve()}")
    print(f"  Log file:       {LOG_FILE.resolve()}")

    if not OPENROUTER_API_KEY:
        print("\n⚠  OPENROUTER_API_KEY is not set — API calls will fail.")
        print("   Set it in your .env or export it before running.")
    else:
        print(f"\n✅ API key detected (ends in ...{OPENROUTER_API_KEY[-4:]})")

    # Quick smoke-test with sample data
    sample = {
        "competitorName": "Test Hotel",
        "recentPosts": [
            {"postText": "Welcome to our beachfront paradise!", "likes": 50, "comments": 5, "shares": 3, "postDate": "2025-01-01"}
        ],
        "activeAds": [
            {"adHeadline": "Book Now — 30% Off", "adText": "Luxury rooms from 2,999 THB", "callToAction": "Book Now", "platforms": ["Facebook", "Instagram"]}
        ],
        "adsByCategory": {"promotional": [{}], "branding": [{}, {}]},
        "summary": {
            "totalPostsFound": 1,
            "activeAdsCount": 1,
            "avgEngagementPerPost": 19,
            "topPerformingPost": {"likes": 50, "comments": 5, "shares": 3, "postText": "Welcome to our beachfront paradise!"},
        },
    }

    print("\nSample competitor data prepared.  Run analyze_competitor_strategy(sample) to test.")
