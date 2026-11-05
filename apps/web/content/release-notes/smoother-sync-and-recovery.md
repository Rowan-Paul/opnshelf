---
{
  "status": "draft",
  "slug": "smoother-sync-and-recovery",
  "title": "Smoother sync and recovery",
  "publishedAt": "2026-11-05T14:07:56.000Z",
  "summary": "More reliable sync choices, Web reload recovery, and fixes for editing on Mobile.",
  "platforms": {
    "web": { "status": "coming-soon", "note": "Available after this release reaches production." },
    "ios": { "status": "coming-soon", "note": "The sync fix needs no app update. Editing fixes require the upcoming production over-the-air update." },
    "android": { "status": "coming-soon", "note": "The sync fix needs no app update. Editing fixes require the upcoming production over-the-air update." }
  }
}
---
## Clearer choices for sync

Needs attention only offers records that are available to link. Records that are already linked or paired no longer appear as choices that fail when selected. This fix applies to Web, iOS and Android without a Mobile App update once the backend release is live.

## Recover a Web page with a reload

If a page or Search cannot load after a deployment, its recovery action reloads the Web App so you can continue.

## More reliable editing

Fixes keep late responses from an earlier dialog or sheet from interfering with a newly opened one. Mobile also handles queued preference saves more consistently. Mobile editing fixes require the production over-the-air update after it becomes available.
