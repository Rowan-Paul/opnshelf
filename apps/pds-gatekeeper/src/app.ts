import crypto from "node:crypto";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import fastifyFormbody from "@fastify/formbody";
import type { GatekeeperConfig } from "./config.js";
import { renderSignupPage } from "./html.js";
import { GateCodeStore } from "./store.js";
import { validateTurnstileToken } from "./turnstile.js";

export interface CreateAppOptions {
	config: GatekeeperConfig;
	store?: GateCodeStore;
	fetchImpl?: typeof fetch;
}

const HOP_BY_HOP_HEADERS = new Set([
	"connection",
	"content-encoding",
	"content-length",
	"host",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"te",
	"trailer",
	"transfer-encoding",
	"upgrade",
]);

function jsonError(
	reply: FastifyReply,
	statusCode: number,
	error: string,
	message: string,
) {
	reply.code(statusCode).type("application/json");
	return reply.send({ error, message });
}

function normalizeRedirectUrl(
	config: Pick<
		GatekeeperConfig,
		"defaultCaptchaRedirect" | "allowedCaptchaRedirects"
	>,
	redirectUrl?: string,
) {
	if (!redirectUrl) {
		return config.defaultCaptchaRedirect;
	}

	try {
		const normalized = new URL(redirectUrl).toString().replace(/\/$/, "");
		return config.allowedCaptchaRedirects.includes(normalized)
			? normalized
			: config.defaultCaptchaRedirect;
	} catch {
		return config.defaultCaptchaRedirect;
	}
}

function remoteIpFromHeaders(headers: Record<string, unknown>) {
	const candidates = [
		headers["cf-connecting-ip"],
		headers["x-real-ip"],
		headers["x-forwarded-for"],
	];

	for (const value of candidates) {
		if (typeof value === "string" && value.trim() !== "") {
			return value.split(",")[0]?.trim();
		}
	}

	return undefined;
}

function buildErrorRedirect(
	handle: string,
	state: string,
	message: string,
	redirectUrl?: string,
) {
	const params = new URLSearchParams({
		handle,
		state,
		error: message,
	});

	if (redirectUrl) {
		params.set("redirect_url", redirectUrl);
	}

	return `/gate/signup?${params.toString()}`;
}

function copyRequestHeaders(headers: Record<string, unknown>) {
	const nextHeaders = new Headers();

	for (const [key, value] of Object.entries(headers)) {
		if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
			continue;
		}

		if (typeof value === "string") {
			nextHeaders.set(key, value);
			continue;
		}

		if (Array.isArray(value)) {
			nextHeaders.set(key, value.join(", "));
		}
	}

	return nextHeaders;
}

async function proxyResponse(
	reply: FastifyReply,
	response: Response,
	bodyOverride?: string,
) {
	reply.code(response.status);
	for (const [key, value] of response.headers.entries()) {
		if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
			continue;
		}
		reply.header(key, value);
	}

	const body = bodyOverride ?? (await response.text());
	return reply.send(body);
}

