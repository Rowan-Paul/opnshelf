import {
	BadGatewayException,
	BadRequestException,
	ForbiddenException,
	Injectable,
} from "@nestjs/common";
import { BackendEnv } from "../config/env.schema";
import {
	includesRequestedScopes,
	PRIVATE_SETTINGS_SCOPE,
} from "../auth/oauth-scopes";

export type PrivateSettingsStatus =
	| "disabled"
	| "available"
	| "unsupported"
	| "connected"
	| "missing"
	| "permissionRequired"
	| "unavailable";
export interface PrivateSettingsState {
	enabled: boolean;
	status: PrivateSettingsStatus;
}
interface Session {
	did: string;
	fetchHandler(path: string, init?: RequestInit): Promise<Response>;
	getTokenInfo(
		refresh?: boolean | "auto",
	): Promise<{ scope?: string | string[] }>;
}
const TYPE = "xyz.opnshelf.settings";
const COLLECTION = "xyz.opnshelf.privateSettings";
const MISSING = new Set(["SpaceNotFound", "SpaceDeleted", "RecordNotFound"]);
const UNSUPPORTED = new Set([
	"NotImplemented",
	"MethodNotImplemented",
	"XRPCNotSupported",
]);
class PdsError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
	) {
		super(code);
	}
}

/** Owner-only private setting transport. All authenticated calls use the OAuth
 * session's fetchHandler, preserving audience binding, DPoP and token renewal.
 * No public-repository fallback is permitted. */
@Injectable()
export class PrivateSettingsService {
	constructor(private readonly env: BackendEnv) {}

	private session(did: string, value: unknown): Session {
		const candidate = value as Partial<Session> | undefined;
		if (
			candidate?.did !== did ||
			typeof candidate.fetchHandler !== "function" ||
			typeof candidate.getTokenInfo !== "function"
		) {
			throw new ForbiddenException("Sign in again to access Private Settings");
		}
		return candidate as Session;
	}
	private params(did: string) {
		return {
			space: `at://${did}/space/${TYPE}/self`,
			repo: did,
			collection: COLLECTION,
			rkey: "self",
		};
	}
	private async call(
		session: Session,
		method: string,
		params: Record<string, unknown>,
		write = false,
	) {
		const query = new URLSearchParams();
		if (!write)
			for (const [key, value] of Object.entries(params))
				query.set(key, String(value));
		const response = await session.fetchHandler(
			`/xrpc/${method}${write ? "" : `?${query}`}`,
			{
				method: write ? "POST" : "GET",
				...(write
					? {
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify(params),
						}
					: {}),
				signal: AbortSignal.timeout(10000),
			},
		);
		const text = await response.text();
		let body: Record<string, unknown> = {};
		try {
			body = text ? JSON.parse(text) : {};
		} catch {
			throw new PdsError(response.status, "InvalidResponse");
		}
		if (!response.ok)
			throw new PdsError(
				response.status,
				typeof body.error === "string" ? body.error : "UnknownError",
			);
		return body;
	}
	private failure(error: unknown): PrivateSettingsStatus {
		if (error instanceof ForbiddenException) return "permissionRequired";
		if (error instanceof PdsError) {
			if (UNSUPPORTED.has(error.code)) return "unsupported";
			if (error.status === 401 || error.status === 403)
				return "permissionRequired";
			if (MISSING.has(error.code)) return "missing";
		}
		return "unavailable";
	}
	async read(
		did: string,
		enabled: boolean,
		value: unknown,
	): Promise<PrivateSettingsState & { timeFormat?: "12h" | "24h" }> {
		if (!this.env.ENABLE_ATPROTO_SPACES) return { enabled, status: "disabled" };
		try {
			const session = this.session(did, value);
			if (!enabled) {
				// A read-only probe; Tranquil lists only Spaces covered by this grant.
				try {
					await this.call(session, "com.atproto.space.listSpaces", {
						limit: 1,
					});
				} catch (error) {
					if (
						!(error instanceof PdsError) ||
						error.code !== "InsufficientScope"
					)
						throw error;
				}
				return { enabled, status: "available" };
			}
			await this.requireGrant(session);
			const body = await this.call(
				session,
				"com.atproto.space.getRecord",
				this.params(did),
			);
			const record = body.value as Record<string, unknown> | undefined;
			if (
				record?.$type !== COLLECTION ||
				(record.timeFormat !== "12h" && record.timeFormat !== "24h")
			) {
				throw new Error("Invalid private setting");
			}
			return { enabled, status: "connected", timeFormat: record.timeFormat };
		} catch (error) {
			return { enabled, status: this.failure(error) };
		}
	}
	async assertAvailable(did: string, session: unknown) {
		const state = await this.read(did, false, session);
		if (state.status !== "available")
			throw new BadRequestException(
				"Private Settings are not available on this PDS right now",
			);
	}
	private async requireGrant(session: Session) {
		if (
			!includesRequestedScopes((await session.getTokenInfo()).scope, [
				PRIVATE_SETTINGS_SCOPE,
			])
		) {
			throw new ForbiddenException(
				"Reconnect Private Settings to grant access",
			);
		}
	}
	private async assertPrivate(session: Session, did: string) {
		const { space } = this.params(did);
		const config = await this.call(
			session,
			"com.atproto.simplespace.getSpace",
			{ space },
		);
		for (const key of ["readPolicy", "writePolicy"]) {
			if (
				(config[key] as { $type?: unknown } | undefined)?.$type !==
				"com.atproto.simplespace.defs#memberListPolicy"
			) {
				throw new Error("Settings Space is not private");
			}
		}
		const members = await this.call(
			session,
			"com.atproto.simplespace.listMembers",
			{ space, limit: 100 },
		);
		if (
			!Array.isArray(members.members) ||
			members.cursor ||
			members.members.some((member: { did?: unknown }) => member.did !== did)
		) {
			throw new Error("Settings Space has other members");
		}
	}
	async delete(did: string, value: unknown) {
		if (!this.env.ENABLE_ATPROTO_SPACES)
			throw new BadRequestException(
				"Private Settings are temporarily disabled",
			);
		const session = this.session(did, value);
		await this.requireGrant(session);
		try {
			await this.call(
				session,
				"com.atproto.space.deleteRecord",
				this.params(did),
				true,
			);
		} catch (error) {
			if (error instanceof PdsError && MISSING.has(error.code)) return;
			throw new BadGatewayException(
				"Could not delete Private Settings on your PDS",
			);
		}
	}

