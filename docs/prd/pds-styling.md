# PDS styling

Issue: [#211](https://github.com/Rowan-Paul/opnshelf/issues/211)

Status: Implemented locally in the Tranquil fork on 2026-10-03.
Implementation complete and verified locally; not deployed.

## Agreed direction

- Match the current Opnshelf app: reuse its logo, typography, colours, form
  controls, and spacing rather than introducing a new visual direction.
- Cover all user-facing pages in the Tranquil fork and all account emails,
  including recovery and error states. Operator-only tools are outside scope.
- Use Opnshelf branding and plain-language copy while making clear that these
  screens manage an AT Protocol account usable in other apps.
- Use **Opnshelf** as the brand and **Your AT Protocol account, hosted by
  Opnshelf** as supporting copy. Keep the homepage focused on account hosting
  and management.
- Add branded HTML account emails with a plain-text fallback containing the
  same information. Codes and links must remain usable without images.
- PDS pages continue to follow the device's light/dark preference, with
  Opnshelf's corresponding colours; do not add a theme selector.
- Preserve all existing locales. Apply branding across languages, retain
  translated security instructions, and introduce no English-only steps.

## Homepage

- Primary action: **Manage your account**, opening PDS login or the account
  dashboard for signed-in visitors.
- Secondary action: **Create an account**, opening Opnshelf's Web App signup.
  Existing PDS registration routes remain functional.
- Translate the homepage into the same seven languages supported by the
  account UI and emails: English, Chinese, Japanese, Korean, Swedish, Finnish,
  and French.
- Retain a small **Powered by Tranquil** footer link. Replace the upstream
  promotional headline, quotation, and **Run Your Own** section with
  account-hosting content.

## Account emails

Use a compact, single-column layout with the Opnshelf mark, a clear heading,
a prominent code or existing action link, and a restrained footer. Use
straightforward security copy without promotional content. Preserve existing
link destinations, codes, and expiry instructions in both HTML and plain text.

Cover every account-email variant: welcome, password reset, email update,
account deletion, PLC operation token, sign-in verification, passkey recovery,
signup verification, legacy-login warning, migration verification, channel
verification, channel verified, and administrator-sent account mail.

## Acceptance

- Review local previews of every affected page type at desktop and mobile
  widths, in both light and dark themes. Include authentication, registration,
  verification, recovery, OAuth account selection and consent, migration,
  account management, and error states, plus the standalone homepage.
- Check keyboard focus, contrast, and translated text overflow.
- Preview every account-email variant, including the plain-text fallback and
  HTML with images disabled.
- Preserve authentication, verification, consent, and recovery behavior.
- Deployment is a separate, explicitly authorized step. Local previews and
  fixtures must not require production account writes or email sends.

The PDS owns these shared browser surfaces, including when reached from the
Mobile App. This scope changes the fork, not the Web App or Mobile App's native
screens; both clients remain the visual reference and retain their existing
authentication behavior.

## Inspected implementation

The fork is maintained at
[Tangled](https://tangled.org/rowanpaulflynn.dev/tranquil-pds).
Its Svelte frontend has shared styles as well as component-specific rules and
a separately styled public homepage. User-facing surfaces include authentication,
OAuth consent, recovery, migration, and account management.

Opnshelf's Web App supplies the visual reference in `apps/web/src/styles.css`
and `apps/web/src/components/Logo.tsx`: Inter body text, Plus Jakarta Sans
display text, slate surfaces, and amber accents. Mobile has corresponding
colours in `apps/mobile/src/theme/index.ts`.

The fork currently sends plain-text emails from
`crates/tranquil-comms/src/email/message.rs`, using localized content. Branded
HTML email therefore requires an additional rendering format. The existing
Opnshelf mail relay already forwards both text and HTML bodies.

The fork already supports server branding configuration, which can override
static frontend colours. Account for that configuration when implementing and
verifying the theme. The homepage has separate styling and currently lacks
the account UI's localization support.

ADR 0007 governs email transport; ADR 0019 keeps PDS infrastructure independently
deployable. ADR 0021 means application Staging shares the production PDS.
Authentication and consent semantics remain subject to ADRs 0004 and 0030.

No product decisions remain open from the design interview. This brief records
the agreed product contract rather than an implementation plan. No new domain
term or architectural trade-off requires a glossary change or ADR.

## Implementation handoff

The Tranquil fork's `issue/211-pds-styling` branch contains the frontend and
email changes. Its `docs/OPNSHELF_STYLING.md` records the changed areas, exact
verification commands, results, and deployment considerations. No Opnshelf
workspace code changed. The separate Opnshelf worktree holds this brief only.
