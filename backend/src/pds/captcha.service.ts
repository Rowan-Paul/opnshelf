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

	constructor(private readonly config: ConfigService) {
		this.secret = this.config.get<string>("TURNSTILE_SECRET_KEY");
		// Explicit opt-out for local dev where running a captcha is impractical.
		this.disabled =
			this.config.get<string>("TURNSTILE_DISABLE") === "true" || !this.secret;

		if (this.disabled) {
			this.logger.warn(
				"Turnstile verification is DISABLED (no secret or TURNSTILE_DISABLE=true). Do not run this in production.",
			);
		}
	}

	/**
	 * Returns true when the captcha token is valid (or verification is disabled
	 * for local development). Never throws — callers treat false as a hard fail.
	 */
	async verify(token: string | undefined, remoteIp?: string): Promise<boolean> {
		if (this.disabled) {
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
