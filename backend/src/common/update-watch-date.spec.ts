// Repository routing is tested separately; these tests isolate public Watch behavior.
vi.mock("../privacy/watch-operation", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("../privacy/watch-operation")>();
	const { Agent } = await import("@atproto/api");
	return {
		...actual,
		createWatchAgent: (session: ConstructorParameters<typeof Agent>[0]) =>
			new Agent(session),
	};
});
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { validate } from "class-validator";
import { UpdateWatchDateDto } from "./update-watch-date.dto";
import { updateWatchDate } from "./update-watch-date";

const { getRecord, applyWrites } = vi.hoisted(() => ({
	getRecord: vi.fn(),
	applyWrites: vi.fn(),
}));
vi.mock("@atproto/api", () => ({
	Agent: vi.fn(function () {
		return {
			com: { atproto: { repo: { getRecord, applyWrites } } },
		};
	}),
}));
const session = { did: "did:plc:owner" };

beforeEach(() => {
	vi.clearAllMocks();
	getRecord.mockResolvedValue({
		data: {
			value: {
				$type: "xyz.opnshelf.movie",
				movieId: "1",
				source: "tmdb",
				createdAt: "2020-01-01T00:00:00.123Z",
				watchedAt: "2020-01-01T00:00:00.123Z",
				extension: "keep",
			},
		},
	});
	applyWrites.mockResolvedValue({ data: { results: [{ cid: "new-cid" }] } });
});

it.each(["xyz.opnshelf.movie", "xyz.opnshelf.episode"])(
	"updates %s at its existing key and preserves other fields",
	async (collection) => {
		await updateWatchDate(
			session,
			collection,
			"original-key",
			"2021-02-03T04:05:06.789Z",
		);
		expect(applyWrites).toHaveBeenCalledWith({
			repo: session.did,
			validate: false,
			writes: [
				{
					$type: "com.atproto.repo.applyWrites#update",
					collection,
					rkey: "original-key",
					value: {
						...(await getRecord.mock.results[0].value).data.value,
						watchedAt: "2021-02-03T04:05:06.789Z",
					},
				},
			],
		});
	},
);

it("clears the record field for No date", async () => {
	const result = await updateWatchDate(
		session,
		"xyz.opnshelf.movie",
		"key",
		null,
	);
	expect(applyWrites.mock.calls[0][0].writes[0].value).not.toHaveProperty(
		"watchedAt",
	);
	expect(result.watchedDate).toBeNull();
});

it.each(["invalid", "2099-01-01T00:00:00Z"])(
	"rejects %s before touching the PDS",
	async (value) => {
		await expect(
			updateWatchDate(session, "xyz.opnshelf.movie", "key", value),
		).rejects.toBeInstanceOf(BadRequestException);
		expect(getRecord).not.toHaveBeenCalled();
	},
);

it("does not recreate an absent Watch", async () => {
	getRecord.mockRejectedValueOnce({ error: "RecordNotFound" });
	await expect(
		updateWatchDate(session, "xyz.opnshelf.movie", "key", null),
	).rejects.toBeInstanceOf(NotFoundException);
	expect(applyWrites).not.toHaveBeenCalled();
});

it("propagates PDS write failures", async () => {
	applyWrites.mockRejectedValueOnce(new Error("offline"));
	await expect(
		updateWatchDate(session, "xyz.opnshelf.movie", "key", null),
	).rejects.toThrow("offline");
});

it("requires an explicit ISO date or null, never omitted/empty", async () => {
	for (const watchedAt of [undefined, "", "invalid", 123]) {
		expect(
			(await validate(Object.assign(new UpdateWatchDateDto(), { watchedAt })))
				.length,
		).toBeGreaterThan(0);
	}
	for (const watchedAt of [null, "2020-01-01T00:00:00.123Z"]) {
		expect(
			await validate(Object.assign(new UpdateWatchDateDto(), { watchedAt })),
		).toEqual([]);
	}
});
