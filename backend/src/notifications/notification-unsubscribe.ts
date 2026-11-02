import { createHmac, timingSafeEqual } from "node:crypto";
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

/** Keyed address binding keeps the delivery address out of URLs and logs. */
export function unsubscribeEmailTag(secret: string, email: string): string {
	return createHmac("sha256", secret)
		.update(`notification-unsubscribe-email:${email}`)
		.digest("base64url");
}

export function unsubscribeUrl(
	config: BackendEnv,
	did: string,
	email: string,
	category: string,
): string | undefined {
	if (!config.PROVIDER_STATE_SECRET) return undefined;
	const emailTag = unsubscribeEmailTag(config.PROVIDER_STATE_SECRET, email);
	const body = Buffer.from(
		JSON.stringify({ did, emailTag, category }),
	).toString("base64url");
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
						typeof value.emailTag === "string" &&
						Object.hasOwn(emailCategories, value.category)
					) {
						return {
							did: value.did as string,
							emailTag: value.emailTag as string,
							category: value.category as keyof typeof emailCategories,
						};
					}
				} catch {
					/* Invalid payloads use the same error as invalid signatures. */
				}
			}
		}
	}
	return null;
}
