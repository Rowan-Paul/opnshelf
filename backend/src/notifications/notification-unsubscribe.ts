import { createHmac, timingSafeEqual } from "node:crypto";
import { BadRequestException } from "@nestjs/common";
import type { BackendEnv } from "../config/env.schema";

export const emailCategories = {
	NewReleases: "new releases",
	WatchlistReleases: "Watchlist releases",
	NewSeasons: "new seasons",
	Stats: "Watch Recaps",
} as const;

function signature(secret: string, body: string): Buffer {
	return createHmac("sha256", secret)
		.update(`notification-unsubscribe:${body}`)
		.digest();
}

export function unsubscribeUrl(
	config: BackendEnv,
	did: string,
	email: string,
	category: string,
): string {
	if (!config.PROVIDER_STATE_SECRET) throw new Error("Missing signing secret");
	const body = Buffer.from(JSON.stringify({ did, email, category })).toString(
		"base64url",
	);
	const token = `${body}.${signature(config.PROVIDER_STATE_SECRET, body).toString("base64url")}`;
	const url = new URL(
		"/notifications/unsubscribe",
		config.BACKEND_PUBLIC_URL || "http://127.0.0.1:3001",
	);
	url.searchParams.set("token", token);
	return url.toString();
}

export function verifyUnsubscribe(secret: string | undefined, token: unknown) {
	if (secret && typeof token === "string" && token.length < 4096) {
		const [body, signed, extra] = token.split(".");
		if (body && signed && !extra) {
			const actual = Buffer.from(signed, "base64url");
			const expected = signature(secret, body);
			if (
				actual.length === expected.length &&
				timingSafeEqual(actual, expected)
			) {
				try {
					const value = JSON.parse(
						Buffer.from(body, "base64url").toString("utf8"),
					);
					if (
						typeof value.did === "string" &&
						typeof value.email === "string" &&
						Object.hasOwn(emailCategories, value.category)
					) {
						return {
							did: value.did as string,
							email: value.email as string,
							category: value.category as keyof typeof emailCategories,
						};
					}
				} catch {
					/* Invalid payloads use the same error as invalid signatures. */
				}
			}
		}
	}
	throw new BadRequestException(
		"This unsubscribe link is invalid. Use the link in a recent notification email.",
	);
}
