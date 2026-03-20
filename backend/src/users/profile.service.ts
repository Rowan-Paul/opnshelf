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
import {
	$nsid as PROFILE_COLLECTION,
	main as profileSchema,
} from "../lexicons/xyz/opnshelf/profile.defs";
import type { Main as ProfileRecord } from "../lexicons/xyz/opnshelf/profile.defs";
import { PrismaService } from "../prisma/prisma.service";
import type { UserProfileDto } from "./dto/user-settings.dto";

export interface ATSession {
	did: string;
}

type UploadableImage = {
	buffer: Buffer;
	mimetype: string;
	size: number;
};

type ResolvedProfile = {
	displayName: string | null;
	avatar: string | null;
};

type StoredProfileRecord = {
	record: ProfileRecord;
	uri: string;
	cid: string | null;
};

const PROFILE_RKEY = "self";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_MIME_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
]);

@Injectable()
export class ProfileService {
	private readonly logger = new Logger(ProfileService.name);
	private readonly idResolver = new IdResolver();

	constructor(
		private readonly prisma: PrismaService,
		private readonly configService: ConfigService,
	) {}

	async seedProfileForNewUser(
		userDid: string,
		session: ATSession,
		seed: {
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
			displayName: normalizeDisplayName(seed.displayName),
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
	): Promise<UserProfileDto> {
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

		return indexed ?? { displayName: user.displayName, avatar: user.avatar };
	}

	async deleteAvatar(
		userDid: string,
		session: ATSession,
	): Promise<UserProfileDto> {
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

		const { pds } = await this.idResolver.did.resolveAtprotoData(did);
		const url = new URL("/xrpc/com.atproto.sync.getBlob", pds);
		url.searchParams.set("did", did);
		url.searchParams.set("cid", cid);

		const avatarResponse = await fetch(url.toString(), {
			signal: AbortSignal.timeout(10_000),
		});
		if (!avatarResponse.ok) {
			if (avatarResponse.status === 404) {
				throw new NotFoundException("Avatar blob not found");
			}
			throw new BadGatewayException("Failed to load avatar from PDS");
		}

		const buffer = Buffer.from(await avatarResponse.arrayBuffer());
		response.setHeader(
			"Content-Type",
			user.profileAvatarMimeType ??
				avatarResponse.headers.get("content-type") ??
				"application/octet-stream",
		);
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
	): Promise<UserProfileDto | null> {
		const normalizedDisplayName = normalizeDisplayName(record.displayName);
		const avatarCid = getBlobCid(record.avatar);
		const avatarMimeType = getBlobMimeType(record.avatar);

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
					avatar: avatarCid ? this.buildAvatarUrl(userDid, avatarCid) : null,
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

	buildAvatarUrl(did: string, cid: string): string {
		const baseUrl =
			this.configService.get<string>("BACKEND_PUBLIC_URL") ??
			this.configService.get<string>("BACKEND_URL") ??
			"http://127.0.0.1:3001";
		const url = new URL("/users/avatar", baseUrl);
		url.searchParams.set("did", did);
		url.searchParams.set("cid", cid);
		return url.toString();
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
			return {
				record: profileSchema.parse(response.data.value),
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

		return profileSchema.build({
			createdAt,
			updatedAt,
			...(nextDisplayName ? { displayName: nextDisplayName } : {}),
			...(nextAvatar ? { avatar: nextAvatar } : {}),
		});
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
		return upload.data.blob.original as unknown as ProfileRecord["avatar"];
	}

	private async fetchExternalAvatar(url: string): Promise<UploadableImage> {
		const response = await fetch(url, {
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

		const buffer = Buffer.from(await response.arrayBuffer());
		if (buffer.byteLength > MAX_AVATAR_BYTES) {
			throw new PayloadTooLargeException("Seeded avatar image exceeds 5 MB");
		}

		return {
			buffer,
			mimetype: mimeType,
			size: buffer.byteLength,
		};
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
	return typeof mimeType === "string" ? mimeType : null;
}

function serializeProfileRecord(record: ProfileRecord): ProfileRecord {
	if (!record.avatar) {
		return record;
	}

	return {
		...record,
		avatar: serializeBlobRef(record.avatar),
	};
}

function serializeBlobRef(
	blob: ProfileRecord["avatar"],
): ProfileRecord["avatar"] {
	if (!blob || typeof blob !== "object") {
		return blob;
	}

	if ("original" in blob && blob.original) {
		return blob.original as unknown as ProfileRecord["avatar"];
	}

	return blob;
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
