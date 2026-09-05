import { buildAvatarUrl, rebaseAvatarUrl } from "./avatar-url";
import { MAX_AVATAR_BYTES } from "./avatar.constants";
import { Agent } from "@atproto/api";
import { IdResolver } from "@atproto/identity";
import {
	BadGatewayException,
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
	PayloadTooLargeException,
	UnsupportedMediaTypeException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import type { Response as UpstreamResponse } from "undici";
import {
	$nsid as PROFILE_COLLECTION,
	main as profileSchema,
} from "../lexicons/xyz/opnshelf/profile.defs";
import type { Main as ProfileRecord } from "../lexicons/xyz/opnshelf/profile.defs";
import { SafeFetchError, safeFetch } from "../common/safe-fetch";
import { PrismaService } from "../prisma/prisma.service";
export interface ATSession {
	did: string;
}

type ProfileIndexResult = {
	displayName: string | null;
	avatar: string | null;
};

type UploadableImage = {
	buffer: Buffer;
	mimetype: string;
	size: number;
};

type StoredProfileRecord = {
	record: ProfileRecord;
	uri: string;
	cid: string | null;
};

type PlainProfileBlob = NonNullable<ProfileRecord["avatar"]>;

const PROFILE_RKEY = "self";
/** Redirect hops tolerated when fetching an avatar blob from a PDS. */
const MAX_AVATAR_REDIRECTS = 3;

const ALLOWED_AVATAR_MIME_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
]);

@Injectable()
export class ProfileService {
	private readonly logger = new Logger(ProfileService.name);
	private readonly idResolver = new IdResolver();
	private readonly isProduction: boolean;

	constructor(
		private readonly prisma: PrismaService,
		private readonly configService: ConfigService,
	) {
		this.isProduction =
			this.configService.get<string>("NODE_ENV") === "production";
	}

	async seedProfileForNewUser(
		userDid: string,
		session: ATSession,
		seed: {
			handle: string;
			displayName: string | null;
			avatarUrl: string | null;
		},
	): Promise<void> {
		const user = await this.prisma.user.findUnique({
			where: { did: userDid },
			select: { did: true, profileRkey: true },
		});

		if (!user) {
			throw new NotFoundException("User not found");
		}

		if (user.profileRkey) {
			return;
		}

		// The local DB row lacking profileRkey does NOT mean the account is new:
		// a fresh dev database against the shared PDS hits this path too, and
		// blindly putting a seed record here wiped a real profile's avatar once.
		// If the PDS already has a profile record, index it instead of writing.
		const existing = await this.getProfileRecord(session);
		if (existing) {
			await this.indexProfileRecord(
				userDid,
				PROFILE_RKEY,
				existing.cid,
				existing.uri,
				existing.record,
			);
			return;
		}

		let avatarBlob: ProfileRecord["avatar"] | undefined;
		if (seed.avatarUrl) {
			try {
				const imported = await this.fetchExternalAvatar(seed.avatarUrl);
				avatarBlob = await this.uploadBlob(session, imported);
			} catch (error) {
				this.logger.warn(
					`Failed to seed avatar for ${userDid}; continuing without avatar`,
					error instanceof Error ? error.stack : undefined,
				);
			}
		}

		const record = this.buildProfileRecord({
			displayName:
				normalizeDisplayName(seed.displayName) ??
				getHandleDisplayName(seed.handle),
			avatar: avatarBlob ?? null,
		});
		const response = await this.putProfileRecord(session, record);
		await this.indexProfileRecord(
			userDid,
			PROFILE_RKEY,
			response.data.cid ?? null,
			response.data.uri,
			record,
		);
	}

	async updateProfile(
		userDid: string,
		session: ATSession,
		input: {
			displayName?: string;
			avatar?: UploadableImage;
			clearAvatar?: boolean;
		},
	): Promise<ProfileIndexResult> {
		const user = await this.prisma.user.findUnique({
			where: { did: userDid },
			select: {
				did: true,
				displayName: true,
				avatar: true,
			},
		});

		if (!user) {
			throw new NotFoundException("User not found");
		}

		const existing = await this.getProfileRecord(session);
		const avatarBlob =
			input.avatar !== undefined
				? await this.uploadBlob(session, input.avatar)
				: undefined;
		const record = this.buildProfileRecord({
			existingRecord: existing?.record,
			displayName:
				input.displayName !== undefined
					? normalizeDisplayName(input.displayName)
					: undefined,
			avatar:
				avatarBlob !== undefined
					? avatarBlob
					: input.clearAvatar
						? null
						: undefined,
		});
		const response = await this.putProfileRecord(session, record);
		const indexed = await this.indexProfileRecord(
			userDid,
			PROFILE_RKEY,
			response.data.cid ?? null,
			response.data.uri,
			record,
		);

		return (
			indexed ?? {
				displayName: user.displayName,
				avatar: rebaseAvatarUrl(user.avatar),
			}
		);
	}

