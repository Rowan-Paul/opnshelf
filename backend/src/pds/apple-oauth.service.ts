import { createPrivateKey, sign as cryptoSign } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const APPLE_AUTH_URL = "https://appleid.apple.com/auth/authorize";
const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
const APPLE_AUDIENCE = "https://appleid.apple.com";

/** Apple caps a client secret at six months; stay well inside it. */
const CLIENT_SECRET_TTL_SECONDS = 150 * 24 * 60 * 60;
/** Re-mint once less than an hour of life remains. */
const CLIENT_SECRET_REFRESH_MARGIN_SECONDS = 60 * 60;

interface AppleTokenResponse {
	id_token?: string;
	error?: string;
	error_description?: string;
}

/**
 * The Apple half of "Continue with Apple" for the browser flow: build the
 * authorize URL and trade the returned code for an `id_token`.
 *
 * As with Google, we reuse the PDS's *own* Apple Service ID on purpose — the
 * PDS validates the `id_token` audience against it, so a separate opnshelf
 * client would fail that check. opnshelf's callback URL must be registered as
 * a second Return URL on the shared Service ID.
 *
 * Native iOS sign-in never comes through here: the OS hands the app an
 * identity token directly, whose audience is the bundle id rather than this
 * Service ID (ADR 0027).
 */
@Injectable()
export class AppleOAuthService {
	private readonly logger = new Logger(AppleOAuthService.name);
	private readonly clientId: string | undefined;
	private readonly teamId: string | undefined;
	private readonly keyId: string | undefined;
	private readonly privateKeyPem: string | undefined;
	private cachedSecret: { secret: string; expiresAt: number } | undefined;

	constructor(private readonly config: ConfigService) {
		this.clientId = this.config.get<string>("APPLE_CLIENT_ID");
		this.teamId = this.config.get<string>("APPLE_TEAM_ID");
		this.keyId = this.config.get<string>("APPLE_KEY_ID");
		// Secret managers commonly flatten PEM newlines into the literal two
		// characters \n, which createPrivateKey rejects.
		this.privateKeyPem = this.config
			.get<string>("APPLE_PRIVATE_KEY")
			?.replace(/\\n/g, "\n");

		if (!this.configured) {
			this.logger.warn(
				"Apple signup is disabled (need APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID and APPLE_PRIVATE_KEY).",
			);
		}
	}

	/** False when the client isn't configured, so callers can hide the button. */
	get configured(): boolean {
		return Boolean(
			this.clientId && this.teamId && this.keyId && this.privateKeyPem,
		);
	}

	/**
	 * Apple insists on `response_mode=form_post` whenever the `email` scope is
	 * requested, which makes the callback a cross-site POST — the reason its
	 * state is signed rather than compared against a cookie (ADR 0028).
	 */
	buildAuthUrl(state: string): string {
		const url = new URL(APPLE_AUTH_URL);
		url.searchParams.set("client_id", this.requireClientId());
		url.searchParams.set("redirect_uri", this.redirectUri());
		url.searchParams.set("response_type", "code");
		url.searchParams.set("response_mode", "form_post");
		url.searchParams.set("scope", "name email");
		url.searchParams.set("state", state);
		return url.toString();
	}

	/**
	 * Exchange the authorization code for the raw `id_token`. We never keep the
	 * access or refresh token — the PDS only wants the identity assertion.
	 */
	async exchangeCode(code: string): Promise<string> {
		const res = await fetch(APPLE_TOKEN_URL, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				code,
				client_id: this.requireClientId(),
				client_secret: this.clientSecret(),
				redirect_uri: this.redirectUri(),
				grant_type: "authorization_code",
			}),
			signal: AbortSignal.timeout(10_000),
		});
		const data = (await res
			.json()
			.catch(() => ({}) as AppleTokenResponse)) as AppleTokenResponse;
		if (!res.ok || !data.id_token) {
			throw new Error(
				`Apple token exchange failed (${res.status}): ${
					data.error_description || data.error || "no id_token in response"
				}`,
			);
		}
		return data.id_token;
	}

	/**
	 * Apple's "client secret" is a short ES256 JWT we sign ourselves with the
	 * .p8 key, not a fixed string. Cached because minting one is a signature and
	 * the result is valid for months.
	 */
	private clientSecret(): string {
		const now = Math.floor(Date.now() / 1000);
		if (
			this.cachedSecret &&
			this.cachedSecret.expiresAt - now > CLIENT_SECRET_REFRESH_MARGIN_SECONDS
		) {
			return this.cachedSecret.secret;
		}

		const expiresAt = now + CLIENT_SECRET_TTL_SECONDS;
		const header = { alg: "ES256", kid: this.requireKeyId(), typ: "JWT" };
		const claims = {
			iss: this.requireTeamId(),
			iat: now,
			exp: expiresAt,
			aud: APPLE_AUDIENCE,
			sub: this.requireClientId(),
		};

		const signingInput = `${encodeSegment(header)}.${encodeSegment(claims)}`;
		// ieee-p1363 is the raw r||s encoding JWS requires; the default DER
		// encoding produces a signature Apple rejects.
		const signature = cryptoSign("sha256", Buffer.from(signingInput), {
			key: createPrivateKey(this.requirePrivateKey()),
			dsaEncoding: "ieee-p1363",
		}).toString("base64url");

		const secret = `${signingInput}.${signature}`;
		this.cachedSecret = { secret, expiresAt };
		return secret;
	}

	/**
	 * Must match a Return URL registered on the shared Apple Service ID exactly,
	 * both here and in the token exchange. Apple rejects http:// entirely, which
	 * is why local development uses the native path or a tunnel.
	 */
	private redirectUri(): string {
		const base =
			this.config.get<string>("BACKEND_PUBLIC_URL") || "http://127.0.0.1:3001";
		return new URL("/auth/apple/callback", base).toString();
	}

	private requireClientId(): string {
		return this.require(this.clientId, "APPLE_CLIENT_ID");
	}

	private requireTeamId(): string {
		return this.require(this.teamId, "APPLE_TEAM_ID");
	}

	private requireKeyId(): string {
		return this.require(this.keyId, "APPLE_KEY_ID");
	}

	private requirePrivateKey(): string {
		return this.require(this.privateKeyPem, "APPLE_PRIVATE_KEY");
	}

	private require(value: string | undefined, name: string): string {
		if (!value) throw new Error(`Apple client is not configured (${name})`);
		return value;
	}
}

function encodeSegment(value: unknown): string {
	return Buffer.from(JSON.stringify(value)).toString("base64url");
}
