/**
 * Pre-flight the Apple Sign in credentials against the values in this
 * environment. Catches the paste-level mistakes — a mangled .p8, a truncated
 * Team ID, the App ID pasted where the Services ID belongs — before they
 * surface as a failed sign-in on a device.
 *
 * It signs a client secret with the production AppleOAuthService, not a copy,
 * so a bug here is a bug there.
 *
 * What it deliberately does NOT do is ask Apple. There is no way to: Apple's
 * token endpoint validates the authorization code before it authenticates the
 * client, so a probe with a fake code answers `invalid_grant` no matter what
 * the credentials are — verified experimentally, including with a client_id
 * that does not exist. Anything Apple-side (the key really belonging to this
 * team, the Service ID's return URL, the primary App ID grouping) is only
 * provable by a real sign-in.
 *
 *   pnpm --filter backend run verify:apple
 */
import { ConfigService } from "@nestjs/config";
import { AppleOAuthService } from "../src/pds/apple-oauth.service";

const REQUIRED = [
	"APPLE_CLIENT_ID",
	"APPLE_TEAM_ID",
	"APPLE_KEY_ID",
	"APPLE_PRIVATE_KEY",
] as const;

const problems: string[] = [];

function main(): void {
	const missing = REQUIRED.filter((name) => !process.env[name]);
	if (missing.length > 0) {
		console.error(`\n✗ Missing: ${missing.join(", ")}\n`);
		process.exit(1);
	}

	const clientId = process.env.APPLE_CLIENT_ID as string;
	const teamId = process.env.APPLE_TEAM_ID as string;
	const keyId = process.env.APPLE_KEY_ID as string;

	console.log(`Service ID : ${clientId}`);
	console.log(`Team ID    : ${teamId}`);
	console.log(`Key ID     : ${keyId}`);

	if (teamId.length !== 10) {
		problems.push(
			`APPLE_TEAM_ID should be 10 characters, got ${teamId.length}.`,
		);
	}
	if (keyId.length !== 10) {
		problems.push(`APPLE_KEY_ID should be 10 characters, got ${keyId.length}.`);
	}
	// The Services ID and the App ID are different identifiers. Pasting the App
	// ID here is the single most common way this is misconfigured, and it fails
	// at sign-in with an opaque error.
	if (clientId === "com.rowanpaul.opnshelf") {
		problems.push(
			"APPLE_CLIENT_ID is the iOS App ID. It must be the Services ID — the identifier that carries the return URL.",
		);
	}

	const apple = new AppleOAuthService(new ConfigService());
	if (!apple.configured) {
		problems.push("AppleOAuthService reports it is not configured.");
	} else {
		try {
			// Reach past `private`: signing is the thing worth proving.
			const secret = (
				apple as unknown as { clientSecret(): string }
			).clientSecret();
			const [, claimsSegment, signature] = secret.split(".");
			const claims = JSON.parse(
				Buffer.from(claimsSegment, "base64url").toString("utf8"),
			) as { exp: number; iat: number; iss: string; sub: string };

			if (Buffer.from(signature, "base64url").length !== 64) {
				problems.push(
					"The signature is not 64 bytes, so it is not the raw r||s encoding JWS requires.",
				);
			}
			const days = Math.round((claims.exp - claims.iat) / 86_400);
			if (claims.exp - claims.iat > 15_777_000) {
				problems.push(`Client secret lifetime is ${days} days; Apple caps it at 6 months.`);
			}
			console.log(`Secret     : signs cleanly, valid ${days} days`);
		} catch (error) {
			problems.push(
				`Could not sign a client secret — the private key is probably malformed. ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	if (problems.length > 0) {
		console.error("\n✗ Problems found:");
		for (const problem of problems) console.error(`  - ${problem}`);
		console.error("");
		process.exit(1);
	}

	console.log("\n✓ The local Apple configuration is internally consistent.");
	console.log(
		"  Apple has not confirmed any of it — only a real sign-in can do that.\n",
	);
}

main();