export async function createApp({
	config,
	fetchImpl = fetch,
	store,
}: CreateAppOptions): Promise<FastifyInstance> {
	const resolvedStore = store ?? (await GateCodeStore.open(config));
	const app = Fastify({
		logger: true,
		disableRequestLogging: false,
	});

	app.addHook("onClose", async () => {
		resolvedStore.close();
	});

	app.register(fastifyFormbody);

	app.get("/health", async () => ({ ok: true }));

	app.get("/", async () => ({
		service: "pds-gatekeeper",
		pdsBaseUrl: config.pdsBaseUrl,
		signupProtectionEnabled: config.enableSignupProtection,
	}));

	app.get("/gate/signup", async (request, reply) => {
		const query = request.query as {
			error?: string;
			handle?: string;
			redirect_url?: string;
			state?: string;
		};

		if (!query.handle || !query.state) {
			return jsonError(
				reply,
				400,
				"InvalidRequest",
				"handle and state are required",
			);
		}

		reply.type("text/html; charset=utf-8");
		return reply.send(
			renderSignupPage(config, {
				handle: query.handle,
				state: query.state,
				errorMessage: query.error,
				redirectUrl: query.redirect_url,
			}),
		);
	});

	app.post("/gate/signup", async (request, reply) => {
		const query = request.query as {
			handle?: string;
			redirect_url?: string;
			state?: string;
		};
		const body = request.body as {
			"cf-turnstile-response"?: string;
			redirect_url?: string;
			state?: string;
		};

		const handle = query.handle;
		const state = query.state;
		const redirectUrl = body.redirect_url ?? query.redirect_url;

		if (!handle || !state) {
			return jsonError(
				reply,
				400,
				"InvalidRequest",
				"handle and state are required",
			);
		}

		const token = body["cf-turnstile-response"];
		if (!token) {
			return reply.redirect(
				buildErrorRedirect(
					handle,
					state,
					"Verification failed. Please try again.",
					redirectUrl,
				),
			);
		}

		const remoteIp = remoteIpFromHeaders(request.headers);
		const validation = await validateTurnstileToken(
			config,
			token,
			remoteIp,
			fetchImpl,
		);

		if (!validation.success) {
			request.log.warn(
				{ errorCodes: validation.errorCodes, handle },
				"turnstile validation failed",
			);
			return reply.redirect(
				buildErrorRedirect(
					handle,
					state,
					"Verification failed. Please try again.",
					redirectUrl,
				),
			);
		}

		const code = resolvedStore.issueCode(handle);
		const successRedirectBase = normalizeRedirectUrl(config, redirectUrl);
		const successRedirect = new URL(successRedirectBase);
		successRedirect.searchParams.set("code", code);
		successRedirect.searchParams.set("state", state);

		return reply.redirect(successRedirect.toString());
	});

	app.get("/xrpc/com.atproto.server.describeServer", async (request, reply) => {
		const headers = copyRequestHeaders(request.headers);
		headers.set("accept", "application/json");
		const response = await fetchImpl(
			`${config.pdsBaseUrl}/xrpc/com.atproto.server.describeServer`,
			{
				headers,
				method: "GET",
			},
		);

		const contentType = response.headers.get("content-type") ?? "";
		if (!contentType.includes("application/json")) {
			return proxyResponse(reply, response);
		}

		const payload = (await response.json()) as Record<string, unknown>;
		payload.phoneVerificationRequired = config.enableSignupProtection;
		reply.type("application/json");
		reply.code(response.status);
		return reply.send(payload);
	});

	app.post("/xrpc/com.atproto.server.createAccount", async (request, reply) => {
		const payload = request.body as Record<string, unknown> | undefined;
		const handle = typeof payload?.handle === "string" ? payload.handle : undefined;
		const verificationCode =
			typeof payload?.verificationCode === "string"
				? payload.verificationCode
				: undefined;

		if (!handle) {
			return jsonError(
				reply,
				400,
				"InvalidRequest",
				"The 'handle' field is required.",
			);
		}

		if (config.enableSignupProtection) {
			if (!verificationCode) {
				return jsonError(
					reply,
					400,
					"InvalidRequest",
					"Verification is required on this server.",
				);
			}

			const result = resolvedStore.consumeCode(
				handle,
				verificationCode,
				config.signupCodeTtlSeconds,
			);

			if (!result.ok) {
				return jsonError(
					reply,
					result.reason === "expired" ? 400 : 400,
					result.reason === "expired" ? "ExpiredToken" : "InvalidToken",
					result.reason === "expired"
						? "Token has expired"
						: "Token could not be verified",
				);
			}
		}

		const headers = copyRequestHeaders(request.headers);
		headers.set("content-type", "application/json");
		if (!headers.has("x-request-id")) {
			headers.set("x-request-id", crypto.randomUUID());
		}

		const response = await fetchImpl(
			`${config.pdsBaseUrl}/xrpc/com.atproto.server.createAccount`,
			{
				method: "POST",
				headers,
				body: JSON.stringify(payload ?? {}),
			},
		);

		return proxyResponse(reply, response);
	});

	return app;
}
