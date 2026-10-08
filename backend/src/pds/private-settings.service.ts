import { ForbiddenException, Injectable } from "@nestjs/common";
import {
	includesWatchSpaceGrant,
	PRIVATE_SETTINGS_SCOPE,
} from "../auth/oauth-scopes";
import { requireWatchSession } from "../privacy/watch-operation";

/** Cleanup only. ADR 0048 retires the time-format experiment; account settings
 * no longer read or write its record. No content Space can be addressed here. */
@Injectable()
export class PrivateSettingsService {
	async canDelete(value: unknown) {
		const session = requireWatchSession(value);
		return includesWatchSpaceGrant(
			(await session.getTokenInfo()).scope,
			PRIVATE_SETTINGS_SCOPE,
			session.did,
		);
	}
	async delete(did: string, value: unknown) {
		const session = requireWatchSession(value);
		if (session.did !== did || !(await this.canDelete(session)))
			throw new ForbiddenException(
				"Sign in again to finish removing the retired Settings experiment.",
			);
		const response = await session.fetchHandler(
			"/xrpc/com.atproto.simplespace.deleteSpace",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					space: `at://${did}/space/xyz.opnshelf.settings/self`,
				}),
				signal: AbortSignal.timeout(10000),
			},
		);
		if (response.ok) return;
		const body: unknown = await response.json();
		if (
			body &&
			typeof body === "object" &&
			"error" in body &&
			["SpaceNotFound", "SpaceDeleted"].includes(String(body.error))
		)
			return;
		throw new Error("Could not remove the retired Settings Space");
	}
}
