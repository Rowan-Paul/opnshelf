import { BlobRef } from "@atproto/api";
import { ConfigService } from "@nestjs/config";

const mockUploadBlob = jest.fn();
const mockPutRecord = jest.fn();
const mockGetRecord = jest.fn();
const mockResolveAtprotoData = jest.fn();

jest.mock("@atproto/api", () => {
	const actual = jest.requireActual("@atproto/api");

	return {
		...actual,
		Agent: jest.fn().mockImplementation(() => ({
			uploadBlob: mockUploadBlob,
			com: {
				atproto: {
					repo: {
						getRecord: mockGetRecord,
						putRecord: mockPutRecord,
					},
				},
			},
		})),
	};
});

jest.mock("@atproto/identity", () => ({
	IdResolver: jest.fn().mockImplementation(() => ({
		did: {
			resolveAtprotoData: mockResolveAtprotoData,
		},
	})),
}));

import type { Main as ProfileRecord } from "../lexicons/xyz/opnshelf/profile.defs";
import type { PrismaService } from "../prisma/prisma.service";
import { ProfileService, type ATSession } from "./profile.service";

type StoredProfileRecord = {
	record: ProfileRecord;
	uri: string;
	cid: string | null;
};

type PutRecordResponse = {
	data: {
		cid: string | null;
		uri: string;
	};
};

type ProfileServiceHarness = {
	getProfileRecord(session: ATSession): Promise<StoredProfileRecord | null>;
	putProfileRecord(
		session: ATSession,
		record: ProfileRecord,
	): Promise<PutRecordResponse>;
};

