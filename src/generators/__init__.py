"""
Report generators package.

Modules:
  - executive_summary_generator: Pages 1–3 (Executive Brief, KPI Dashboard, Top 10)
  - intelligence_generator: Sections A–F (Health Scores, SOV, Timeline, Segments, Playbook, Actions)
  - competitor_page_generator: Individual competitor pages with enhanced data rows
"""

from .executive_summary_generator import generate_executive_summary
from .intelligence_generator import generate_intelligence_sections
from .competitor_page_generator import generate_competitor_page, generate_all_competitor_pages

__all__ = [
    'generate_executive_summary',
    'generate_intelligence_sections',
    'generate_competitor_page',
    'generate_all_competitor_pages',
]
