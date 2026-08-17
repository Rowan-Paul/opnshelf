import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

interface GoogleTokenResponse {
	id_token?: string;
	error?: string;
	error_description?: string;
}

/**
 * The Google half of "Continue with Google": build the consent URL and trade
 * the returned code for an `id_token`.
 *
 * We reuse the PDS's *own* Google client id and secret on purpose. The PDS
 * verifies the `id_token` audience against that client id, so a separate
 * opnshelf client would fail that check. opnshelf's callback URL must therefore
 * be registered as a second redirect URI on the shared client.
 */
@Injectable()
export class GoogleOAuthService {
	private readonly logger = new Logger(GoogleOAuthService.name);
	private readonly clientId: string | undefined;
	private readonly clientSecret: string | undefined;

	constructor(private readonly config: ConfigService) {
		this.clientId = this.config.get<string>("GOOGLE_CLIENT_ID");
		this.clientSecret = this.config.get<string>("GOOGLE_CLIENT_SECRET");
		if (!this.clientId || !this.clientSecret) {
			this.logger.warn(
				"Google signup is disabled (need GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET).",
			);
		}
	}

	/** False when the client isn't configured, so callers can hide the button. */
	get configured(): boolean {
		return Boolean(this.clientId && this.clientSecret);
	}

	buildAuthUrl(state: string): string {
		const { id } = this.requireClient();
		const url = new URL(GOOGLE_AUTH_URL);
		url.searchParams.set("client_id", id);
		url.searchParams.set("redirect_uri", this.redirectUri());
		url.searchParams.set("response_type", "code");
		url.searchParams.set("scope", "openid email profile");
		url.searchParams.set("state", state);
		// Always show the chooser: signing up must never silently reuse whichever
		// Google account the browser happens to be signed into.
		url.searchParams.set("prompt", "select_account");
		return url.toString();
	}

	/**
	 * Exchange the authorization code for the raw `id_token`. We never keep the
	 * access token — the PDS only wants the identity assertion.
	 */
	async exchangeCode(code: string): Promise<string> {
		const { id, secret } = this.requireClient();
		const res = await fetch(GOOGLE_TOKEN_URL, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				code,
				client_id: id,
				client_secret: secret,
				redirect_uri: this.redirectUri(),
				grant_type: "authorization_code",
			}),
			signal: AbortSignal.timeout(10_000),
		});
		const data = (await res
			.json()
			.catch(() => ({}) as GoogleTokenResponse)) as GoogleTokenResponse;
		if (!res.ok || !data.id_token) {
			throw new Error(
				`Google token exchange failed (${res.status}): ${
					data.error_description || data.error || "no id_token in response"
				}`,
			);
		}
		return data.id_token;
	}

	/**
	 * Must match the redirect URI registered on the shared Google client exactly,
	 * both here and in the token exchange.
	 */
	private redirectUri(): string {
		const base =
			this.config.get<string>("BACKEND_PUBLIC_URL") || "http://127.0.0.1:3001";
		return new URL("/auth/google/callback", base).toString();
	}

	private requireClient(): { id: string; secret: string } {
		if (!this.clientId || !this.clientSecret) {
			throw new Error("Google client is not configured");
		}
		return { id: this.clientId, secret: this.clientSecret };
	}
}
