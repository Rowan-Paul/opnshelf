import type { GatekeeperConfig } from "./config.js";

export interface TurnstileValidationResult {
	success: boolean;
	errorCodes: string[];
}

export async function validateTurnstileToken(
	config: Pick<
		GatekeeperConfig,
		| "turnstileExpectedAction"
		| "turnstileExpectedHostname"
		| "turnstileSecretKey"
	>,
	token: string,
	remoteIp?: string,
	fetchImpl: typeof fetch = fetch,
): Promise<TurnstileValidationResult> {
	const params = new URLSearchParams({
		secret: config.turnstileSecretKey,
		response: token,
	});

	if (remoteIp) {
		params.set("remoteip", remoteIp);
	}

	const response = await fetchImpl(
		"https://challenges.cloudflare.com/turnstile/v0/siteverify",
		{
			method: "POST",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
			},
			body: params.toString(),
		},
	);

	if (!response.ok) {
		return { success: false, errorCodes: ["siteverify-http-error"] };
	}

	const payload = (await response.json()) as {
		success?: boolean;
		action?: string;
		hostname?: string;
		["error-codes"]?: string[];
	};

	if (payload.success !== true) {
		return {
			success: false,
			errorCodes: payload["error-codes"] ?? ["turnstile-validation-failed"],
		};
	}

	if (payload.action !== config.turnstileExpectedAction) {
		return { success: false, errorCodes: ["action-mismatch"] };
	}

	if (payload.hostname !== config.turnstileExpectedHostname) {
		return { success: false, errorCodes: ["hostname-mismatch"] };
	}

	return { success: true, errorCodes: [] };
}
