# Mobile Apps capture opnshelf.xyz links

We added Android App Links and iOS Universal Links, so tapping an `opnshelf.xyz`
link opens the **Mobile App** when it is installed. This came out of a smaller
need: the Android download **Banner** uses
`navigator.getInstalledRelatedApps()` to stay hidden from people who already
installed, and that API needs a Digital Asset Links association declared from
both the site and the app.

Link capture is a deliberate choice, not a side effect of that association. The
narrower `asset_statements` meta-data declaration would give install detection
without capturing any links. We took the broader behaviour because a shared
review link opening in the app is worth more than the association alone.

## Consequences

- Only paths the app can route are listed in the intent filter and the
  `apple-app-site-association` file. `/`, `/privacy`, `/tos` and `/embed/*` stay
  in the browser, so an unroutable URL never reaches the app.
- Both platforms do it or neither. Capturing links on Android only would mean a
  shared link behaving differently depending on the phone.
- Reversing this is a store release on both platforms plus a behaviour
  regression for anyone who has come to rely on it.
- A wrong SHA-256 fingerprint in `assetlinks.json` fails silently:
  `getInstalledRelatedApps()` returns an empty array, which is indistinguishable
  from "not installed". Use the Play app signing key, not the upload key.
