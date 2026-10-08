# Spaces alpha declarations

`lexicons/` contains the five `type: "space"` declarations that the reference
PDS resolves when showing OAuth consent. These are publication inputs, not
record validators. The current stable `lex build` rejects the alpha `space`
type, so they live outside the ordinary record-code generation directory.
`backend/scripts/publish-lexicons.ts` includes this directory only with `--include-spaces`.

Watches, Library, Notes and retired Settings use the `self` key. Lists use the
existing List record key. The Settings declaration remains solely so an account
can grant deletion access to the retired experiment; it does not restore its
record or UI.

The declaration shapes were checked against the pinned reference alpha image's
`@atproto/lex-document` validator and exercised through local Lexicon resolution.
The Backend declaration tests verify their keys and collection lists; they are
not part of the workspace formatting gate.

Publish only with explicit operator approval, before enabling Privacy Alpha in
production. The authority account must publish these as
`com.atproto.lexicon.schema` records, with their NSIDs as record keys, and the
`_lexicon.opnshelf.xyz` TXT record must resolve to that account's DID. Verify
OAuth consent against a reference PDS after publication; local authority tests
do not prove production DNS or publication is ready.
