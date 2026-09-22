# ADR 0039: Web SSR renders public content unless a signed-in hint says otherwise

Status: Accepted and implemented.

The API's session cookie is host-only on the API hostname, so the Web server never sees it. SSR cannot tell a signed-in visitor from an anonymous one, and since #282 and #288 the Web App has handled that by rendering nothing where personal and public content diverge until the browser has asked `/auth/me`. That stopped a signed-in reader from seeing the landing page flash before Home.

Every anonymous visitor paid for it, though, and they are most of the traffic `/` gets: first visits, shared links, search crawlers. Their HTML arrived with an empty `<main>`. The landing page, its hero image and everything below only appeared after the JS bundle downloaded, hydrated and completed a round trip to the API. Lighthouse measured the result on production: a layout shift of 0.46 as the footer was pushed down, and a hero image the browser could not discover from the HTML.

## Decision

The browser records the outcome of its session check in a Web-origin cookie, `opnshelf_signed_in=1` (`apps/web/src/lib/session-hint.ts`). `AuthProvider` sets it after a check finds a user and clears it after a check finds none, on logout, and when a request comes back unauthorized.

SSR reads the cookie from the request and records its answer in the query cache, which is dehydrated with the page; the hydrating render reuses that answer instead of reading `document.cookie`, which cannot see HttpOnly cookies such as a legacy parent-domain session and could disagree. Client-side navigations reuse it too, since `AuthProvider` decides once per page load:

- **Hint present** (or a session cookie the Web server can see, as in local development): unchanged. Wait for the browser session check before choosing between personal and public content.
- **Hint absent**: render public content straight away. The session check still runs on mount, and if it finds a user, the page switches to personal content.

The hint grants nothing. It only chooses what to show while the check runs; every request still authenticates with the API's own cookie. A forged or stale hint costs at most the wait it was meant to skip, or one flash of the landing page.

## Consequences

- A signed-in reader whose browser has no hint yet sees the landing page once before Home: sessions from before this change, cleared cookies, a new browser. The cookie is set right after, and every later load behaves as it did before.
- Pages that gate on `isLoading` from `useAuth` render their public state in SSR for anonymous visitors, not only `/`.
- The signed-in Home view is lazy-loaded on `/`, so anonymous visitors do not download it; the session check starts that download so a signed-in reader's wait overlaps it.

## Alternatives rejected

- **Keep rendering nothing until the check finishes.** This is what #288 chose, and it is right for signed-in readers. It is wrong for everyone else, who were the majority and who carried the layout shift and the late hero image on every visit.
- **A skeleton the height of the landing page.** It removes the layout shift but not the empty HTML: the hero image stays undiscoverable, and crawlers still get no content.
- **Move the session cookie to the parent domain so SSR can forward it.** The cookie became host-only on purpose. Widening it again sends a credential to every subdomain to answer a question a non-secret marker answers.
- **Render the landing page for everyone and swap in Home.** That is the flash #288 fixed, for every signed-in reader on every load.
