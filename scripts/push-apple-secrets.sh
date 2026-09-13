#!/usr/bin/env bash
#
# Push the two Apple values that must not travel through a chat, a commit, or a
# shell history to Railway:
#
#   APPLE_PRIVATE_KEY / SSO_APPLE_PRIVATE_KEY  the .p8 signing key
#   PROVIDER_STATE_SECRET                      HMAC key for Apple's form_post
#                                              callback state (ADR 0028)
#
# Everything else Apple needs is public and already set. Values are piped to
# `railway variable set --stdin`, so they never appear in the process argument
# list (visible to any other process via ps) and are never echoed here.
#
# Run from anywhere:  ./scripts/push-apple-secrets.sh
set -euo pipefail

OPNSHELF_PROJECT="1a13bf39-0e6a-4643-8ddd-1fec6a6b5751"
PDS_PROJECT="fc621531-bc5e-411f-80fa-9beae4488bd9"

if ! command -v railway >/dev/null 2>&1; then
	if [ -x "$HOME/.railway/bin/railway" ]; then
		PATH="$HOME/.railway/bin:$PATH"
		export PATH
	else
		echo "✗ railway CLI not found. Install it, then re-run." >&2
		exit 1
	fi
fi

railway whoami >/dev/null 2>&1 || {
	echo "✗ Not logged in. Run 'railway login' first." >&2
	exit 1
}

# --- the .p8 -----------------------------------------------------------------

DEFAULT_KEY="$HOME/Downloads/AuthKey_QDQ6QDA923.p8"
read -r -p "Path to the Apple .p8 key [${DEFAULT_KEY}]: " KEY_PATH
KEY_PATH="${KEY_PATH:-$DEFAULT_KEY}"
KEY_PATH="${KEY_PATH/#\~/$HOME}"

if [ ! -f "$KEY_PATH" ]; then
	echo "✗ No file at $KEY_PATH" >&2
	exit 1
fi

# Fail here rather than at the first sign-in attempt: a truncated or
# wrong-format key is otherwise invisible until Apple rejects a token.
if ! openssl pkey -in "$KEY_PATH" -noout 2>/dev/null; then
	echo "✗ $KEY_PATH is not a readable private key." >&2
	exit 1
fi
echo "✓ Key parses."

# --- push --------------------------------------------------------------------

# set_secret <project> <service> <environment> <var-name> ; value on stdin
set_secret() {
	railway variable set "$4" --stdin \
		--project "$1" --service "$2" --environment "$3" \
		--skip-deploys >/dev/null
	echo "  → $4 on $2/$3"
}

# Rotating this invalidates every Apple signup in flight, so it is written only
# when absent. Re-running the script must be safe.
has_variable() {
	railway variable list --project "$1" --service "$2" --environment "$3" --kv 2>/dev/null |
		grep -q "^$4="
}

echo
echo "Opnshelf backend:"
for ENVIRONMENT in production staging; do
	if has_variable "$OPNSHELF_PROJECT" "Server" "$ENVIRONMENT" "PROVIDER_STATE_SECRET"; then
		echo "  · PROVIDER_STATE_SECRET already set on Server/$ENVIRONMENT, left alone"
	else
		# A distinct secret per environment: a staging leak must not let anyone
		# mint state that production would accept.
		openssl rand -base64 32 |
			set_secret "$OPNSHELF_PROJECT" "Server" "$ENVIRONMENT" "PROVIDER_STATE_SECRET"
	fi
	set_secret "$OPNSHELF_PROJECT" "Server" "$ENVIRONMENT" "APPLE_PRIVATE_KEY" <"$KEY_PATH"
done

echo
echo "Tranquil PDS:"
set_secret "$PDS_PROJECT" "tranquil-pds" "production" "SSO_APPLE_PRIVATE_KEY" <"$KEY_PATH"
# Flipped on last, and only now: the provider config returns None while the key
# is missing, so enabling it earlier would advertise a provider that cannot work.
printf 'true' |
	set_secret "$PDS_PROJECT" "tranquil-pds" "production" "SSO_APPLE_ENABLED"

cat <<'DONE'

✓ Done. Nothing was printed, and no deploys were triggered (--skip-deploys),
  so the values land on the next deploy of each service.

  PROVIDER_STATE_SECRET is only written when absent, so re-running this is
  safe. To rotate it deliberately, delete it in Railway first.

  Remaining, both outside Railway:
    - EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID in
      the EAS production environment (preview reads them from eas.json)
    - move the .p8 out of Downloads into a password manager

  Verify the local side any time with:
    pnpm --filter backend run verify:apple
DONE