	async save(did: string, value: unknown, timeFormat: string) {
		if (!this.env.ENABLE_ATPROTO_SPACES)
			throw new BadRequestException(
				"Private Settings are temporarily disabled",
			);
		if (timeFormat !== "12h" && timeFormat !== "24h")
			throw new BadRequestException("Invalid time format");
		const session = this.session(did, value);
		await this.requireGrant(session);
		const params = this.params(did);
		try {
			try {
				await this.call(session, "com.atproto.simplespace.getSpace", {
					space: params.space,
				});
			} catch (error) {
				if (
					!(error instanceof PdsError) ||
					!new Set(["SpaceNotFound", "SpaceDeleted"]).has(error.code)
				)
					throw error;
				try {
					await this.call(
						session,
						"com.atproto.simplespace.createSpace",
						{
							spaceType: TYPE,
							skey: "self",
							readPolicy: {
								$type: "com.atproto.simplespace.defs#memberListPolicy",
							},
							writePolicy: {
								$type: "com.atproto.simplespace.defs#memberListPolicy",
							},
							appAccess: { $type: "com.atproto.simplespace.defs#open" },
						},
						true,
					);
				} catch (race) {
					if (!(race instanceof PdsError) || race.code !== "SpaceAlreadyExists")
						throw race;
				}
			}
			await this.assertPrivate(session, did);
			await this.call(
				session,
				"com.atproto.space.putRecord",
				{
					...params,
					record: { $type: COLLECTION, timeFormat },
					validate: false,
				},
				true,
			);
		} catch (error) {
			if (this.failure(error) === "permissionRequired")
				throw new ForbiddenException(
					"Reconnect Private Settings to grant access",
				);
			throw new BadGatewayException(
				"Could not save Private Settings on your PDS. Your setting was not changed locally.",
			);
		}
	}
}