describe("ProfileService", () => {
	let service: ProfileService;

	const prisma = {
		user: {
			findUnique: jest.fn(),
			update: jest.fn(),
		},
	};

	const configService = {
		get: jest.fn((key: string) => {
			if (key === "BACKEND_PUBLIC_URL") {
				return "https://backend.example";
			}
			return undefined;
		}),
	};

	const session: ATSession = {
		did: "did:plc:alice",
	};

	beforeEach(() => {
		jest.clearAllMocks();
		service = new ProfileService(
			prisma as unknown as PrismaService,
			configService as unknown as ConfigService,
		);
		mockPutRecord.mockResolvedValue({
			data: {
				cid: "bafyrecordcid",
				uri: "at://did:plc:alice/xyz.opnshelf.profile/self",
			},
		});
		mockGetRecord.mockResolvedValue({
			data: {
				value: null,
				uri: "at://did:plc:alice/xyz.opnshelf.profile/self",
				cid: "bafyrecordcid",
			},
		});
	});

	it("rebuilds an existing BlobRef avatar when updating only display name", async () => {
		const avatar = await createAvatarBlob();
		const blobRef = new BlobRef(
			avatar.ref,
			avatar.mimeType,
			avatar.size,
			avatar as never,
		);
		const existingRecord = createProfileRecord({
			displayName: "Old Name",
			avatar: blobRef as unknown as ProfileRecord["avatar"],
		});
		const serviceInternals = service as unknown as ProfileServiceHarness;
		const putRecordMock = jest
			.fn<Promise<PutRecordResponse>, [ATSession, ProfileRecord]>()
			.mockResolvedValue({
				data: {
					cid: "bafyupdatedcid",
					uri: "at://did:plc:alice/xyz.opnshelf.profile/self",
				},
			});

		prisma.user.findUnique.mockResolvedValue({
			did: session.did,
			displayName: "Old Name",
			avatar:
				"https://backend.example/users/avatar?did=did%3Aplc%3Aalice&cid=bafyoldcid",
		});
		prisma.user.update.mockResolvedValue({
			displayName: "New Name",
			avatar:
				"https://backend.example/users/avatar?did=did%3Aplc%3Aalice&cid=bafyavatarcid",
		});
		serviceInternals.getProfileRecord = jest
			.fn<Promise<StoredProfileRecord | null>, [ATSession]>()
			.mockResolvedValue(createStoredProfileRecord(existingRecord));
		serviceInternals.putProfileRecord = putRecordMock;

		await expect(
			service.updateProfile(session.did, session, {
				displayName: "New Name",
			}),
		).resolves.toEqual({
			displayName: "New Name",
			avatar:
				"https://backend.example/users/avatar?did=did%3Aplc%3Aalice&cid=bafyavatarcid",
		});

		const [, record] = putRecordMock.mock.calls[0];
		expect(record.avatar).toEqual(avatar);
		expect(record.avatar).not.toBeInstanceOf(BlobRef);
	});

	it("seeds a fallback display name from the handle when none exists", async () => {
		prisma.user.findUnique.mockResolvedValue({
			did: session.did,
			profileRkey: null,
		});
		prisma.user.update.mockResolvedValue({
			displayName: "rowanpaul",
			avatar: null,
		});

		await expect(
			service.seedProfileForNewUser(session.did, session, {
				handle: "rowanpaul.opnshelf.social",
				displayName: null,
				avatarUrl: null,
			}),
		).resolves.toBeUndefined();

		expect(mockPutRecord).toHaveBeenCalledWith(
			expect.objectContaining({
				record: expect.objectContaining({
					displayName: "rowanpaul",
				}),
			}),
		);
		expect(prisma.user.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					displayName: "rowanpaul",
					profileDisplayName: "rowanpaul",
				}),
			}),
		);
	});

	it("preserves an explicit seeded display name", async () => {
		prisma.user.findUnique.mockResolvedValue({
			did: session.did,
			profileRkey: null,
		});
		prisma.user.update.mockResolvedValue({
			displayName: "Rowan Paul",
			avatar: null,
		});

		await expect(
			service.seedProfileForNewUser(session.did, session, {
				handle: "rowanpaul.opnshelf.social",
				displayName: "Rowan Paul",
				avatarUrl: null,
			}),
		).resolves.toBeUndefined();

		expect(mockPutRecord).toHaveBeenCalledWith(
			expect.objectContaining({
				record: expect.objectContaining({
					displayName: "Rowan Paul",
				}),
			}),
		);
		expect(prisma.user.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					displayName: "Rowan Paul",
					profileDisplayName: "Rowan Paul",
				}),
			}),
		);
	});

	it("normalizes BlobRef avatars returned by getRecord before parsing", async () => {
		const avatar = await createAvatarBlob();
		const blobRef = new BlobRef(
			avatar.ref,
			avatar.mimeType,
			avatar.size,
			avatar as never,
		);

		prisma.user.findUnique.mockResolvedValue({
			did: session.did,
			displayName: "Old Name",
			avatar:
				"https://backend.example/users/avatar?did=did%3Aplc%3Aalice&cid=bafyoldcid",
		});
		prisma.user.update.mockResolvedValue({
			displayName: "Old Name",
			avatar: null,
		});
		mockGetRecord.mockResolvedValue({
			data: {
				value: {
					$type: "xyz.opnshelf.profile",
					displayName: "Old Name",
					avatar: blobRef,
					createdAt: "2026-03-20T20:00:00.000Z",
					updatedAt: "2026-03-20T20:00:00.000Z",
				},
				uri: "at://did:plc:alice/xyz.opnshelf.profile/self",
				cid: "bafyrecordcid",
			},
		});

		await expect(service.deleteAvatar(session.did, session)).resolves.toEqual({
			displayName: "Old Name",
			avatar: null,
		});

		expect(mockGetRecord).toHaveBeenCalledWith({
			repo: session.did,
			collection: "xyz.opnshelf.profile",
			rkey: "self",
		});
		expect(mockPutRecord).toHaveBeenCalledWith(
			expect.objectContaining({
				record: expect.not.objectContaining({
					avatar: expect.any(BlobRef),
				}),
			}),
		);
	});

	it("clears an existing BlobRef avatar without reusing the wrapped instance", async () => {
		const avatar = await createAvatarBlob();
		const blobRef = new BlobRef(
			avatar.ref,
			avatar.mimeType,
			avatar.size,
			avatar as never,
		);
		const existingRecord = createProfileRecord({
			displayName: "Old Name",
			avatar: blobRef as unknown as ProfileRecord["avatar"],
		});
		const serviceInternals = service as unknown as ProfileServiceHarness;
		const putRecordMock = jest
			.fn<Promise<PutRecordResponse>, [ATSession, ProfileRecord]>()
			.mockResolvedValue({
				data: {
					cid: "bafyclearedcid",
					uri: "at://did:plc:alice/xyz.opnshelf.profile/self",
				},
			});

		prisma.user.findUnique.mockResolvedValue({
			did: session.did,
			displayName: "Old Name",
			avatar:
				"https://backend.example/users/avatar?did=did%3Aplc%3Aalice&cid=bafyoldcid",
		});
		prisma.user.update.mockResolvedValue({
			displayName: "Old Name",
			avatar: null,
		});
		serviceInternals.getProfileRecord = jest
			.fn<Promise<StoredProfileRecord | null>, [ATSession]>()
			.mockResolvedValue(createStoredProfileRecord(existingRecord));
		serviceInternals.putProfileRecord = putRecordMock;

		await expect(service.deleteAvatar(session.did, session)).resolves.toEqual({
			displayName: "Old Name",
			avatar: null,
		});

		const [, record] = putRecordMock.mock.calls[0];
		expect(record).not.toHaveProperty("avatar");
	});

	it("normalizes uploaded BlobRef instances before writing the record", async () => {
		const avatar = await createAvatarBlob();
		const blobRef = new BlobRef(
			avatar.ref,
			avatar.mimeType,
			avatar.size,
			avatar as never,
		);

		prisma.user.findUnique.mockResolvedValue({
			did: session.did,
			displayName: "Alice",
			avatar: null,
		});
		prisma.user.update.mockResolvedValue({
			displayName: "Alice",
			avatar:
				"https://backend.example/users/avatar?did=did%3Aplc%3Aalice&cid=bafyavatarcid",
		});
		mockUploadBlob.mockResolvedValue({
			data: {
				blob: blobRef,
			},
		});

		const serviceInternals = service as unknown as ProfileServiceHarness;
		serviceInternals.getProfileRecord = jest
			.fn<Promise<StoredProfileRecord | null>, [ATSession]>()
			.mockResolvedValue(null);

		await expect(
			service.updateProfile(session.did, session, {
				avatar: {
					buffer: Buffer.from("avatar"),
					mimetype: "image/png",
					size: 6,
				},
			}),
		).resolves.toEqual({
			displayName: "Alice",
			avatar:
				"https://backend.example/users/avatar?did=did%3Aplc%3Aalice&cid=bafyavatarcid",
		});

		expect(mockUploadBlob).toHaveBeenCalledWith(Buffer.from("avatar"), {
			encoding: "image/png",
		});
		expect(mockPutRecord).toHaveBeenCalledWith(
			expect.objectContaining({
				repo: session.did,
				record: expect.objectContaining({
					avatar,
				}),
				validate: false,
			}),
		);
		const putRecordInput = mockPutRecord.mock.calls[0][0];
		expect(putRecordInput.record.avatar).not.toBeInstanceOf(BlobRef);
		expect(Object.keys(putRecordInput.record.avatar)).toEqual([
			"$type",
			"ref",
			"mimeType",
			"size",
		]);
	});

	it("keeps plain blob avatars stable across display-name-only updates", async () => {
		const avatar = await createAvatarBlob();
		const existingRecord = createProfileRecord({
			displayName: "Old Name",
			avatar,
		});
		const serviceInternals = service as unknown as ProfileServiceHarness;
		const putRecordMock = jest
			.fn<Promise<PutRecordResponse>, [ATSession, ProfileRecord]>()
			.mockResolvedValue({
				data: {
					cid: "bafyplaincid",
					uri: "at://did:plc:alice/xyz.opnshelf.profile/self",
				},
			});

		prisma.user.findUnique.mockResolvedValue({
			did: session.did,
			displayName: "Old Name",
			avatar:
				"https://backend.example/users/avatar?did=did%3Aplc%3Aalice&cid=bafyoldcid",
		});
		prisma.user.update.mockResolvedValue({
			displayName: "Still Plain",
			avatar:
				"https://backend.example/users/avatar?did=did%3Aplc%3Aalice&cid=bafyavatarcid",
		});
		serviceInternals.getProfileRecord = jest
			.fn<Promise<StoredProfileRecord | null>, [ATSession]>()
			.mockResolvedValue(createStoredProfileRecord(existingRecord));
		serviceInternals.putProfileRecord = putRecordMock;

		await expect(
			service.updateProfile(session.did, session, {
				displayName: "Still Plain",
			}),
		).resolves.toEqual({
			displayName: "Still Plain",
			avatar:
				"https://backend.example/users/avatar?did=did%3Aplc%3Aalice&cid=bafyavatarcid",
		});

		const [, record] = putRecordMock.mock.calls[0];
		expect(record.avatar).toEqual(avatar);
		expect(record.avatar).not.toHaveProperty("original");
	});
});

async function createAvatarBlob(): Promise<
	NonNullable<ProfileRecord["avatar"]>
> {
	const ref = parseRawCid(
		"bafkreic3jv6yqs3vhv3xp6b77q4b6o7j2g64bcyii4h7t6x7s5r5f4l2si",
	);

	return {
		$type: "blob",
		ref,
		mimeType: "image/png",
		size: 123,
	};
}

function createProfileRecord(input: {
	displayName?: string;
	avatar?: ProfileRecord["avatar"];
}): ProfileRecord {
	return {
		$type: "xyz.opnshelf.profile",
		createdAt: "2026-03-20T20:00:00.000Z",
		updatedAt: "2026-03-20T20:00:00.000Z",
		...(input.displayName ? { displayName: input.displayName } : {}),
		...(input.avatar ? { avatar: input.avatar } : {}),
	};
}

function createStoredProfileRecord(record: ProfileRecord): StoredProfileRecord {
	return {
		record,
		uri: "at://did:plc:alice/xyz.opnshelf.profile/self",
		cid: "bafyoldrecordcid",
	};
}

function parseRawCid(value: string) {
	const {
		CID,
	} = require("../../../node_modules/.pnpm/node_modules/multiformats/cjs/src/cid.js");
	return CID.parse(value);
}
