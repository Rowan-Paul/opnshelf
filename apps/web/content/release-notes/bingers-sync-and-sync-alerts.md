---
{
  "status": "draft",
  "slug": "bingers-sync-and-sync-alerts",
  "title": "Bingers Sync, sync alerts and a new typeface",
  "publishedAt": "2026-11-11T12:21:05.000Z",
  "summary": "Bring your movies in from Bingers, get a push when a sync needs you, and read Opnshelf in a new typeface.",
  "platforms": {
    "web": { "status": "available" },
    "ios": { "status": "update-required", "minimumVersion": "1.7.14", "note": "Requires the production over-the-air update for version 1.7.14." },
    "android": { "status": "update-required", "minimumVersion": "1.7.14", "note": "Requires the production over-the-air update for version 1.7.14." }
  }
}
---
## Bring your Bingers movies into Opnshelf

Bingers Sync is a new Integration. Connect your Bingers account under **Settings → Integrations** and Opnshelf brings in your movie Watches and Ratings, then keeps them up to date.

Rewatch totals and episodes can’t be matched to an exact viewing yet. Instead of guessing, Opnshelf lists them under **Needs attention**. Bingers Sync uses the Bingers API, which is in beta and requires a Legend or Icon subscription on Bingers.

## Know when a sync needs you

The Mobile App can now send a push notification when Trakt Sync or Popfeed Sync keeps failing or needs you to reconnect. Tapping it opens the Integration. You get one notification per problem, and a short hiccup that clears on its own stays quiet.

Turn it on or off with **Sync errors and disconnections** under **Settings → Notifications** in the Mobile App. It starts enabled when you allow notifications.

## Steadier syncing

Sync now paces itself to stay within the limits of Trakt, Bingers and your AT Protocol account. When a service asks Opnshelf to slow down, the sync pauses and picks up later. It no longer signs you out or skips records.

## A new typeface

Opnshelf now uses Timeless Sans for headings and text on Web and Mobile. On Mobile, medium and bold text also renders in its proper weight.

## Smaller fixes

- A Review’s Like stays in step between the Review page and the Show or movie page.
- On small screens, the Review author stays readable next to the dates, Like and Share.
- A Connections link with an unknown tab opens Followers instead of an error page on Web.
- The “On shelf” label on Web Season pages is easier to read.
- Mobile feedback keeps its screenshot when the first capture is too large.
- Notification emails spell “Unsubscribe” correctly.

**Availability:** Available on Web with this release. Steadier syncing and the sync push notifications work without an app update. On iOS and Android, Bingers Sync, the **Sync errors and disconnections** switch, the new typeface and the Mobile fixes require version 1.7.14 with the production over-the-air update installed. Let the update download, then close and reopen the Mobile App to load it.
