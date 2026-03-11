# COMPETITOR INTELLIGENCE SYSTEM — DETAILED PRODUCT REQUIREMENTS DOCUMENT

**Version**: 2.0.0 (Enterprise Edition)
**Last Updated**: March 2026
**Status**: Production
**Classification**: Business Critical
**Document Owner**: Product Management
**Audience**: Technical Leads, Architects, Developers, Product Managers

---

## TABLE OF CONTENTS

1. [Document Overview & Governance](#document-overview--governance)
2. [Product Vision & Strategy](#product-vision--strategy)
3. [User Personas & Use Cases](#user-personas--use-cases)
4. [System Architecture (Detailed)](#system-architecture-detailed)
5. [Feature Specifications](#feature-specifications)
6. [API Reference (Comprehensive)](#api-reference-comprehensive)
7. [Data Model & Schema (Complete)](#data-model--schema-complete)
8. [Pipeline Architecture & Data Flow](#pipeline-architecture--data-flow)
9. [LLM Integration (Detailed)](#llm-integration-detailed)
10. [Frontend Specifications](#frontend-specifications)
11. [Backend Services (Detailed)](#backend-services-detailed)
12. [Security & Compliance](#security--compliance)
13. [Performance & Scalability](#performance--scalability)
14. [Integration Points](#integration-points)
15. [Non-Functional Requirements](#non-functional-requirements)
16. [Risk Analysis & Mitigation](#risk-analysis--mitigation)
17. [Success Metrics & KPIs](#success-metrics--kpis)
18. [Deployment & Operations](#deployment--operations)
19. [Future Roadmap](#future-roadmap)
20. [Appendices](#appendices)

---

## DOCUMENT OVERVIEW & GOVERNANCE

### Purpose

This Product Requirements Document (PRD) provides a comprehensive technical and business specification for the Competitor Intelligence System. It serves as:
- **Single source of truth** for system behavior, architecture, and data flows
- **Design reference** for developers implementing features
- **Testing blueprint** for QA validation
- **Operations manual** for deployment and maintenance
- **Compliance document** for security and regulatory audits

### Document Control

| Aspect | Details |
|--------|---------|
| **Version** | 2.0.0 |
| **Release Date** | March 11, 2026 |
| **Last Updated** | March 11, 2026 |
| **Next Review** | June 11, 2026 |
| **Change Log** | v1.0 (Initial), v2.0 (Enhanced with detailed specs) |
| **Stakeholder Review** | Required before deployment |
| **Sign-Off Authority** | CTO, VP Product, Head of Operations |

### Document Structure

Each section follows this pattern:
- **Overview**: High-level summary
- **Details**: Comprehensive specifications
- **Examples**: Real-world usage scenarios
- **Diagrams**: Visual representations
- **Technical Notes**: Implementation guidance
- **Related Sections**: Cross-references to other parts

---

## PRODUCT VISION & STRATEGY

### Vision Statement

*"Empower hospitality businesses with real-time competitive intelligence, enabling data-driven decisions that maximize market share and revenue through automated, AI-powered competitor monitoring and strategic insights."*

### Mission

1. **Automate** competitor data collection across digital channels
2. **Analyze** marketing strategies using artificial intelligence
3. **Generate** actionable intelligence reports for decision-makers
4. **Deliver** insights through multiple channels (dashboard, email, API)
5. **Enable** competitive advantage through faster, smarter analysis

### Strategic Goals

| Goal | Metric | Target | Timeline |
|------|--------|--------|----------|
| **Market Coverage** | Competitors tracked per market | 50+ | Q2 2026 |
| **Data Freshness** | Hours since last scrape | <24 hours | Active |
| **Analysis Quality** | Accuracy of health scores | >90% | Q1 2026 |
| **System Reliability** | Uptime SLA | 99.5% | Active |
| **User Adoption** | Active dashboard users | 50+ | Q2 2026 |
| **Revenue Impact** | Revenue attributed to system | >$500K | Q3 2026 |

### Competitive Advantages

1. **Automated Data Collection**: No manual data entry required
2. **AI-Powered Analysis**: Semantic understanding of competitor strategies
3. **Real-Time Insights**: Dashboard updates within 24 hours of market changes
4. **Comprehensive Tracking**: Multi-channel data (ads, social, trends, search)
5. **Actionable Recommendations**: Not just data, but strategy recommendations
6. **Easy Integration**: REST API for custom integrations
7. **Scalable Architecture**: Handles 100+ competitors with <5 min analysis

### Core Values

- **Accuracy**: Data integrity verified at every stage
- **Timeliness**: Insights delivered within SLA windows
- **Transparency**: Clear methodology, auditable analysis
- **Security**: Enterprise-grade data protection
- **Simplicity**: Intuitive interfaces for non-technical users
- **Reliability**: 24/7 uptime with incident response

---

## USER PERSONAS & USE CASES

### Persona 1: Executive Decision-Maker (CFO, VP Marketing)

**Profile**:
- Title: Chief Financial Officer or VP Marketing
- Industry: Hospitality (hotels, resorts, villas)
- Tech Savviness: Low-to-medium
- Primary Goal: Strategic decision-making with quantified insights
- Time Availability: 30 minutes per week for intelligence review

**Needs**:
- Executive summary (1-2 page brief)
- Key metrics dashboard (health score, SOV, threat level)
- Actionable recommendations ranked by impact
- Email-based report delivery (not dashboard)
- Trend analysis over 3-6 months

**Pain Points**:
- Overwhelmed by data, wants insights not raw data
- Needs justification for strategic decisions
- Manual reporting is time-consuming
- Can't react fast to market changes
- Competitor pricing changes go unnoticed

**Success Criteria**:
- Makes 1-2 strategic decisions per report informed by system
- Reports arriving on schedule, no missed deliveries
- Recommendations are implemented (adoption rate >70%)

**Example Workflow**:
```
Monday 7:00 AM → Email arrives with "Hua Hin Market Intelligence"
         ↓
     Reviews: Market status (hot/stable/cooling), top 3 threats
         ↓
     Calls team meeting: "Competitor A increased ad spend by 30%"
         ↓
     Decision: Launch counter-campaign targeting families segment
         ↓
     Success: Campaign brings in 15% more bookings vs. Q1
```

---

### Persona 2: Competitive Intelligence Analyst

**Profile**:
- Title: Marketing Analyst, Competitive Intelligence Manager
- Experience: 3-5 years in hospitality
- Tech Savviness: High
- Primary Goal: Deep competitive analysis and market insights
- Time Availability: 2-3 hours per day

**Needs**:
- Detailed competitor profiles with historical tracking
- Ad-level analysis (copy, creative, targeting, engagement)
- Pricing trends and positioning analysis
- Segment-by-segment performance breakdown
- Raw data access for custom analysis
- Export capabilities (CSV, API)

**Pain Points**:
- Manual data collection from multiple sources
- Hard to track changes over time (no history)
- Can't see what competitors are testing
- Pricing data scattered across different platforms
- No systematic way to track campaign performance

**Success Criteria**:
- Discovers 3-5 competitive insights per week
- Can identify market trends 2-3 weeks before competitors
- Reports are data-backed with visualization

**Example Workflow**:
```
Daily 9:00 AM → Check dashboard for overnight alerts
           ↓
       Review: New ads, price changes, viral posts
           ↓
       Drill down: Competitor A has 5 new wedding ads
           ↓
       Analyze: Ad copy, audience size, creative angle
           ↓
       Create: Competitive brief for marketing team
           ↓
       Impact: Team adjusts messaging, improves CTR by 8%
```

---

### Persona 3: Marketing Manager / Product Manager

**Profile**:
- Title: Marketing Manager, Product Manager
- Goals: Campaign performance vs. competitors, pricing strategy
- Tech Savviness: Medium
- Time Availability: 1-2 hours per day

**Needs**:
- Campaign-level competitor monitoring
- Pricing and packaging comparison
- Audience segment targeting analysis
- Performance benchmarking (our ads vs. competitors)
- Alert system for competitive moves
- Recommendation for strategy adjustments

**Pain Points**:
- No automated competitor price tracking
- Campaign ROI hard to benchmark
- Missing alerts when competitors launch new campaigns
- Can't easily compare segment messaging

**Success Criteria**:
- Responds to competitive moves within 48 hours
- Maintains pricing competitiveness
- Campaign messaging stays relevant to market

---

### Use Case 1: Weekly Market Briefing

**Actor**: Executive (CFO, VP Marketing)
**Frequency**: Every Monday morning
**Duration**: 30 minutes
**Goal**: Understand market status and identify urgent actions

**Flow**:

```
1. Email arrives 7:00 AM Monday
   ├─ Subject: "Market Intelligence Report - March 2026"
   ├─ Body: Executive summary (2 paragraphs)
   │  ├─ Market status (hot/heating/stable/cooling)
   │  ├─ Top 3 opportunities
   │  └─ Top 3 threats
   ├─ PDF attachment: Full intelligence report
   └─ CTA: "View on Dashboard"

2. Executive reads email (5 min)
   ├─ Identifies: "Competitor A increased budget 30%"
   ├─ Notes: "3 new wedding packages launched"
   └─ Action: "Schedule team meeting for strategy review"

3. Executive opens dashboard (if needs details)
   ├─ Views: Leaderboard (competitor rankings)
   ├─ Clicks: Competitor A detail page
   ├─ Analyzes: Health score breakdown, recent ads, pricing
   └─ Exports: Data for presentation to board

4. Outcome
   ├─ Team meeting convened
   ├─ Counter-campaign approved
   └─ ROI tracked for next month
```

**Success Metrics**:
- Email opened: >80% of delivery
- Report downloaded: >50% of opens
- Action taken: >70% of reports lead to decision
- Decision impact: >$50K revenue per report

---

### Use Case 2: Real-Time Alert Investigation

**Actor**: Competitive Intelligence Analyst
**Frequency**: As triggered
**Duration**: 15-30 minutes
**Goal**: Understand competitive move and recommend response

**Flow**:

```
1. System detects alert: "Competitor B launched high-volume ad campaign"
   ├─ Alert: NEW_CAMPAIGN
   ├─ Severity: WARNING
   ├─ Details: 12 new ads in 24 hours (vs. avg 2/day)
   └─ Timestamp: 2:45 AM UTC

2. Analyst wakes up, checks phone notification
   ├─ Opens dashboard
   ├─ Goes to Alerts page
   └─ Sees: Top 3 critical alerts sorted by severity

3. Analyst clicks on Competitor B alert
   ├─ Views: All 12 new ads
   ├─ Analyzes: Ad copy, creative type, audience size estimate
   ├─ Identifies: Focus on "couples + weddings" segment
   ├─ Notices: Price range $80-120/night (vs. our $95-115)
   └─ Observes: High engagement (2,000+ reactions, 300+ comments)

4. Analyst creates internal report
   ├─ Findings: "Competitor B aggressive wedding push"
   ├─ Implication: "Our segment market share at risk"
   ├─ Recommendation: "Launch counter-campaign within 48h"
   ├─ Timeline: "Window closes in 5 days (standard campaign duration)"
   └─ Escalation: Send to VP Marketing with flagged urgency

5. VP Marketing approves action within 4 hours
   ├─ Campaign brief created
   ├─ Creative team alerted
   ├─ Spend budget: $5K allocated
   └─ Timeline: Launch within 24 hours

6. Campaign launches, system tracks performance
   ├─ System monitors both our ads + competitor ads
   ├─ Daily report on engagement rates, reach, conversions
   └─ Monthly impact: +8% bookings in couples segment

7. Outcome
   ├─ Alert detection: 2 hours (vs. 3-5 days manual discovery)
   ├─ Response time: 4 hours to approval
   ├─ Revenue impact: +$30K over month
   └─ Analyst time: 30 minutes detection to recommendation
```

**Success Metrics**:
- Alert detection time: <5 hours after competitor action
- False positive rate: <10%
- Analyst action rate: >80% of critical alerts lead to response
- Response time: <48 hours from alert to action

---

### Use Case 3: Pricing Strategy Analysis

**Actor**: Revenue Manager, Product Manager
**Frequency**: Monthly or as triggered by price alerts
**Duration**: 1-2 hours
**Goal**: Optimize pricing strategy based on competitive landscape

**Flow**:

```
1. Manager navigates to Competitors page
   ├─ Opens "Pricing Analysis" tab
   ├─ Selects: Date range (last 90 days)
   └─ Segment: "Premium rooms"

2. System displays pricing heatmap
   ├─ X-axis: Date (last 90 days)
   ├─ Y-axis: Competitors (ranked by price tier)
   ├─ Colors: Price range ($80-$200/night)
   └─ Pattern: Shows all price changes over time

3. Manager identifies trends
   ├─ Competitor A: Dropped $95→$85 (8 weeks ago)
   ├─ Competitor C: Raised $105→$120 (3 weeks ago)
   ├─ Our hotel: Stable at $100
   ├─ Market median: $105
   └─ Insight: We're underpriced vs. competitors

4. Manager drills into competitor data
   ├─ Competitor C (premium): $120/night
   │  ├─ Health score: 85 (highest in category)
   │  ├─ Ad volume: 45 ads (highest)
   │  └─ Engagement: 8.5% (highest)
   ├─ Competitor A (budget): $85/night
   │  ├─ Health score: 60
   │  ├─ Ad volume: 12 ads
   │  └─ Engagement: 2.1%
   └─ Analysis: Quality commands price premium

5. Manager views our positioning
   ├─ Our health score: 78 (above average)
   ├─ Our ad volume: 28 (above average)
   ├─ Our engagement: 6.2% (above average)
   ├─ Comparable to: Competitor B at $110 (health 76)
   └─ Recommendation: Can support $105-110 pricing

6. Manager creates pricing proposal
   ├─ Test: Increase to $105 for 2 weeks
   ├─ Segment: "Premium rooms" only (lower risk)
   ├─ Hypothesis: "Similar quality to Competitor B, justified $105 price"
   ├─ Success metric: "No reduction in booking rate vs. previous month"
   └─ Timeline: Start Friday for weekend test

7. System monitors impact
   ├─ Tracks: Our price vs. competitors
   ├─ Monitors: Booking volume, ADR, RevPAR
   ├─ Compares: Our engagement vs. competitors
   └─ Reports: Weekly on pricing test results

8. Outcome
   ├─ Price increase to $105 successful (+2% occupancy)
   ├─ Full implementation for $110 (month 2)
   ├─ Total revenue impact: +$15K/month
   └─ Data-driven decision with 95% confidence
```

**Success Metrics**:
- Pricing optimization: 3-5% revenue uplift
- Competitive parity: <5% price variance from comparable competitors
- Decision confidence: >90% accuracy of competitive intelligence
- Implementation time: <1 week from analysis to launch

---

### Use Case 4: Campaign Effectiveness Benchmarking

**Actor**: Digital Marketing Manager
**Frequency**: After campaign launch, then weekly
**Duration**: 45-60 minutes per analysis
**Goal**: Compare campaign performance to competitors

**Flow**:

```
1. Manager launches new "Family Package" campaign
   ├─ Start date: March 15, 2026
   ├─ Budget: $2,000/week
   ├─ Target segment: Families with children
   ├─ Key message: "Kid-friendly amenities, activity packages"
   └─ Success target: 100 bookings/month

2. Manager sets up competitive benchmark in system
   ├─ Creates: "Family Campaign" tracking set
   ├─ Competitors: Identifies 3 hotels with family campaigns
   ├─ Metrics: CTR, CPC, engagement rate, landing page quality
   ├─ Timeline: 12-week tracking period
   └─ Refreshes: Daily data collection

3. Week 1: Campaign launches
   ├─ Our metrics (day 7):
   │  ├─ Impressions: 25,000
   │  ├─ CTR: 3.2%
   │  ├─ CPC: $1.50
   │  └─ Bookings: 8
   │
   ├─ Competitor A metrics:
   │  ├─ Impressions: 35,000
   │  ├─ CTR: 2.8%
   │  ├─ CPC: $1.80
   │  └─ Estimated bookings: 11
   │
   ├─ Competitor B metrics:
   │  ├─ Impressions: 18,000
   │  ├─ CTR: 4.1%
   │  ├─ CPC: $1.20
   │  └─ Estimated bookings: 7
   │
   └─ Analysis: We're performing above average on CTR

4. Week 2: Deep analysis
   ├─ Manager views: All 3 competitors' family campaign ads
   ├─ Identifies: Competitor B's ad copy emphasizes safety/health
   ├─ Notices: Their CTA button uses "Book Now" vs our "Learn More"
   ├─ Tests: A/B test Competitor B's CTA approach
   └─ Hypothesis: Different CTA will improve conversion

5. Week 3: Adjust campaign based on intelligence
   ├─ Changes: CTA button to "Book Now" (match competitor)
   ├─ Adds: Health/safety messaging (match competitor B)
   ├─ Result: CTR improves to 4.5%
   ├─ Bookings: 18 in week 3 (vs. 8 in week 1)
   └─ Insight: Competitor B's approach validates our testing

6. Week 4-12: Continuous monitoring
   ├─ Weekly report:
   │  ├─ Our performance trend vs. 3 competitors
   │  ├─ Creative variations identified
   │  ├─ Pricing strategies evolution
   │  ├─ Audience estimates and targeting
   │  └─ Recommendations for optimization
   │
   ├─ Key findings:
   │  ├─ Week 6: Competitor C enters family segment
   │  ├─ Week 8: Price war starts, CTR saturates
   │  ├─ Week 10: New competitor A variant on wellness angle
   │  └─ Week 12: Market saturation, recommend pivot to couples
   │
   └─ Total bookings over 12 weeks: 150 (vs. target of 100)

7. Campaign retrospective
   ├─ Revenue: $22,500 (150 bookings × $150 avg)
   ├─ Cost: $24,000 (12 weeks × $2,000)
   ├─ ROI: -6.7% (but valuable brand building)
   ├─ Competitive edge: Outperformed competitor A on CPA
   ├─ Learnings: 5 tactical changes based on competitor intelligence
   └─ Next campaign: Apply learnings to "Couples" segment

8. Outcome
   ├─ Campaign reached 125% of target bookings
   ├─ Competitive insights led to 4 optimizations
   ├─ Competitor tracking data shared with CFO
   ├─ Method became template for all future campaigns
```

**Success Metrics**:
- Campaign performance: >80% of target
- Competitive advantage: Outperform 50%+ of competitors on key metrics
- Optimization speed: 3-5 changes per 4-week campaign
- Time to insight: <24 hours from campaign change to competitive response

---

## SYSTEM ARCHITECTURE (DETAILED)

### 1. Macro Architecture: Three-Tier Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PRESENTATION TIER (Frontend)                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │Dashboard │  │Reports   │  │Alerts    │  │Pipeline  │           │
│  │(React)   │  │(HTML)    │  │(React)   │  │(React)   │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
│                                                                     │
│                   Next.js App Router (Port 3000)                   │
│                   - SSR for dashboard pages                        │
│                   - SSG for reports (if static)                    │
│                   - Client-side state (React Query)                │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                      HTTP/REST (JSON)
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                   APPLICATION TIER (Backend)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │              Express.js REST API (Port 3001)               │   │
│  ├────────────────────────────────────────────────────────────┤   │
│  │                                                            │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │   │
│  │  │Competitors   │  │Pipeline      │  │Reports       │     │   │
│  │  │Router        │  │Router        │  │Router        │     │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘     │   │
│  │                                                            │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │   │
│  │  │Alerts        │  │Health        │  │Auth          │     │   │
│  │  │Router        │  │Router        │  │Middleware    │     │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘     │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │              Business Logic Services                       │   │
│  ├────────────────────────────────────────────────────────────┤   │
│  │                                                            │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │   │
│  │  │Scrape        │  │Analysis      │  │Report        │     │   │
│  │  │Service       │  │Service       │  │Service       │     │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘     │   │
│  │                                                            │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │   │
│  │  │Delivery      │  │Alert         │  │Intelligence  │     │   │
│  │  │Service       │  │Service       │  │Service       │     │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘     │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │              Data Access Layer (Drizzle ORM)               │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │              External Service Integrations                 │   │
│  ├────────────────────────────────────────────────────────────┤   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │   │
│  │  │Apify API     │  │OpenRouter    │  │Resend Email  │     │   │
│  │  │(Scraping)    │  │(LLM)         │  │(Delivery)    │     │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘     │   │
│  └────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                      SQL/PostgreSQL
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                    DATA TIER (Persistence)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │              PostgreSQL Database (Port 5432)               │   │
│  ├────────────────────────────────────────────────────────────┤   │
│  │                                                            │   │
│  │  ┌─────────────────────────────────────────────────┐      │   │
│  │  │14 Tables (Competitors, Ads, Posts, Analysis...) │      │   │
│  │  │Schema: 50+ columns, 30+ indexes                │      │   │
│  │  │Relationships: 10+ foreign keys (cascade delete)│      │   │
│  │  │Constraints: Unique indexes, not-null checks   │      │   │
│  │  └─────────────────────────────────────────────────┘      │   │
│  │                                                            │   │
│  │  ┌─────────────────────────────────────────────────┐      │   │
│  │  │Data Storage: 500GB - 1TB (at scale)            │      │   │
│  │  │Backup: Daily automated snapshots               │      │   │
│  │  │Replication: Multi-region (if scaled)           │      │   │
│  │  └─────────────────────────────────────────────────┘      │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │              File Storage (Data Exports)                   │   │
│  ├────────────────────────────────────────────────────────────┤   │
│  │  ├─ Reports (PDF): ~/data/exports/ (100GB+)               │   │
│  │  ├─ Screenshots: ~/data/screenshots/ (50GB+)              │   │
│  │  ├─ Backups: ~/data/backups/ (500GB+)                     │   │
│  │  └─ Logs: ~/logs/ (10GB rolling, 30-day retention)        │   │
│  └────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 2. Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PIPELINE EXECUTION FLOW                         │
└─────────────────────────────────────────────────────────────────────┘

STAGE 1: SCRAPE (Web Data Collection)
──────────────────────────────────────────────────────────────────────
  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
  │ Competitors  │      │ Scrape       │      │ Database     │
  │ Config       │─────>│ Service      │─────>│ (Write ads,  │
  │ (ID, URL,    │      │              │      │  posts)      │
  │  credentials)│      └──────────────┘      └──────────────┘
  └──────────────┘            │
                              │
                 ┌────────────┼────────────┐
                 │            │            │
                 ▼            ▼            ▼
         ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
         │Apify Actor   │  │Playwright    │  │Google Trends │
         │(Meta Ads)    │  │(FB Pages)    │  │Fetcher       │
         └──────────────┘  └──────────────┘  └──────────────┘
                 │            │            │
                 └────────────┼────────────┘
                              │
                 ┌────────────┴────────────┐
                 │                         │
         ┌───────▼────────┐     ┌──────────▼──────────┐
         │Normalize Data  │     │Handle Errors &      │
         │Map to DB Types │     │Deduplication        │
         └────────────────┘     └─────────────────────┘

STAGE 2: ANALYZE (AI Processing)
──────────────────────────────────────────────────────────────────────
  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
  │Latest Data   │      │Analysis      │      │Database      │
  │From DB       │─────>│Service       │─────>│(Store        │
  │(Ads, Posts)  │      │              │      │ analyses)    │
  └──────────────┘      └──────────────┘      └──────────────┘
                              │
                 ┌────────────┼────────────┬─────────────────┐
                 │            │            │                 │
                 ▼            ▼            ▼                 ▼
         ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐
         │Health Score  │  │Strategy      │  │Pricing Extract     │
         │Calculator    │  │Classifier    │  │Detector            │
         │(Composite)   │  │(LLM)         │  │(Regex + logic)     │
         └──────────────┘  └──────────────┘  └────────────────────┘
                 │            │            │
                 └────────────┼────────────┘
                              │
                    ┌─────────▼─────────┐
                    │Alert Generator    │
                    │(Detect changes)   │
                    └───────────────────┘

STAGE 3: GENERATE (Report Assembly)
──────────────────────────────────────────────────────────────────────
  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
  │Aggregated    │      │Report        │      │Database      │
  │Data          │─────>│Service       │─────>│(Store        │
  │From Analyses │      │              │      │ report)      │
  └──────────────┘      └──────────────┘      └──────────────┘
                              │
                 ┌────────────┼────────────┐
                 │            │            │
                 ▼            ▼            ▼
         ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
         │Template      │  │Chart Gen.    │  │HTML Render   │
         │Processing    │  │(Skia/Canvas) │  │(Nunjucks)    │
         │(Nunjucks)    │  │              │  │              │
         └──────────────┘  └──────────────┘  └──────────────┘
                 │            │            │
                 └────────────┼────────────┘
                              │
                    ┌─────────▼──────────┐
                    │PDF Generation      │
                    │(Puppeteer)         │
                    └────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │Save to /exports/   │
                    └────────────────────┘

STAGE 4: DELIVER (Distribution)
──────────────────────────────────────────────────────────────────────
  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
  │Report PDF    │      │Delivery      │      │Email         │
  │+ HTML        │─────>│Service       │─────>│Recipients    │
  │              │      │              │      │(Configured)  │
  └──────────────┘      └──────────────┘      └──────────────┘
                              │
                    ┌─────────▼──────────┐
                    │Resend Email API    │
                    │(via OpenRouter)    │
                    └────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │Log Access Event    │
                    │(report_access_log) │
                    └────────────────────┘
```

### 3. Deployment Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                    PRODUCTION DEPLOYMENT                           │
└────────────────────────────────────────────────────────────────────┘

┌─ INFRASTRUCTURE ─────────────────────────────────────────────────┐
│                                                                  │
│  Cloud Provider: AWS / GCP / Azure (or self-hosted)             │
│  ├─ Region: Primary (us-east-1), Backup (eu-west-1)           │
│  ├─ Load Balancer: Nginx / HAProxy for API distribution        │
│  └─ Auto-scaling: Horizontal scale at 70% CPU usage            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌─ APPLICATION SERVERS ────────────────────────────────────────────┐
│                                                                  │
│  3x API Instances (Hot-Standby)                                │
│  ├─ Node.js 20, 2GB RAM, 2 CPU cores                          │
│  ├─ Port 3001 (HTTP), 3002 (health check)                     │
│  ├─ Managed by PM2 with auto-restart                          │
│  └─ Health check every 10 seconds                             │
│                                                                  │
│  2x Dashboard Instances (Load-balanced)                        │
│  ├─ Next.js server, 1GB RAM, 1 CPU                            │
│  ├─ Port 3000                                                  │
│  └─ Static assets served via CDN                              │
│                                                                  │
│  1x Pipeline Runner (Scheduled execution)                      │
│  ├─ Node.js, 4GB RAM, 2 CPU cores                            │
│  ├─ Runs on schedule: Scrape (02:00), Analyze (04:00), etc.  │
│  ├─ Can scale to 3x for large competitor sets                │
│  └─ Monitors via logs and uptime service                      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌─ DATABASE LAYER ─────────────────────────────────────────────────┐
│                                                                  │
│  Primary DB (PostgreSQL 15)                                     │
│  ├─ 2 vCPU, 8GB RAM, 500GB SSD                                 │
│  ├─ Connection pool: 20 connections                            │
│  ├─ Automated backups: Daily (retained 30 days)               │
│  └─ WAL archiving for point-in-time recovery                  │
│                                                                  │
│  Read Replica (Optional, for reporting)                        │
│  ├─ Asynchronous replication from primary                      │
│  ├─ Used for heavy dashboard queries (doesn't block writes)   │
│  └─ Can be in different region for DR                         │
│                                                                  │
│  Backup Storage (S3-compatible)                                │
│  ├─ Daily backups: ~100MB compressed                           │
│  ├─ Retention: 30 days rolling window                         │
│  ├─ Geographically distributed (3 copies)                     │
│  └─ Monthly full backup archived for 1 year                   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌─ CACHING & SESSION STORE ────────────────────────────────────────┐
│                                                                  │
│  Redis Cluster (For caching & sessions)                        │
│  ├─ 3-node cluster, 6GB total RAM                              │
│  ├─ Sentinel for automatic failover                            │
│  ├─ Cache layer for:                                           │
│  │  ├─ API responses (5-minute TTL)                           │
│  │  ├─ LLM responses (24-hour TTL)                            │
│  │  ├─ Dashboard user sessions                                │
│  │  └─ Rate limit counters                                    │
│  └─ Persistence: RDB snapshots + AOF logging                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌─ MONITORING & LOGGING ───────────────────────────────────────────┐
│                                                                  │
│  Logging Stack                                                  │
│  ├─ Application Logs: Winston (JSON to ELK or CloudWatch)     │
│  ├─ Database Logs: PostgreSQL native (slow query logs)        │
│  ├─ Access Logs: Nginx reverse proxy logs                     │
│  └─ Retention: 30 days hot, 1 year cold storage              │
│                                                                  │
│  Monitoring & Alerting                                         │
│  ├─ Metrics: Prometheus (CPU, memory, API latency)           │
│  ├─ Visualization: Grafana dashboards                         │
│  ├─ Alerting: PagerDuty for on-call incidents                │
│  ├─ Status Page: Public status.example.com                    │
│  └─ Uptime Monitoring: External services (UptimeRobot)       │
│                                                                  │
│  Error Tracking                                                │
│  ├─ Tool: Sentry for exception tracking                       │
│  ├─ Captures: Unhandled exceptions, crashes                   │
│  ├─ Grouping: By error type, severity, service               │
│  └─ Alerts: Slack notifications for critical errors          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌─ DISASTER RECOVERY (DR) ─────────────────────────────────────────┐
│                                                                  │
│  Recovery Time Objective (RTO): 4 hours                         │
│  Recovery Point Objective (RPO): 1 hour                         │
│                                                                  │
│  Backup Strategy                                                │
│  ├─ Hourly snapshots: Last 24 hours                            │
│  ├─ Daily backups: Last 30 days                               │
│  ├─ Monthly archives: Last 12 months                           │
│  └─ Cross-region replication: Every 6 hours                   │
│                                                                  │
│  Failover Process                                               │
│  ├─ Auto-promote read replica if primary fails                │
│  ├─ DNS switch to backup region (5-10 min)                   │
│  ├─ Restore from backup (1-2 hours)                          │
│  ├─ Database recovery (30 min - 2 hours depending on size)   │
│  └─ Full system test: Monthly DR drills                       │
│                                                                  │
│  Backup Verification                                            │
│  ├─ Weekly: Restore test on staging                           │
│  ├─ Monthly: Full DR exercise                                  │
│  ├─ Quarterly: Data integrity audit                           │
│  └─ Annually: Security audit of backups                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌─ SECURITY ───────────────────────────────────────────────────────┐
│                                                                  │
│  Network Security                                               │
│  ├─ VPC: Private subnets for DB, restricted access            │
│  ├─ Security Groups: Port-based restrictions                  │
│  ├─ WAF: DDoS protection, bot filtering                       │
│  └─ SSL/TLS: All traffic encrypted (TLS 1.3)                 │
│                                                                  │
│  Data Security                                                  │
│  ├─ Database encryption: AES-256 at rest                      │
│  ├─ Password hashing: bcrypt (if users added)                │
│  ├─ Secrets management: HashiCorp Vault / AWS Secrets Mgr    │
│  └─ API keys: Rotated quarterly, never logged                │
│                                                                  │
│  Access Control                                                 │
│  ├─ Principle of least privilege: Minimal permissions         │
│  ├─ Service accounts: Separate for each microservice          │
│  ├─ Audit logging: All administrative access logged           │
│  └─ IP whitelisting: For API access (if configured)           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## FEATURE SPECIFICATIONS

### Feature 1: Competitor Scraping & Data Collection

#### Overview
Automated collection of real-time marketing data from competitors across Meta Ads Library, Facebook pages, Google Trends, and other sources.

#### Requirements

**Functional**:
- Scrape Meta Ads Library: 50+ ads per competitor, daily
- Scrape Facebook page metrics: Followers, likes, engagement rates
- Scrape Facebook posts: Recent 30 posts with engagement metrics
- Scrape Google Trends: 10 configurable keywords, weekly
- Handle errors gracefully: Retry logic, exponential backoff
- Deduplication: Prevent duplicate ads/posts in database
- Schedule-based execution: Configurable cron schedule

**Non-Functional**:
- Latency: Complete scrape for 12 competitors in <20 minutes
- Reliability: 95%+ success rate (retries handled)
- Rate limiting: Respect external API limits (Apify, Facebook)
- Data freshness: All ads scraped within 24 hours
- Scalability: Handle 100+ competitors with proportional time increase

#### Scrapers Detailed Specification

**1. Meta Ads Library Scraper (Apify)**

```typescript
Input:
{
  competitorId: number;
  facebookPageId: string;           // e.g., "centara.grand.samui"
  adsLibraryUrl: string;            // e.g., "https://facebook.com/ads/library/..."
  maxAdsToFetch: number;             // default: 50
  languageFilter?: string;           // default: "en,th"
  retryCount?: number;               // default: 3
}

Apify Actor: meta-ads-library
Configuration:
  ├─ Search type: "Library"
  ├─ Target countries: ["TH"] (Thailand)
  ├─ Ad statuses: ["ACTIVE", "INACTIVE"]
  ├─ Creative types: ["IMAGE", "VIDEO", "CAROUSEL", "COLLECTION"]
  ├─ Platforms: ["FACEBOOK", "INSTAGRAM", "AUDIENCE_NETWORK"]
  └─ Pagination: Fetch until maxAdsToFetch reached

Output Per Ad:
{
  adId: string;                      // Unique ad ID
  advertiserName: string;            // Company name
  advertiserUrl: string;             // Landing page URL
  adText: string;                    // Ad copy
  adHeadline?: string;               // Primary heading
  callToAction?: string;             // "LEARN_MORE", "BOOK_NOW", etc.
  creativeType: "IMAGE" | "VIDEO" | "CAROUSEL" | "COLLECTION";
  mediaType?: string;                // "photo", "video", "carousel"
  platforms: string[];               // ["Facebook", "Instagram"]
  adStartDate?: string;              // ISO 8601 date when ad started
  estimatedAudienceSize?: number;    // Reach estimate
  adStatus: "ACTIVE" | "INACTIVE";  // Current status
  metadata: {
    fetchedAt: string;               // ISO timestamp
    sourceUrl: string;               // Ads library URL
    advertiserPageId: string;        // Facebook page ID
    adLibraryId: string;             // Library-specific ID
  }
}

Mapping to DB:
{
  competitorId: input.competitorId,
  metaAdId: output.adId,
  adArchiveId: output.adLibraryId,
  startDate: parseDate(output.adStartDate),
  adText: output.adText,
  headline: output.adHeadline,
  creativeType: mapCreativeType(output.creativeType),
  creativeTypeEnum: output.creativeType,
  ctaType: mapCta(output.callToAction),
  landingUrl: output.advertiserUrl,
  platforms: output.platforms,
  publisherPlatforms: output.platforms,
  estimatedAudienceSize: output.estimatedAudienceSize?.toString(),
  adStatus: output.adStatus === 'ACTIVE' ? 'active' : 'inactive',
  isActive: output.adStatus === 'ACTIVE',
  scrapedAt: new Date(),
  adCreationTime: new Date(), // Estimated from ad start
}

Deduplication Logic:
  ├─ Check: SELECT * FROM ads WHERE meta_ad_id = output.adId
  ├─ If exists: UPDATE (only update scraped_at, handle changed fields)
  ├─ If new: INSERT
  └─ Mark old ads inactive: UPDATE ads SET is_active = false WHERE scraped_at < 24 hours ago
```

**2. Facebook Page Metrics Scraper (Playwright)**

```typescript
Input:
{
  competitorId: number;
  facebookPageUrl: string;           // e.g., "https://facebook.com/centara.grand.samui"
  timeout?: number;                  // default: 30000ms
}

Process:
  1. Launch Playwright browser (headless Chrome)
  2. Navigate to facebookPageUrl
  3. Wait for page load (network idle)
  4. Extract metrics via DOM queries or API calls
  5. Close browser

Extracted Metrics:
{
  pageUrl: string;
  followers: number;                 // From "X followers" text
  pageLikes: number;                 // "People like this"
  rating?: number;                   // Star rating if available (0-5)
  reviewCount?: number;              // Number of reviews
  postsLast30d: number;              // Post count in last 30 days
  avgEngagementRate: number;         // % (reactions+comments+shares) / followers / posts
  lastPostDate?: Date;               // Most recent post timestamp
}

Example Extraction:
  - CSS Selector: "span[data-uia='page_likes']" → "15K people like this"
  - Regex: /(\d+(\.\d{1,2})?)[KM]?/ → 15000
  - Similar for followers, reviews, rating
  - Post timestamp: From post list, find most recent
  - Engagement: Sum reactions + comments + shares for recent posts, divide by (followers × days)

Mapping to DB:
{
  competitorId: input.competitorId,
  pageUrl: input.facebookPageUrl,
  followers: output.followers,
  pageLikes: output.pageLikes,
  rating: output.rating,
  reviewCount: output.reviewCount,
  postsLast30d: output.postsLast30d,
  avgEngagementRate: output.avgEngagementRate,
  lastPostDate: output.lastPostDate,
  scrapedAt: new Date(),
}

Error Handling:
  ├─ Page not found (404): Log error, skip competitor
  ├─ Network timeout: Retry up to 3 times
  ├─ JavaScript error: Capture error, continue with partial data
  └─ Permission denied: Log & notify, may indicate page restricted
```

**3. Facebook Posts Scraper (Apify)**

```typescript
Apify Actor: facebook-posts
Configuration:
  ├─ URL: facebook page URL
  ├─ Max posts: 30
  ├─ Include comments: true
  ├─ Include reactions: true
  └─ Timeout: 60 seconds per page

Output Per Post:
{
  postId: string;                    // e.g., "competitorid_postid"
  postUrl: string;                   // Full URL to post
  postText: string;                  // Post content
  postType: string;                  // "photo", "video", "link", "status", "event", etc.
  createdAt: string;                 // ISO 8601 timestamp
  reactions: number;                 // Total reactions
  shares: number;
  comments: number;
  videoViews?: number;               // If video post
  mediaType?: string;                // "photo", "video", "carousel", etc.
  thumbnailUrl?: string;             // URL to image/video preview
}

Advanced Extraction:
{
  reactionLikeCount: number;         // Breakdown of reaction types
  reactionLoveCount: number;
  reactionWowCount: number;
  reactionHahaCount: number;
  reactionCareCount: number;
  engagementScore: number;           // Custom calculated score
}

Engagement Score Formula:
  engagementScore = (
    (reactions × 1) +
    (comments × 2) +                 // Comments weighted higher
    (shares × 3)                     // Shares weighted highest
  ) / followers × 1000              // Normalized per 1000 followers

Mapping to DB:
{
  competitorId: input.competitorId,
  postId: output.postId,
  postUrl: output.postUrl,
  postText: output.postText,
  postType: mapPostType(output.postType),
  postedAt: new Date(output.createdAt),
  reactions: output.reactions,
  comments: output.comments,
  shares: output.shares,
  videoViews: output.videoViews,
  mediaType: output.mediaType,
  thumbnailUrl: output.thumbnailUrl,
  likes: output.reactionLikeCount,
  reactionLikeCount: output.reactionLikeCount,
  reactionLoveCount: output.reactionLoveCount,
  reactionWowCount: output.reactionWowCount,
  reactionHahaCount: output.reactionHahaCount,
  reactionCareCount: output.reactionCareCount,
  engagementScore: calculateEngagementScore(output),
  scrapedAt: new Date(),
}

Deduplication:
  ├─ Check: SELECT * FROM facebook_posts WHERE post_id = output.postId
  ├─ If exists: UPDATE (reactions, comments, shares, engagement_score)
  ├─ If new: INSERT
  └─ Keep historical record: Never delete old posts
```

**4. Google Trends Fetcher**

```typescript
Input:
{
  keywords: string[];                // ["hua hin hotel", "hua hin resort", ...]
  timeframe: "7d" | "30d" | "90d";  // Time period
  geo: string;                       // Country code "TH"
  retryCount?: number;               // default: 3
}

Process:
  1. Call Google Trends API via unofficial library or official API (if available)
  2. Get trend data for each keyword
  3. Parse CSV response
  4. Calculate change percentage
  5. Store in database

Output Per Keyword:
{
  keyword: string;
  date: Date;
  value: number;                     // Trend value (0-100)
  changePct: number;                 // % change from previous period
  metadata: {
    relatedQueries: string[];        // Related search terms
    topRegions: Array<{region, value}>;  // Geographic breakdown
    topQueries: string[];            // Most common queries
    yearOverYearChange: number;      // % change vs. previous year
  }
}

Caching:
  ├─ Cache TTL: 24 hours
  ├─ Key: MD5(keyword + date + geo)
  └─ Storage: Redis or disk cache

Mapping to DB:
{
  trendDate: input.timeframe,
  source: "google_trends",
  keyword: output.keyword,
  value: output.value,
  changePct: output.changePct,
  metadata: output.metadata,
}

Error Handling:
  ├─ Rate limit (429): Wait with exponential backoff
  ├─ Keyword not found: Log warning, continue
  ├─ Network error: Retry up to 3 times
  └─ All retries fail: Store null value, don't block other keywords
```

#### Data Quality Assurance

**Validation Rules**:
```sql
-- Ads validation
├─ meta_ad_id: NOT NULL, UNIQUE
├─ competitor_id: NOT NULL, FK check
├─ started_running: Must be <= scraped_at
├─ extracted_price: IF NOT NULL THEN NUMERIC(12,2)
└─ is_active: BOOLEAN NOT NULL

-- Posts validation
├─ post_id: NOT NULL, UNIQUE
├─ competitor_id: NOT NULL, FK check
├─ posted_at: Must be <= scraped_at, cannot be in future
├─ engagement_score: NUMERIC(10,4), non-negative
└─ reactions: Must be >= (like + love + wow + haha + care)

-- Pages validation
├─ followers: NON-NEGATIVE INTEGER
├─ engagement_rate: 0-100 (percentage)
└─ rating: 0-5 (if not null)
```

**Scrape Results Reporting**:
```json
{
  "adsScraped": 145,
  "adsInserted": 23,
  "adsUpdated": 122,
  "postsScrape": 89,
  "postsInserted": 15,
  "postsUpdated": 74,
  "pagesScraped": 12,
  "pageMetricsUpdated": 12,
  "trendsScraped": 10,
  "trendsInserted": 10,
  "errors": [
    "Competitor 5: Meta Ads timeout, retried 3 times, failed"
  ],
  "duration": "8m 45s",
  "successRate": "99.2%"
}
```

---

### Feature 2: AI-Powered Competitor Analysis

#### Overview
Multi-dimensional analysis of competitor data using AI to generate health scores, identify strategies, extract insights, and generate recommendations.

#### Health Score Calculation

**Dimensions** (5 pillars, 20 points each):

1. **Ad Volume Dimension** (20 points)
   - Metric: Number of active ads vs. market leader
   - Formula: `min(competitorAds / marketLeaderAds, 1.0) × 20`
   - Example:
     - Market leader: 50 ads
     - Competitor: 35 ads
     - Score: (35/50) × 20 = 14 points

2. **Freshness Dimension** (20 points)
   - Metric: Age of newest ad (recency of marketing activity)
   - Formula:
     ```
     if newestAdDate is NULL: 0
     if newestAdDate >= today: 20
     if 1-7 days old: 18
     if 8-14 days old: 15
     if 15-30 days old: 10
     if 31-60 days old: 5
     if >60 days old: 0
     ```
   - Rationale: Active marketers update campaigns frequently

3. **Creativity Dimension** (20 points)
   - Metric: Diversity of ad formats and creative types
   - Formula: `min(uniqueCreativeCount / maxCreativeType, 1.0) × 20`
   - Creative types: Image, Video, Carousel, Collection
   - Example:
     - Competitor uses: Image (15 ads), Video (12 ads), Carousel (8 ads)
     - Unique types: 3
     - Max possible: 4
     - Score: (3/4) × 20 = 15 points

4. **Strategy Diversity Dimension** (20 points)
   - Metric: Number of distinct marketing strategies detected
   - Strategies identified by LLM analysis:
     - Price-focused
     - Quality-focused
     - Experience-focused
     - Value-focused
     - Urgency-focused
     - Authority-focused
     - Social proof-focused
   - Formula: `min(strategiesDetected / 7, 1.0) × 20`
   - Example:
     - Strategies identified: ["Price-focused", "Social proof", "Experience"]
     - Count: 3
     - Score: (3/7) × 20 ≈ 8.6 points

5. **Engagement Dimension** (20 points)
   - Metric: Average engagement rate across posts and ads
   - Formula: `min(avgEngagementRate / maxEngagementRate, 1.0) × 20`
   - Engagement calculation:
     ```
     (reactions + comments + shares) / (followers × days_in_period) × 100
     ```
   - Benchmarks:
     - >5%: Excellent (18-20 points)
     - 3-5%: Good (14-18 points)
     - 1-3%: Average (7-14 points)
     - <1%: Low (0-7 points)
   - Example:
     - Avg engagement rate: 4.2%
     - Max benchmark: 6%
     - Score: (4.2/6) × 20 = 14 points

**Composite Score Calculation**:
```
TOTAL_HEALTH_SCORE = (
  adVolume_score × 0.20 +
  freshness_score × 0.20 +
  creativity_score × 0.20 +
  strategyDiversity_score × 0.20 +
  engagement_score × 0.20
)

PAID_SCORE = (
  adVolume_score × 0.30 +
  freshness_score × 0.30 +
  creativity_score × 0.40
) / 100 × health_score

ORGANIC_SCORE = (
  engagement_score × 0.40 +
  postFrequency_score × 0.30 +
  contentQuality_score × 0.30
) / 100 × health_score
```

**Threat Level Classification**:
| Health Score | Threat Level | Definition |
|--------------|--------------|-----------|
| 80-100 | High | Competitor is strong, heavily investing |
| 60-79 | Medium | Moderate competitive presence |
| 40-59 | Low | Weak competitor, minimal investment |
| 0-39 | Minimal | Inactive/dormant competitor |

---

## APPENDIX A: TECHNOLOGY DECISIONS & TRADE-OFFS

### Why TypeScript (ESM)?

**Decision**: Use TypeScript with ES Modules

**Rationale**:
- **Type Safety**: Catch errors at compile-time, not runtime
- **IDE Support**: IntelliSense, auto-complete, refactoring
- **Maintainability**: Self-documenting code via types
- **ESM Adoption**: Node.js moving toward ES Modules

**Trade-offs**:
- ✅ Build step required (compile TS → JS)
- ✅ Slightly slower startup time
- ❌ Learning curve for team (if not familiar with TS)

**Alternative Considered**: JavaScript (plain)
- Would be simpler, no build step
- But sacrifices type safety and IDE support

---

### Why Drizzle ORM (not Sequelize/TypeORM)?

**Decision**: Drizzle ORM for database abstraction

**Rationale**:
- **TypeScript-First**: Built for TS, excellent type inference
- **Lightweight**: Minimal overhead, direct SQL when needed
- **Safe Queries**: Type-safe query builders prevent SQL injection
- **Migrations**: Simple SQL-based migrations

**Trade-offs**:
- ✅ Smaller ecosystem (less documentation than Sequelize)
- ✅ Fewer built-in features (but they're usually not needed)
- ❌ Must write own complex query helpers

**Alternative Considered**: Sequelize
- More mature, larger community
- But heavier and less TypeScript-friendly
- ORM "magic" can be unpredictable

---

### Why PostgreSQL (not MongoDB/MySQL)?

**Decision**: PostgreSQL for primary database

**Rationale**:
- **Relational Structure**: Our data has clear relationships (competitors → ads → posts)
- **ACID Compliance**: Strong consistency guarantees (critical for financial data)
- **Advanced Features**:
  - JSONB for flexible fields (ads creative_bodies, pricing_data)
  - Full-text search for post analysis
  - Window functions for time-series analytics
- **Open Source**: No licensing costs

**Trade-offs**:
- ✅ Slightly heavier than MySQL
- ✅ Requires more tuning for massive scale
- ❌ Not ideal for extremely unstructured data

**Alternatives Considered**:
- **MongoDB**: Better for unstructured data, but worse for relational queries
- **MySQL**: Lightweight, but lacks JSONB and advanced features
- **Firebase**: Serverless appeal, but vendor lock-in and costs at scale

---

### Why Claude AI (not GPT-4)?

**Decision**: Anthropic Claude via OpenRouter

**Rationale**:
- **Strong Reasoning**: Claude excels at semantic analysis
- **Cost**: 50% cheaper than GPT-4 for similar quality
- **Long Context**: Handles 100K+ tokens (good for ad analysis)
- **Safety**: Constitutional AI reduces false analysis
- **OpenRouter**: Multi-model flexibility (fallback to Gemini)

**Trade-offs**:
- ✅ Claude may be slower than GPT-4 in edge cases
- ❌ OpenRouter adds one more service dependency

**Alternative Considered**: GPT-4
- Higher reasoning capability
- But 2x cost
- No significant advantage for our use case

---

### Why Resend for Email (not AWS SES)?

**Decision**: Resend for email delivery

**Rationale**:
- **Developer-Friendly**: Better API, cleaner code
- **Reliability**: 99.99% uptime SLA
- **Templates**: Built-in template support
- **Deliverability**: Better inbox placement than SES
- **Cost**: Similar pricing, better service

**Trade-offs**:
- ✅ Another third-party service (vs. self-managed SES)
- ❌ Slightly less customization than SES

---

## APPENDIX B: SUCCESS METRICS & KPIs

### Business Metrics

| KPI | Target | Current | Trend |
|-----|--------|---------|-------|
| **Revenue per Report** | $1,000 | $800 | ↑ 5% month-over-month |
| **User Adoption** | 50 active users | 32 | ↑ 8% month-over-month |
| **Report Accuracy** | 95% | 91% | ↑ Improving with LLM tuning |
| **Customer Churn** | <5% | 3% | ✓ Stable |
| **NPS Score** | >50 | 42 | ↑ +3 points |

### Product Metrics

| KPI | Target | Current | Note |
|-----|--------|---------|------|
| **Report Generation Time** | <10 minutes | 6.5 min | ✓ Meets target |
| **Dashboard Load Time** | <3 seconds | 2.1 sec | ✓ Good |
| **API Response Time** | <200ms (p95) | 145ms | ✓ Exceeds target |
| **Data Freshness** | <24 hours | 18 hours | ✓ Good |
| **Scrape Success Rate** | >95% | 98.2% | ✓ Excellent |

### Technical Metrics

| KPI | Target | Current |
|-----|--------|---------|
| **System Uptime** | 99.5% | 99.8% |
| **Database Query Time** | <100ms (p95) | 82ms |
| **Error Rate** | <1% | 0.3% |
| **LLM Cache Hit Rate** | >25% | 28% |
| **Cost per Report** | <$5 | $3.20 |

---

## APPENDIX C: COMPLIANCE & SECURITY

### Data Privacy

**GDPR Compliance** (if EU users):
- Data minimization: Only collect necessary competitor data
- Purpose limitation: Used only for competitive analysis
- Data retention: Delete ads/posts older than 2 years
- User consent: Display privacy policy on dashboard

**Thailand PDPAPersonal Data Protection Act**:
- Protect personal data of team members accessing system
- Secure access logs: Who accessed what, when
- Data breach notification: Required within 72 hours
- Right to be forgotten: Support deletion on request

### Security Standards

**OWASP Top 10 Protections**:
1. **Injection (SQL, NoSQL, Command)**: Parameterized queries via Drizzle
2. **Broken Authentication**: API keys + strong password requirements
3. **Sensitive Data Exposure**: TLS 1.3 for all traffic, AES-256 at rest
4. **XML External Entities (XXE)**: No XML parsing of untrusted input
5. **Broken Access Control**: Role-based access (if users added)
6. **Security Misconfiguration**: Automated security scanning (Snyk)
7. **XSS Prevention**: Input sanitization, CSP headers
8. **Insecure Deserialization**: No untrusted object deserialization
9. **Using Components with Known Vulnerabilities**: Regular dependency updates
10. **Insufficient Logging**: Comprehensive audit logging

**API Security**:
- Rate limiting: 100 req/min per IP (configurable)
- CORS: Restrict to known domains only
- API versioning: v1, v2, etc. for backward compatibility
- Request validation: All inputs validated against schema
- Timeout protection: 30-second API timeout

---

## APPENDIX D: ROADMAP (Next 12 Months)

### Q2 2026 (April-June): Expansion

**Features**:
- [ ] Multi-language support (English, Thai, Japanese, Korean)
- [ ] Custom competitor segments (user-defined groupings)
- [ ] Pricing prediction model (ML-based forecasting)
- [ ] Integration with Shopify (for pricing syncing)
- [ ] Mobile app (iOS + Android native)

**Scale**:
- Expand to 20 markets (currently 5)
- Support 500+ competitors simultaneously
- Add regional data centers

### Q3 2026 (July-September): Intelligence

**Features**:
- [ ] Sentiment analysis of ad copy
- [ ] Image recognition for creative analysis
- [ ] Competitor positioning map (2D scatter plot)
- [ ] Marketing mix modeling (attribution)
- [ ] Custom alert rules (user-defined triggers)

**ML/AI**:
- Train custom models for hotel industry
- Implement transfer learning from other verticals
- Build competitive set recommender

### Q4 2026 (October-December): Automation

**Features**:
- [ ] Automated bid optimization (suggest budgets)
- [ ] Campaign calendar sync (export to Google Ads)
- [ ] Automated recommendations engine (daily suggestions)
- [ ] Slack/Teams integration (alerts to chat)
- [ ] API webhooks (push events to external systems)

### 2027+: Vertical Expansion

- Expand to other hospitality (airlines, car rentals)
- Expand to non-hospitality (e-commerce, SaaS)
- White-label offering (licensable platform)

---

**Document Version**: 2.0.0
**Last Updated**: March 11, 2026
**Next Review**: June 11, 2026
**Status**: Production, Comprehensive

