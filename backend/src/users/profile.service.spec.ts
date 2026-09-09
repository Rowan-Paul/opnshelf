import { BlobRef } from "@atproto/api";
import { BadGatewayException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MAX_AVATAR_BYTES } from "./avatar.constants";

const mockUploadBlob = vi.fn();
const mockPutRecord = vi.fn();
const mockGetRecord = vi.fn();
const mockResolveAtprotoData = vi.fn();

vi.mock("@atproto/api", async () => {
	const actual =
		await vi.importActual<typeof import("@atproto/api")>("@atproto/api");

	return {
		...actual,
		Agent: vi.fn().mockImplementation(() => ({
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

vi.mock("@atproto/identity", () => ({
	IdResolver: vi.fn().mockImplementation(() => ({
		did: {
			resolveAtprotoData: mockResolveAtprotoData,
		},
	})),
}));

// Keep the real safeFetch (URL checks, redirect following) but swap the
// transport underneath it, so these tests see every hop the service makes
// without touching the network or DNS.
const mockUpstreamFetch = vi.fn();
vi.mock("../common/safe-fetch", async () => {
	const actual = await vi.importActual<typeof import("../common/safe-fetch")>(
		"../common/safe-fetch",
	);
	return {
		...actual,
		safeFetch: actual.createSafeFetch({
			lookup: (_hostname, _options, callback) =>
				callback(null, [{ address: "93.184.216.34", family: 4 }]),
			fetch: (...args) => mockUpstreamFetch(...args),
		}),
	};
});

import { BlockedAddressError } from "../common/safe-fetch";
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
			findUnique: vi.fn(),
			update: vi.fn(),
		},
	};

	const configService = {
		get: vi.fn((key: string) => {
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
		vi.clearAllMocks();
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
		const putRecordMock = vi
			.fn<
				(
					session: ATSession,
					record: ProfileRecord,
				) => Promise<PutRecordResponse>
			>()
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
		serviceInternals.getProfileRecord = vi
			.fn<(session: ATSession) => Promise<StoredProfileRecord | null>>()
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
		expect(record.avatar).toMatchObject({
			mimeType: "image/png",
			size: 123,
		});
		expect(record.avatar?.ref.toString()).toBe(avatar.ref.toString());
	});

	it("seeds a fallback display name from the handle when none exists", async () => {
		mockGetRecord.mockRejectedValue({ status: 400, error: "RecordNotFound" });
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
		mockGetRecord.mockRejectedValue({ status: 400, error: "RecordNotFound" });
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

	it("does not overwrite an existing PDS profile record when seeding", async () => {
		prisma.user.findUnique.mockResolvedValue({
			did: session.did,
			profileRkey: null,
		});
		prisma.user.update.mockResolvedValue({
			displayName: "Existing Name",
			avatar: null,
		});
		mockGetRecord.mockResolvedValue({
			data: {
				value: {
					$type: "xyz.opnshelf.profile",
					displayName: "Existing Name",
					createdAt: "2026-03-20T20:00:00.000Z",
					updatedAt: "2026-03-20T20:00:00.000Z",
				},
				uri: "at://did:plc:alice/xyz.opnshelf.profile/self",
				cid: "bafyrecordcid",
			},
		});

		await expect(
			service.seedProfileForNewUser(session.did, session, {
				handle: "rowanpaul.opnshelf.social",
				displayName: null,
				avatarUrl: null,
			}),
		).resolves.toBeUndefined();

		expect(mockPutRecord).not.toHaveBeenCalled();
		expect(prisma.user.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					profileDisplayName: "Existing Name",
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
		const putRecordMock = vi
			.fn<
				(
					session: ATSession,
					record: ProfileRecord,
				) => Promise<PutRecordResponse>
			>()
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
		serviceInternals.getProfileRecord = vi
			.fn<(session: ATSession) => Promise<StoredProfileRecord | null>>()
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
		serviceInternals.getProfileRecord = vi
			.fn<(session: ATSession) => Promise<StoredProfileRecord | null>>()
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
		const putRecordMock = vi
			.fn<
				(
					session: ATSession,
					record: ProfileRecord,
				) => Promise<PutRecordResponse>
			>()
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
		serviceInternals.getProfileRecord = vi
			.fn<(session: ATSession) => Promise<StoredProfileRecord | null>>()
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
		expect(record.avatar).toMatchObject({
			mimeType: "image/png",
			size: 123,
		});
		expect(record.avatar?.ref.toString()).toBe(avatar.ref.toString());
		expect(record.avatar).not.toHaveProperty("original");
	});

	it("does not index an avatar whose mime type is outside the allowlist", async () => {
		const avatar = await createAvatarBlob();
		prisma.user.update.mockResolvedValue({
			displayName: "Alice",
			avatar: null,
		});

		await service.indexProfileRecord(
			session.did,
			"self",
			"bafyrecordcid",
			"at://did:plc:alice/xyz.opnshelf.profile/self",
			createProfileRecord({
				displayName: "Alice",
				avatar: { ...avatar, mimeType: "text/html" },
			}),
		);

		expect(prisma.user.update).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					profileAvatarCid: null,
					profileAvatarMimeType: null,
					avatar: null,
				}),
			}),
		);
	});

	describe("streamAvatar", () => {
		const cid = "bafyavatarcid";
		const fetchMock = mockUpstreamFetch;
		let res: {
			setHeader: ReturnType<typeof vi.fn>;
			end: ReturnType<typeof vi.fn>;
		};

		beforeEach(() => {
			fetchMock.mockReset();
			res = { setHeader: vi.fn(), end: vi.fn() };
			prisma.user.findUnique.mockResolvedValue({
				profileAvatarCid: cid,
				profileAvatarMimeType: "image/png",
			});
			mockResolveAtprotoData.mockResolvedValue({
				pds: "https://pds.example.com",
			});
		});

		function stream(): Promise<void> {
			return service.streamAvatar(
				session.did,
				cid,
				res as unknown as import("express").Response,
			);
		}

		it("serves an allowed image with the expected headers", async () => {
			const bytes = Buffer.from("png-bytes");
			fetchMock.mockResolvedValue(
				new Response(bytes, {
					status: 200,
					headers: { "content-type": "image/png" },
				}),
			);

			await expect(stream()).resolves.toBeUndefined();

			expect(fetchMock).toHaveBeenCalledWith(
				`https://pds.example.com/xrpc/com.atproto.sync.getBlob?did=did%3Aplc%3Aalice&cid=${cid}`,
				expect.anything(),
			);
			expect(res.setHeader).toHaveBeenCalledWith(
				"Cross-Origin-Resource-Policy",
				"cross-origin",
			);
			expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/png");
			expect(res.setHeader).toHaveBeenCalledWith(
				"Content-Length",
				String(bytes.byteLength),
			);
			expect(res.setHeader).toHaveBeenCalledWith(
				"Cache-Control",
				"public, max-age=31536000, immutable",
			);
			expect(res.end).toHaveBeenCalledWith(bytes);
		});

		it("follows a redirect to another public host and passes the manual redirect mode", async () => {
			const bytes = Buffer.from("png-bytes");
			fetchMock
				.mockResolvedValueOnce(
					new Response(null, {
						status: 302,
						headers: { location: "https://cdn.example.net/blob" },
					}),
				)
				.mockResolvedValueOnce(
					new Response(bytes, {
						status: 200,
						headers: { "content-type": "image/png" },
					}),
				);

			await expect(stream()).resolves.toBeUndefined();

			expect(fetchMock).toHaveBeenCalledTimes(2);
			expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
			expect(fetchMock.mock.calls[1][0]).toBe("https://cdn.example.net/blob");
			expect(res.end).toHaveBeenCalledWith(bytes);
		});

		it("refuses a redirect to a private host", async () => {
			fetchMock.mockResolvedValueOnce(
				new Response(null, {
					status: 302,
					headers: { location: "http://169.254.169.254/latest/meta-data" },
				}),
			);

			await expect(stream()).rejects.toBeInstanceOf(BadGatewayException);
			expect(fetchMock).toHaveBeenCalledTimes(1);
			expect(res.end).not.toHaveBeenCalled();
		});

		it("gives up after too many redirects", async () => {
			fetchMock.mockResolvedValue(
				new Response(null, {
					status: 307,
					headers: { location: "https://pds.example.com/again" },
				}),
			);

			await expect(stream()).rejects.toBeInstanceOf(BadGatewayException);
			expect(fetchMock).toHaveBeenCalledTimes(4);
			expect(res.end).not.toHaveBeenCalled();
		});

		it("answers 502 when the PDS hostname resolves to a private address", async () => {
			// What undici surfaces when the guarded lookup refuses the connection.
			fetchMock.mockRejectedValue(
				new TypeError("fetch failed", {
					cause: new BlockedAddressError("pds.example.com", "10.0.0.5"),
				}),
			);

			await expect(stream()).rejects.toBeInstanceOf(BadGatewayException);
			expect(fetchMock).toHaveBeenCalledTimes(1);
			expect(res.end).not.toHaveBeenCalled();
		});

		it("allows an http PDS outside production", async () => {
			mockResolveAtprotoData.mockResolvedValue({ pds: "http://pds.test:2583" });
			fetchMock.mockResolvedValue(
				new Response(Buffer.from("png"), {
					status: 200,
					headers: { "content-type": "image/png" },
				}),
			);

			await expect(stream()).resolves.toBeUndefined();
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});

		it("rejects an http PDS in production without fetching", async () => {
			const productionService = new ProfileService(
				prisma as unknown as PrismaService,
				{
					get: (key: string) => (key === "NODE_ENV" ? "production" : undefined),
				} as unknown as ConfigService,
			);
			mockResolveAtprotoData.mockResolvedValue({
				pds: "http://pds.example.com",
			});

			await expect(
				productionService.streamAvatar(
					session.did,
					cid,
					res as unknown as import("express").Response,
				),
			).rejects.toBeInstanceOf(BadGatewayException);
			expect(fetchMock).not.toHaveBeenCalled();
			expect(res.end).not.toHaveBeenCalled();
		});

		it.each([
			"https://10.0.0.5",
			"https://169.254.169.254",
			"https://backend.railway.internal",
			"https://[::1]:2583",
			"https://localhost:2583",
		])("rejects the private PDS host %s without fetching", async (pds) => {
			mockResolveAtprotoData.mockResolvedValue({ pds });

			await expect(stream()).rejects.toBeInstanceOf(BadGatewayException);
			expect(fetchMock).not.toHaveBeenCalled();
			expect(res.end).not.toHaveBeenCalled();
		});

		it("rejects a stored mime type outside the allowlist without fetching", async () => {
			prisma.user.findUnique.mockResolvedValue({
				profileAvatarCid: cid,
				profileAvatarMimeType: "text/html",
			});

			await expect(stream()).rejects.toBeInstanceOf(NotFoundException);
			expect(fetchMock).not.toHaveBeenCalled();
			expect(res.end).not.toHaveBeenCalled();
		});

		it("rejects an upstream mime type outside the allowlist when none is stored", async () => {
			prisma.user.findUnique.mockResolvedValue({
				profileAvatarCid: cid,
				profileAvatarMimeType: null,
			});
			fetchMock.mockResolvedValue(
				new Response("<script>alert(1)</script>", {
					status: 200,
					headers: { "content-type": "text/html" },
				}),
			);

			await expect(stream()).rejects.toBeInstanceOf(NotFoundException);
			expect(res.end).not.toHaveBeenCalled();
		});

		it("rejects a body whose declared content-length exceeds the cap", async () => {
			fetchMock.mockResolvedValue(
				new Response(Buffer.from("png"), {
					status: 200,
					headers: {
						"content-type": "image/png",
						"content-length": String(MAX_AVATAR_BYTES + 1),
					},
				}),
			);

			await expect(stream()).rejects.toBeInstanceOf(BadGatewayException);
			expect(res.end).not.toHaveBeenCalled();
		});

		it("stops reading a streamed body once it exceeds the cap", async () => {
			const chunk = new Uint8Array(1024 * 1024);
			let pulled = 0;
			const body = new ReadableStream<Uint8Array>({
				pull(controller) {
					pulled += 1;
					controller.enqueue(chunk);
				},
			});
			fetchMock.mockResolvedValue(
				new Response(body, {
					status: 200,
					headers: { "content-type": "image/png" },
				}),
			);

			await expect(stream()).rejects.toBeInstanceOf(BadGatewayException);
			expect(res.end).not.toHaveBeenCalled();
			// 5 MiB fit under the cap; the sixth chunk trips it. Allow a little
			// read-ahead but make sure the endless stream was not drained further.
			expect(pulled).toBeLessThanOrEqual(8);
		});
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
