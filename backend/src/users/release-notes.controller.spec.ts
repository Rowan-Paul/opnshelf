import { Test } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import { PrismaService } from "../prisma/prisma.service";
import { ReleaseNotesController } from "./release-notes.controller";

describe("Release Notes read state", () => {
	const createdAt = new Date("2026-09-01T00:00:00.000Z");
	let readAt: Date | null;
	let controller: ReleaseNotesController;
	const req = { user: { did: "did:plc:reader" } } as AuthenticatedRequest;
	const updateMany = vi.fn();
	beforeEach(async () => {
		readAt = null;
		updateMany.mockReset().mockImplementation(async ({ data }) => {
			if (!readAt || data.releaseNotesReadAt > readAt)
				readAt = data.releaseNotesReadAt;
			return { count: 1 };
		});
		const module = await Test.createTestingModule({
			controllers: [ReleaseNotesController],
			providers: [
				{
					provide: PrismaService,
					useValue: {
						user: {
							findUniqueOrThrow: vi.fn(async () => ({
								createdAt,
								releaseNotesReadAt: readAt,
							})),
							updateMany,
						},
					},
				},
			],
		})
			.overrideGuard(AuthGuard)
			.useValue({ canActivate: () => true })
			.compile();
		controller = module.get(ReleaseNotesController);
	});
	it("starts new accounts caught up through account creation", async () => {
		expect(await controller.getReadState(req)).toEqual({
			readThrough: createdAt.toISOString(),
		});
		await controller.markRead(req, { readThrough: "2026-08-01T00:00:00.000Z" });
		expect(await controller.getReadState(req)).toEqual({
			readThrough: createdAt.toISOString(),
		});
	});
	it("advances only through the displayed entry and uses an atomic monotonic predicate", async () => {
		const timestamp = "2026-09-03T00:00:00.000Z";
		expect(await controller.markRead(req, { readThrough: timestamp })).toEqual({
			readThrough: timestamp,
		});
		expect(updateMany).toHaveBeenCalledWith({
			where: {
				did: req.user.did,
				OR: [
					{ releaseNotesReadAt: null },
					{ releaseNotesReadAt: { lt: new Date(timestamp) } },
				],
			},
			data: { releaseNotesReadAt: new Date(timestamp) },
		});
		expect(
			await controller.markRead(req, {
				readThrough: "2026-09-02T00:00:00.000Z",
			}),
		).toEqual({ readThrough: timestamp });
	});
	it("rejects future and invalid watermarks without writing", async () => {
		for (const readThrough of [
			"invalid",
			new Date(Date.now() + 60_000).toISOString(),
		])
			await expect(
				controller.markRead(req, { readThrough }),
			).rejects.toBeInstanceOf(BadRequestException);
		expect(updateMany).not.toHaveBeenCalled();
	});
});