	async deleteAvatar(
		userDid: string,
		session: ATSession,
	): Promise<ProfileIndexResult> {
		return this.updateProfile(userDid, session, { clearAvatar: true });
	}

	async streamAvatar(
		did: string,
		cid: string,
		response: Response,
	): Promise<void> {
		if (!did || !cid) {
			throw new BadRequestException("did and cid are required");
		}

		const user = await this.prisma.user.findUnique({
			where: { did },
			select: {
				profileAvatarCid: true,
				profileAvatarMimeType: true,
			},
		});

		if (!user || user.profileAvatarCid !== cid) {
			throw new NotFoundException("Avatar not found");
		}

		// The stored mime type is copied from the user's own profile record.
		// Only ever serve the image types we accept on upload, so this origin
		// cannot be made to return HTML or scripts.
		const storedMimeType = user.profileAvatarMimeType
			? normalizeMimeType(user.profileAvatarMimeType)
			: null;
		if (
			storedMimeType !== null &&
			!ALLOWED_AVATAR_MIME_TYPES.has(storedMimeType)
		) {
			this.logger.warn(
				`Refusing to serve avatar for ${did}: stored mime type "${storedMimeType}" is not allowed`,
			);
			throw new NotFoundException("Avatar not found");
		}

		// The PDS host comes from the user's DID document, which a did:web
		// user fully controls. safeFetch refuses private or internal hosts,
		// whether named directly, reached through a redirect, or hidden
		// behind a public hostname that resolves to a private address.
		const { pds } = await this.idResolver.did.resolveAtprotoData(did);
		const url = new URL("/xrpc/com.atproto.sync.getBlob", pds);
		url.searchParams.set("did", did);
		url.searchParams.set("cid", cid);

		let avatarResponse: UpstreamResponse;
		try {
			avatarResponse = await safeFetch(url, {
				allowHttp: !this.isProduction,
				maxRedirects: MAX_AVATAR_REDIRECTS,
				signal: AbortSignal.timeout(10_000),
			});
		} catch (error) {
			this.logger.warn(
				`Refusing to load avatar for ${did} from PDS "${pds}": ${describeFetchError(error)}`,
			);
			throw new BadGatewayException("Failed to load avatar from PDS");
		}
		if (!avatarResponse.ok) {
			await discardBody(avatarResponse);
			if (avatarResponse.status === 404) {
				throw new NotFoundException("Avatar blob not found");
			}
			throw new BadGatewayException("Failed to load avatar from PDS");
		}

		const declaredLength = Number(
			avatarResponse.headers.get("content-length") ?? 0,
		);
		if (declaredLength > MAX_AVATAR_BYTES) {
			await discardBody(avatarResponse);
			this.logger.warn(
				`Refusing to serve avatar for ${did}: declared size ${declaredLength} exceeds ${MAX_AVATAR_BYTES} bytes`,
			);
			throw new BadGatewayException("Avatar blob exceeds size limit");
		}

		const mimeType =
			storedMimeType ??
			normalizeMimeType(avatarResponse.headers.get("content-type") ?? "");
		if (!ALLOWED_AVATAR_MIME_TYPES.has(mimeType)) {
			await discardBody(avatarResponse);
			this.logger.warn(
				`Refusing to serve avatar for ${did}: upstream mime type "${mimeType}" is not allowed`,
			);
			throw new NotFoundException("Avatar not found");
		}

		const buffer = await readBodyWithLimit(avatarResponse, MAX_AVATAR_BYTES);
		if (!buffer) {
			this.logger.warn(
				`Refusing to serve avatar for ${did}: body exceeds ${MAX_AVATAR_BYTES} bytes`,
			);
			throw new BadGatewayException("Avatar blob exceeds size limit");
		}

		// Public image embedded by the web app on another origin — helmet's
		// default same-origin CORP makes browsers block it otherwise.
		response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
		response.setHeader("Content-Type", mimeType);
		response.setHeader("Content-Length", buffer.byteLength.toString());
		response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
		response.end(buffer);
	}

