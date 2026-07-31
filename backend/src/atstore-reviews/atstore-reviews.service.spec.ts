import { ConflictException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

const agentHarness = vi.hoisted(() => ({
	listRecords: vi.fn(),
	putRecord: vi.fn(),
}));

vi.mock("@atproto/api", () => ({
	Agent: vi.fn(() => ({
		com: { atproto: { repo: agentHarness } },
	})),
}));

vi.mock("@atproto/common", () => ({
	TID: { nextStr: vi.fn(() => "3mtesttid") },
}));

import { AtStoreReviewsService } from "./atstore-reviews.service";

const listingUri = "at://did:plc:store/fyi.atstore.listing.detail/3mopnshelf";
const did = "did:plc:alice";
const session = { did };

function mockFetchListing() {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ listing: { uri: listingUri } }),
		}),
	);
}

function createPrisma() {
	return {
		user: {
			findUnique: vi.fn(),
			update: vi.fn(),
			updateMany: vi.fn(),
		},
	};
}

describe("AtStoreReviewsService", () => {
	let prisma: ReturnType<typeof createPrisma>;
	let service: AtStoreReviewsService;

	beforeEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		prisma = createPrisma();
		service = new AtStoreReviewsService(prisma as never);
		agentHarness.listRecords.mockReset();
		agentHarness.putRecord.mockReset();
		mockFetchListing();
	});

	it("returns eligible only after seven full onboarding days and a clean preflight", async () => {
		prisma.user.findUnique.mockResolvedValue({
			onboardingCompletedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
			atStoreReviewHandledAt: null,
		});
		agentHarness.listRecords.mockResolvedValue({ data: { records: [] } });

		await expect(service.getPrompt(did, session)).resolves.toEqual({
			eligible: true,
			permissionGranted: false,
		});
		expect(agentHarness.listRecords).toHaveBeenCalledWith(
			expect.objectContaining({
				repo: did,
				collection: "fyi.atstore.listing.review",
			}),
		);
	});

	it("reports review permission for the upgraded device session", async () => {
		prisma.user.findUnique.mockResolvedValue({
			onboardingCompletedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
			atStoreReviewHandledAt: null,
		});
		agentHarness.listRecords.mockResolvedValue({ data: { records: [] } });

		await expect(
			service.getPrompt(did, {
				did,
				scope: "atproto include:fyi.atstore.authThirdPartyReviews",
			}),
		).resolves.toEqual({ eligible: true, permissionGranted: true });
	});

	it("reports permission from the OAuth session's resolved token scopes", async () => {
		prisma.user.findUnique.mockResolvedValue({
			onboardingCompletedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
			atStoreReviewHandledAt: null,
		});
		agentHarness.listRecords.mockResolvedValue({ data: { records: [] } });

		await expect(
			service.getPrompt(did, {
				did,
				getTokenInfo: vi.fn().mockResolvedValue({
					scope:
						"atproto repo:fyi.atstore.profile?action=create repo:fyi.atstore.listing.review?action=create",
				}),
			}),
		).resolves.toEqual({ eligible: true, permissionGranted: true });
	});

	it("marks a matching existing PDS review handled and hides the prompt", async () => {
		prisma.user.findUnique.mockResolvedValue({
			onboardingCompletedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
			atStoreReviewHandledAt: null,
		});
		agentHarness.listRecords.mockResolvedValue({
			data: { records: [{ value: { subject: listingUri } }] },
		});

		await expect(service.getPrompt(did, session)).resolves.toEqual({
			eligible: false,
			permissionGranted: false,
		});
		expect(prisma.user.update).toHaveBeenCalledWith({
			where: { did },
			data: { atStoreReviewHandledAt: expect.any(Date) },
		});
	});

	it("hides the prompt for a failed preflight without handling the request", async () => {
		prisma.user.findUnique.mockResolvedValue({
			onboardingCompletedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
			atStoreReviewHandledAt: null,
		});
		agentHarness.listRecords.mockRejectedValue(new Error("PDS unavailable"));

		await expect(service.getPrompt(did, session)).resolves.toEqual({
			eligible: false,
			permissionGranted: false,
		});
		expect(prisma.user.update).not.toHaveBeenCalled();
	});

	it("publishes only an AT Store review with a reserved rkey and handles the request", async () => {
		prisma.user.findUnique
			.mockResolvedValueOnce({
				atStoreReviewRkey: null,
				atStoreReviewHandledAt: null,
			})
			.mockResolvedValueOnce({
				atStoreReviewRkey: null,
				atStoreReviewHandledAt: null,
			});
		prisma.user.updateMany.mockResolvedValue({ count: 1 });
		agentHarness.listRecords.mockResolvedValue({ data: { records: [] } });
		agentHarness.putRecord.mockResolvedValue({
			data: { uri: `at://${did}/fyi.atstore.listing.review/3mtesttid` },
		});

		await expect(
			service.publish(did, session, { rating: 5, text: " Great app! " }),
		).resolves.toEqual({
			uri: `at://${did}/fyi.atstore.listing.review/3mtesttid`,
		});
		expect(agentHarness.putRecord).toHaveBeenCalledWith({
			repo: did,
			collection: "fyi.atstore.listing.review",
			rkey: "3mtesttid",
			validate: false,
			record: expect.objectContaining({
				$type: "fyi.atstore.listing.review",
				subject: listingUri,
				rating: 5,
				text: "Great app!",
			}),
		});
		expect(prisma.user.update).toHaveBeenCalledWith({
			where: { did },
			data: { atStoreReviewHandledAt: expect.any(Date) },
		});
	});

	it("reuses a retained rkey after a failed publication", async () => {
		prisma.user.findUnique.mockResolvedValue({
			atStoreReviewRkey: "3mretry",
			atStoreReviewHandledAt: null,
		});
		agentHarness.listRecords.mockResolvedValue({ data: { records: [] } });
		agentHarness.putRecord.mockRejectedValue(
			new Error("temporary PDS failure"),
		);

		await expect(service.publish(did, session, { rating: 4 })).rejects.toThrow(
			"temporary PDS failure",
		);
		expect(agentHarness.putRecord).toHaveBeenCalledWith(
			expect.objectContaining({ rkey: "3mretry" }),
		);
		expect(prisma.user.update).not.toHaveBeenCalled();
	});

	it("does not publish a duplicate when a matching review appears at submission", async () => {
		agentHarness.listRecords.mockResolvedValue({
			data: { records: [{ value: { subject: listingUri } }] },
		});

		await expect(
			service.publish(did, session, { rating: 4 }),
		).rejects.toBeInstanceOf(ConflictException);
		expect(agentHarness.putRecord).not.toHaveBeenCalled();
	});
});
