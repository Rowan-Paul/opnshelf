import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const TURNSTILE_VERIFY_URL =
	"https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface TurnstileVerifyResponse {
	success: boolean;
	"error-codes"?: string[];
	hostname?: string;
	action?: string;
}

/**
 * Verifies Cloudflare Turnstile tokens server-side. This is the human-check
 * gate that must pass before opnshelf will mint a PDS invite code, keeping
 * bots from spinning up accounts on our Tranquil PDS.
 */
@Injectable()
export class CaptchaService {
	private readonly logger = new Logger(CaptchaService.name);
	private readonly secret: string | undefined;
	private readonly disabled: boolean;

	private readonly isProduction: boolean;

	constructor(private readonly config: ConfigService) {
		this.secret = this.config.get<string>("TURNSTILE_SECRET_KEY");
		// No secret configured means no captcha — the local-dev escape hatch.
		this.disabled = !this.secret;
		this.isProduction = this.config.get<string>("NODE_ENV") === "production";

		if (this.disabled) {
			this.logger.warn(
				"Turnstile verification is DISABLED (no TURNSTILE_SECRET_KEY configured). Do not run this in production.",
			);
		}
	}

	/**
	 * Returns true when the captcha token is valid (or verification is disabled
	 * for local development). Never throws — callers treat false as a hard fail.
	 */
	async verify(token: string | undefined, remoteIp?: string): Promise<boolean> {
		if (this.disabled) {
			// Fail OPEN in dev (escape hatch), but fail CLOSED in production so a
			// misconfigured deploy can never silently accept every bot.
			if (this.isProduction) {
				this.logger.error(
					"Turnstile is disabled in production (no TURNSTILE_SECRET_KEY) — failing closed.",
				);
				return false;
			}
			return true;
		}

		if (!token || token.trim() === "") {
			return false;
		}

		try {
			const body = new URLSearchParams();
			body.set("secret", this.secret as string);
			body.set("response", token);
			if (remoteIp) {
				body.set("remoteip", remoteIp);
			}

			const res = await fetch(TURNSTILE_VERIFY_URL, {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body,
				signal: AbortSignal.timeout(5000),
			});

			if (!res.ok) {
				this.logger.warn(`Turnstile siteverify returned HTTP ${res.status}`);
				return false;
			}

			const data = (await res.json()) as TurnstileVerifyResponse;
			if (!data.success) {
				this.logger.warn(
					`Turnstile verification failed: ${(data["error-codes"] || []).join(", ")}`,
				);
			}
			return data.success === true;
		} catch (error) {
			this.logger.error("Turnstile verification error", error);
			return false;
		}
	}
}