	async indexProfileRecord(
		userDid: string,
		rkey: string,
		cid: string | null,
		uri: string,
		record: ProfileRecord,
	): Promise<ProfileIndexResult | null> {
		const normalizedDisplayName = normalizeDisplayName(record.displayName);
		// A blob outside the accepted image types is not an avatar: index the
		// profile without one instead of storing a type we would refuse to serve.
		const avatarMimeType = getBlobMimeType(record.avatar);
		const avatarCid = avatarMimeType ? getBlobCid(record.avatar) : null;
		if (record.avatar && !avatarMimeType) {
			this.logger.warn(
				`Ignoring avatar with disallowed mime type for ${userDid}`,
			);
		}

		try {
			const updated = await this.prisma.user.update({
				where: { did: userDid },
				data: {
					profileRkey: rkey,
					profileUri: uri,
					profileCid: cid,
					profileDisplayName: normalizedDisplayName,
					profileAvatarCid: avatarCid,
					profileAvatarMimeType: avatarMimeType,
					profileUpdatedAt: new Date(record.updatedAt),
					displayName: normalizedDisplayName,
					avatar: avatarCid ? buildAvatarUrl(userDid, avatarCid) : null,
				},
				select: {
					displayName: true,
					avatar: true,
				},
			});

			return {
				displayName: updated.displayName,
				avatar: updated.avatar,
			};
		} catch (error) {
			this.logger.warn(
				`Failed to index profile record for ${userDid}`,
				error instanceof Error ? error.stack : undefined,
			);
			return null;
		}
	}

	async deleteProfileRecordIndex(userDid: string): Promise<void> {
		await this.prisma.user.update({
			where: { did: userDid },
			data: {
				profileRkey: null,
				profileUri: null,
				profileCid: null,
				profileDisplayName: null,
				profileAvatarCid: null,
				profileAvatarMimeType: null,
				profileUpdatedAt: null,
				displayName: null,
				avatar: null,
			},
		});
	}

	private async getProfileRecord(
		session: ATSession,
	): Promise<StoredProfileRecord | null> {
		const agent = this.getAgent(session);
		try {
			const response = await agent.com.atproto.repo.getRecord({
				repo: session.did,
				collection: PROFILE_COLLECTION,
				rkey: PROFILE_RKEY,
			});
			const recordValue = normalizeProfileRecordValue(response.data.value);
			return {
				record: profileSchema.parse(recordValue),
				uri: response.data.uri,
				cid: response.data.cid ?? null,
			};
		} catch (error) {
			if (isRecordMissingError(error)) {
				return null;
			}
			throw error;
		}
	}

	private buildProfileRecord(input: {
		existingRecord?: ProfileRecord;
		displayName?: string | null;
		avatar?: ProfileRecord["avatar"] | null;
	}): ProfileRecord {
		const createdAt =
			input.existingRecord?.createdAt ?? new Date().toISOString();
		const updatedAt = new Date().toISOString();
		const nextDisplayName =
			input.displayName !== undefined
				? input.displayName
				: normalizeDisplayName(input.existingRecord?.displayName);
		const nextAvatar =
			input.avatar !== undefined ? input.avatar : input.existingRecord?.avatar;

		const record: ProfileRecord = {
			$type: "xyz.opnshelf.profile",
			createdAt,
			updatedAt,
		};

		if (nextDisplayName) {
			record.displayName = nextDisplayName;
		}

		if (nextAvatar) {
			record.avatar = nextAvatar;
		}

		return record;
	}

	private async putProfileRecord(session: ATSession, record: ProfileRecord) {
		const agent = this.getAgent(session);
		return agent.com.atproto.repo.putRecord({
			repo: session.did,
			collection: PROFILE_COLLECTION,
			rkey: PROFILE_RKEY,
			record: serializeProfileRecord(record),
			validate: false,
		});
	}

	private async uploadBlob(
		session: ATSession,
		image: UploadableImage,
	): Promise<ProfileRecord["avatar"]> {
		const mimeType = normalizeMimeType(image.mimetype);
		if (!ALLOWED_AVATAR_MIME_TYPES.has(mimeType)) {
			throw new UnsupportedMediaTypeException("Unsupported avatar image type");
		}
		if (image.size > MAX_AVATAR_BYTES) {
			throw new PayloadTooLargeException("Avatar image exceeds 5 MB");
		}

		const agent = this.getAgent(session);
		const upload = await agent.uploadBlob(image.buffer, {
			encoding: mimeType,
		});
		const blob = normalizeProfileBlob(upload.data.blob);
		if (!blob) {
			throw new BadGatewayException("Failed to normalize uploaded avatar blob");
		}
		return blob;
	}

