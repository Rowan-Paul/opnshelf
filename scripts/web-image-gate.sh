#!/usr/bin/env bash
# Builds the Web production image the way Railway does and checks the parts
# that only fail there: the build stage's CA bundle and the PostHog source-map
# upload configuration. Run from the repository root; needs Docker and network.
#
# Railway builds apps/web/Dockerfile from the repository root and passes every
# service variable as a build argument, including RAILWAY_GIT_COMMIT_SHA. The
# upload needs a real PostHog key, so the probe passes an obviously fake one and
# expects the build to stop at authentication: reaching that point proves the
# CLI made a verified HTTPS request and accepted the release metadata.
set -euo pipefail

commit_sha="${RAILWAY_GIT_COMMIT_SHA:-$(git rev-parse HEAD)}"
dockerfile=apps/web/Dockerfile
image="${WEB_IMAGE_TAG:-opnshelf-web:gate}"
log="$(mktemp)"
trap 'rm -f "$log"' EXIT

production_args=(
	--file "$dockerfile"
	--build-arg "RAILWAY_GIT_COMMIT_SHA=$commit_sha"
	--build-arg "VITE_API_URL=https://api.opnshelf.invalid"
	--build-arg "VITE_SITE_URL=https://opnshelf.invalid"
)

echo "::group::Build the production image"
docker build "${production_args[@]}" --tag "$image" .
echo "::endgroup::"

echo "::group::Check the build stage CA bundle"
# The PostHog CLI is a Rust binary that reads the system bundle. Node ships its
# own roots, so a Node fetch would pass even without this file.
docker build --quiet "${production_args[@]}" --target base --tag "$image-base" . >/dev/null
docker run --rm "$image-base" test -s /etc/ssl/certs/ca-certificates.crt ||
	{ echo "::error::The Web build stage has no CA bundle; PostHog uploads cannot verify HTTPS."; exit 1; }
echo "::endgroup::"

echo "::group::Probe the source-map upload up to authentication"
if docker build --progress=plain "${production_args[@]}" --target build \
	--build-arg "POSTHOG_CLI_API_KEY=phx_ci_placeholder_not_a_real_key" \
	--build-arg "POSTHOG_CLI_PROJECT_ID=1" \
	. >"$log" 2>&1; then
	echo "::error::The Web build succeeded with a fake PostHog key; the source-map upload did not run."
	exit 1
fi
echo "::endgroup::"

if grep -q "panicked" "$log"; then
	grep -m 5 -A 2 "panicked" "$log"
	echo "::error::The PostHog CLI crashed before authenticating, which is how a missing CA bundle fails."
	exit 1
fi
if grep -q "Release fields are incomplete" "$log"; then
	grep -m 1 "Release fields are incomplete" "$log"
	echo "::error::The source-map upload has no release version. Railway passes RAILWAY_GIT_COMMIT_SHA; the Dockerfile and vite.config.ts must forward it."
	exit 1
fi
if ! grep -q "authentication_failed" "$log"; then
	tail -n 40 "$log"
	echo "::error::The source-map upload failed before reaching PostHog authentication."
	exit 1
fi
echo "Source-map upload reached PostHog authentication with release version $commit_sha."
