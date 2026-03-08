# n8n Workflow Configuration — Apify Actor HTTP Nodes

This document provides ready-to-use HTTP Request node configurations for calling
Apify actors directly from n8n, plus data normalization and merging patterns.

---

## 1. Facebook Posts Scraper — HTTP Request Node

| Setting | Value |
|---------|-------|
| **Name** | Scrape Facebook Posts |
| **Method** | `POST` |
| **URL** | `https://api.apify.com/v2/acts/apify~facebook-posts-scraper/run-sync-get-dataset-items` |
| **Authentication** | Header Auth |
| **Header Name** | `Authorization` |
| **Header Value** | `Bearer {{ $env.APIFY_API_TOKEN }}` |
| **Timeout** | `300000` (5 minutes) |
| **Body Content Type** | JSON |

### Request Body

```json
{
  "startUrls": [
    { "url": "{{ $json.facebookPageUrl }}" }
  ],
  "resultsLimit": {{ $env.APIFY_MAX_ITEMS_PER_RUN || 50 }},
  "maxRequestRetries": 3,
  "proxy": {
    "useApifyProxy": true
  }
}
```

### Query Parameters

| Parameter | Value |
|-----------|-------|
| `token` | `{{ $env.APIFY_API_TOKEN }}` |
| `timeout` | `{{ $env.APIFY_TIMEOUT_SECONDS || 280 }}` |
| `memory` | `{{ $env.APIFY_MEMORY_MB || 512 }}` |

---

## 2. Meta Ads Scraper — HTTP Request Node

| Setting | Value |
|---------|-------|
| **Name** | Scrape Meta Ads |
| **Method** | `POST` |
| **URL** | `https://api.apify.com/v2/acts/apify~facebook-ads-scraper/run-sync-get-dataset-items` |
| **Authentication** | Header Auth |
| **Header Name** | `Authorization` |
| **Header Value** | `Bearer {{ $env.APIFY_API_TOKEN }}` |
| **Timeout** | `300000` (5 minutes) |
| **Body Content Type** | JSON |

### Request Body

```json
{
  "urls": ["{{ $json.facebookPageUrl }}"],
  "country": "TH",
  "adType": "all",
  "includeInactive": false,
  "searchTerms": {{ $json.searchTerms ? JSON.stringify($json.searchTerms) : "[]" }}
}
```

---

## 3. Error Handling Rules

Configure these in **Settings → On Error** for each HTTP node:

| HTTP Status | Action | Reason |
|-------------|--------|--------|
| `408` (Timeout) | **Continue** | Actor may still be running; retry on next cycle |
| `404` (Not Found) | **Stop** | Actor ID is wrong or deleted — fix config |
| `402` (Payment Required) | **Stop** | Apify account out of credits |
| `429` (Rate Limit) | **Continue** with 60s delay | Rate limited — wait and retry |
| `5xx` | **Continue** | Transient server error — log and skip |

### Error Handling Flow

```
HTTP Request Node
  ├── On Success → Set Node (normalize data)
  └── On Error
        ├── 408/429/5xx → Continue (with optional delay)
        └── 404/402 → Stop Workflow (with error notification)
```

---

## 4. Set Node — Data Normalization

After each HTTP Request node, add a **Set** node to normalize the response.

### Facebook Posts Set Node

| Output Field | Expression |
|---|---|
| `competitorName` | `{{ $('Input').item.json.name }}` |
| `postId` | `{{ $json.postId || $json.id }}` |
| `postText` | `{{ ($json.text || $json.message || '').substring(0, 500) }}` |
| `postDate` | `{{ $json.time ? new Date($json.time).toISOString() : null }}` |
| `postType` | `{{ $json.type || 'unknown' }}` |
| `likes` | `{{ $json.likes || $json.likesCount || 0 }}` |
| `comments` | `{{ $json.comments || $json.commentsCount || 0 }}` |
| `shares` | `{{ $json.shares || $json.sharesCount || 0 }}` |
| `postUrl` | `{{ $json.postUrl || $json.url || '' }}` |
| `imageUrl` | `{{ $json.imageUrl || $json.image || null }}` |

### Meta Ads Set Node

| Output Field | Expression |
|---|---|
| `competitorName` | `{{ $('Input').item.json.name }}` |
| `adId` | `{{ $json.adId || $json.id }}` |
| `adText` | `{{ ($json.adCreativeBody || $json.bodyText || '').substring(0, 300) }}` |
| `adHeadline` | `{{ ($json.adCreativeLinkTitle || $json.title || '').substring(0, 200) }}` |
| `adDescription` | `{{ $json.adCreativeLinkDescription || '' }}` |
| `callToAction` | `{{ $json.callToActionType || $json.cta || 'None' }}` |
| `adStartDate` | `{{ $json.adDeliveryStartTime || $json.startDate || null }}` |
| `adEndDate` | `{{ $json.adDeliveryStopTime || $json.endDate || null }}` |
| `adStatus` | `{{ $json.isActive ? 'active' : 'inactive' }}` |
| `platforms` | `{{ $json.publisherPlatforms || ['Facebook'] }}` |

---

## 5. Loop Over Competitors

Use the **Split In Batches** node to iterate over the competitor list:

```
Competitor List (manual trigger or schedule)
  │
  ├─ Split In Batches (batch size: 1)
  │     │
  │     ├─ HTTP: Scrape Facebook Posts
  │     │     └─ Set: Normalize Posts
  │     │
  │     ├─ HTTP: Scrape Meta Ads
  │     │     └─ Set: Normalize Ads
  │     │
  │     └─ Wait Node (2s delay between competitors)
  │
  └─ Merge: Combine All Results
```

---

## 6. Merge Node — Combine by Competitor

After all competitors are processed, use a **Merge** node:

| Setting | Value |
|---------|-------|
| **Mode** | Combine |
| **Combine By** | Fields |
| **Merge Key** | `competitorName` |
| **Join Type** | Left Join (keep all competitors even if one scraper failed) |
| **Clash Handling** | Add Suffix (`_ads`, `_posts`) |

### Final Output Shape

```json
{
  "competitorName": "Hotel Example",
  "posts": [ ... ],
  "ads": [ ... ],
  "scrapedAt": "2025-03-06T00:00:00Z"
}
```

---

## 7. Scheduling

Use a **Schedule Trigger** node set to run daily at your preferred time.
Recommended: `0 23 * * *` (23:00 UTC = 06:00 Bangkok time, same as the main system).