	private async fetchExternalAvatar(url: string): Promise<UploadableImage> {
		const response = await safeFetch(url, {
			allowHttp: !this.isProduction,
			signal: AbortSignal.timeout(10_000),
		});
		if (!response.ok) {
			throw new BadGatewayException("Failed to fetch Bluesky avatar");
		}

		const mimeType = normalizeMimeType(
			response.headers.get("content-type") ?? "",
		);
		if (!ALLOWED_AVATAR_MIME_TYPES.has(mimeType)) {
			throw new UnsupportedMediaTypeException(
				"Unsupported seeded avatar image type",
			);
		}

		const buffer = await readBodyWithLimit(response, MAX_AVATAR_BYTES);
		if (!buffer) {
			throw new PayloadTooLargeException("Seeded avatar image exceeds 5 MB");
		}

		return {
			buffer,
			mimetype: mimeType,
			size: buffer.byteLength,
		};
	}

	async discoverSocialProfiles(did: string, handle: string): Promise<void> {
		let blueskyUrl: string | null = null;
		let tangledUrl: string | null = null;

		try {
			const { pds } = await this.idResolver.did.resolveAtprotoData(did);

			try {
				const record = await this.fetchPdsRecord(
					pds,
					did,
					"app.bsky.actor.profile",
					"self",
				);
				if (record) {
					blueskyUrl = `https://bsky.app/profile/${handle}`;
				}
			} catch (error) {
				this.logger.debug(
					`No Bluesky profile record found for ${did}`,
					error instanceof Error ? error.message : undefined,
				);
			}

			try {
				const record = await this.fetchPdsRecord(
					pds,
					did,
					"sh.tangled.actor.profile",
					"self",
				);
				if (record && typeof record === "object") {
					const preferredHandle =
						"preferredHandle" in record &&
						typeof record.preferredHandle === "string" &&
						record.preferredHandle.length > 0
							? record.preferredHandle
							: handle;
					tangledUrl = `https://tangled.org/${preferredHandle}`;
				}
			} catch (error) {
				this.logger.debug(
					`No Tangled profile record found for ${did}`,
					error instanceof Error ? error.message : undefined,
				);
			}
		} catch (error) {
			this.logger.warn(
				`Failed to resolve PDS for social profile discovery: ${did}`,
				error instanceof Error ? error.message : undefined,
			);
		}

		try {
			await this.prisma.user.update({
				where: { did },
				data: {
					blueskyProfileUrl: blueskyUrl,
					tangledProfileUrl: tangledUrl,
				},
			});
		} catch (error) {
			this.logger.warn(
				`Failed to update social profile URLs for ${did}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	private async fetchPdsRecord(
		pds: string,
		did: string,
		collection: string,
		rkey: string,
	): Promise<unknown | null> {
		const url = new URL("/xrpc/com.atproto.repo.getRecord", pds);
		url.searchParams.set("repo", did);
		url.searchParams.set("collection", collection);
		url.searchParams.set("rkey", rkey);

		// Same PDS-from-DID-document trust boundary as streamAvatar. A blocked
		// host throws, which the caller treats as "no record".
		const response = await safeFetch(url, {
			allowHttp: !this.isProduction,
			signal: AbortSignal.timeout(5000),
		});

		if (!response.ok) {
			if (response.status === 400 || response.status === 404) {
				return null;
			}
			throw new Error(`PDS returned ${response.status}`);
		}

		const body = await readBodyWithLimit(response, 1_000_000);
		if (!body) throw new PayloadTooLargeException("PDS record is too large");
		const data = JSON.parse(body.toString("utf8")) as { value?: unknown };
		return data.value ?? null;
	}

	private getAgent(session: ATSession): Agent {
		return new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);
	}
}

function normalizeDisplayName(
	displayName: string | null | undefined,
): string | null {
	if (typeof displayName !== "string") {
		return null;
	}

	const trimmed = displayName.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function getHandleDisplayName(
	handle: string | null | undefined,
): string | null {
	if (typeof handle !== "string") {
		return null;
	}

	const trimmed = handle.trim();
	if (trimmed.length === 0) {
		return null;
	}

	const [localPart] = trimmed.split(".");
	return localPart && localPart.length > 0 ? localPart : trimmed;
}

function normalizeMimeType(mimeType: string): string {
	const normalized = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
	if (normalized === "image/jpg") {
		return "image/jpeg";
	}
	return normalized;
}

function getBlobCid(blob: unknown): string | null {
	if (!blob || typeof blob !== "object" || !("ref" in blob)) {
		return null;
	}

	const ref = (blob as { ref?: { toString?: () => string } }).ref;
	return typeof ref?.toString === "function" ? ref.toString() : null;
}

function getBlobMimeType(blob: unknown): string | null {
	if (!blob || typeof blob !== "object" || !("mimeType" in blob)) {
		return null;
	}

	const mimeType = (blob as { mimeType?: unknown }).mimeType;
	if (typeof mimeType !== "string") {
		return null;
	}

	const normalized = normalizeMimeType(mimeType);
	return ALLOWED_AVATAR_MIME_TYPES.has(normalized) ? normalized : null;
}

/**
 * Buffers a fetch body up to `limit` bytes. Returns `null` and cancels the
 * stream as soon as the body exceeds the limit, so an oversized upstream
 * response is never held in memory.
 */
async function readBodyWithLimit(
	upstream: UpstreamResponse,
	limit: number,
): Promise<Buffer | null> {
	if (!upstream.body) {
		return Buffer.alloc(0);
	}

	const chunks: Uint8Array[] = [];
	let total = 0;
	for await (const chunk of upstream.body) {
		total += chunk.byteLength;
		if (total > limit) {
			// Leaving the loop early calls the iterator's return(), which
			// cancels the underlying stream.
			return null;
		}
		chunks.push(chunk);
	}

	return Buffer.concat(chunks);
}

async function discardBody(upstream: UpstreamResponse): Promise<void> {
	try {
		await upstream.body?.cancel();
	} catch {
		// Nothing to release if the stream is already closed.
	}
}

/**
 * A log line for a failed upstream fetch. safeFetch's own errors already say
 * why; undici wraps transport failures (including a blocked resolved address)
 * in "fetch failed" with the real reason as `cause`.
 */
function describeFetchError(error: unknown): string {
	if (error instanceof SafeFetchError) {
		return error.message;
	}
	if (error instanceof Error) {
		const cause = error.cause;
		return cause instanceof Error
			? `${error.message} (${cause.message})`
			: error.message;
	}
	return String(error);
}

function serializeProfileRecord(record: ProfileRecord): ProfileRecord {
	const normalizedRecord = normalizeProfileRecordValue(record);
	if (!normalizedRecord) {
		return record;
	}

	return normalizedRecord;
}

function normalizeProfileRecordValue(value: unknown): ProfileRecord | null {
	if (!value || typeof value !== "object") {
		return null;
	}

	if (!("avatar" in value)) {
		return value as ProfileRecord;
	}

	const normalizedAvatar = normalizeProfileBlob(
		(value as { avatar?: unknown }).avatar,
	);
	if (normalizedAvatar === undefined) {
		return value as ProfileRecord;
	}

	const nextRecord = { ...(value as ProfileRecord) };
	if (normalizedAvatar === null) {
		delete (nextRecord as { avatar?: unknown }).avatar;
		return nextRecord;
	}

	return {
		...nextRecord,
		avatar: normalizedAvatar,
	};
}

function normalizeProfileBlob(
	blob: unknown,
): ProfileRecord["avatar"] | null | undefined {
	if (blob === undefined || blob === null || typeof blob !== "object") {
		return blob as ProfileRecord["avatar"] | null | undefined;
	}

	const source =
		"original" in blob && blob.original && typeof blob.original === "object"
			? blob.original
			: blob;
	const normalized = toPlainProfileBlob(source);

	return normalized ?? (blob as ProfileRecord["avatar"]);
}

function toPlainProfileBlob(blob: object): PlainProfileBlob | null {
	const candidate = blob as {
		$type?: unknown;
		ref?: unknown;
		mimeType?: unknown;
		size?: unknown;
	};

	if (
		candidate.$type !== "blob" ||
		!("ref" in candidate) ||
		typeof candidate.mimeType !== "string" ||
		typeof candidate.size !== "number"
	) {
		return null;
	}

	return {
		$type: "blob",
		ref: candidate.ref as PlainProfileBlob["ref"],
		mimeType: candidate.mimeType,
		size: candidate.size,
	};
}

function isRecordMissingError(error: unknown): boolean {
	if (!error || typeof error !== "object") {
		return false;
	}

	const candidate = error as {
		error?: string;
		status?: number;
		message?: string;
	};

	return (
		candidate.status === 400 ||
		candidate.status === 404 ||
		candidate.error === "RecordNotFound" ||
		candidate.message?.includes("RecordNotFound") === true
	);
}
