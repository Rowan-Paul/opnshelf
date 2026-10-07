import {
	moveWatchToPrivate,
	moveWatchToPublic,
	WatchMigrationConflict,
	type StoredWatch,
	type WatchMigrationJournal,
	type WatchMigrationRepository,
	type WatchMoveReceipt,
	type WatchReference,
} from "./watch-record-migration";

const ref: WatchReference = {
	collection: "xyz.opnshelf.movie",
	rkey: "watch-1",
};
const record: StoredWatch = {
	cid: "original-cid",
	value: {
		$type: ref.collection,
		movieId: "42",
		watchedAt: null,
		extension: "keep",
	},
};
function fixture() {
	let source: StoredWatch | undefined = structuredClone(record);
	let destination: StoredWatch | undefined;
	let receipt: WatchMoveReceipt | undefined;
	const repository: WatchMigrationRepository = {
		assertPrivate: vi.fn(async () => {}),
		readPublic: vi.fn(async () => source),
		readPrivate: vi.fn(async () => destination),
		createPrivate: vi.fn(async (_ref, value) => {
			if (destination) throw new WatchMigrationConflict();
			destination = structuredClone(value);
		}),
		deletePublic: vi.fn(async (_ref, cid) => {
			if (source && source.cid !== cid) throw new WatchMigrationConflict();
			source = undefined;
		}),
	};
	const journal: WatchMigrationJournal = {
		assertDirection: vi.fn(async () => {}),
		load: vi.fn(async () => receipt),
		recordVerifiedCopy: vi.fn(async (next) => {
			if (receipt && receipt.cid !== next.cid)
				throw new WatchMigrationConflict();
			receipt = structuredClone(next);
		}),
	};
	return {
		repository,
		journal,
		setSource(value: StoredWatch | undefined) {
			source = value;
		},
		setDestination(value: StoredWatch | undefined) {
			destination = value;
		},
		snapshot: () => ({ source, destination, receipt }),
	};
}

describe("moving a Watch into its private Space", () => {
	it("verifies a complete copy, journals it, then conditionally removes the public record", async () => {
		const f = fixture();
		expect(await moveWatchToPrivate(ref, f.repository, f.journal)).toBe(
			"moved",
		);
		expect(f.snapshot()).toEqual({
			source: undefined,
			destination: record,
			receipt: { ...ref, ...record },
		});
		expect(f.repository.deletePublic).toHaveBeenCalledWith(ref, record.cid);
		expect(
			vi.mocked(f.journal.recordVerifiedCopy).mock.invocationCallOrder[0],
		).toBeLessThan(
			vi.mocked(f.repository.deletePublic).mock.invocationCallOrder[0],
		);
	});
	it("resumes after deletion without creating a new Watch or changing its identity", async () => {
		const f = fixture();
		await moveWatchToPrivate(ref, f.repository, f.journal);
		expect(await moveWatchToPrivate(ref, f.repository, f.journal)).toBe(
			"moved",
		);
		expect(f.repository.createPrivate).toHaveBeenCalledTimes(1);
		expect(f.repository.deletePublic).toHaveBeenCalledTimes(1);
	});
	it("recovers an unacknowledged destination creation", async () => {
		const f = fixture();
		f.setDestination(record);
		expect(await moveWatchToPrivate(ref, f.repository, f.journal)).toBe(
			"moved",
		);
		expect(f.repository.createPrivate).not.toHaveBeenCalled();
	});
	it("preserves both copies on a destination collision", async () => {
		const f = fixture();
		f.setDestination({ ...record, cid: "different" });
		await expect(
			moveWatchToPrivate(ref, f.repository, f.journal),
		).rejects.toThrow(WatchMigrationConflict);
		expect(f.repository.deletePublic).not.toHaveBeenCalled();
		expect(f.repository.createPrivate).not.toHaveBeenCalled();
	});
	it("never deletes before the verified-copy journal commits", async () => {
		const f = fixture();
		vi.mocked(f.journal.recordVerifiedCopy).mockRejectedValueOnce(
			new Error("database unavailable"),
		);
		await expect(
			moveWatchToPrivate(ref, f.repository, f.journal),
		).rejects.toThrow("database unavailable");
		expect(f.repository.deletePublic).not.toHaveBeenCalled();
		expect(await moveWatchToPrivate(ref, f.repository, f.journal)).toBe(
			"moved",
		);
	});
	it("rejects an edit made after copying and preserves the edited public Watch", async () => {
		const f = fixture();
		vi.mocked(f.journal.recordVerifiedCopy).mockImplementationOnce(async () => {
			f.setSource({ ...record, cid: "edited" });
		});
		await expect(
			moveWatchToPrivate(ref, f.repository, f.journal),
		).rejects.toThrow(WatchMigrationConflict);
		expect(f.snapshot().source?.cid).toBe("edited");
		expect(f.snapshot().destination?.cid).toBe(record.cid);
	});
	it("does not recreate a Watch deleted before the move", async () => {
		const f = fixture();
		f.setSource(undefined);
		expect(await moveWatchToPrivate(ref, f.repository, f.journal)).toBe(
			"missing",
		);
		expect(f.repository.createPrivate).not.toHaveBeenCalled();
	});
	it("does not trust an unverified successful copy response", async () => {
		const f = fixture();
		vi.mocked(f.repository.createPrivate).mockResolvedValueOnce();
		await expect(
			moveWatchToPrivate(ref, f.repository, f.journal),
		).rejects.toThrow(WatchMigrationConflict);
		expect(f.repository.deletePublic).not.toHaveBeenCalled();
	});
	it("never resumes deletion after the verified private copy disappears", async () => {
		const f = fixture();
		vi.mocked(f.repository.deletePublic).mockRejectedValueOnce(
			new Error("offline"),
		);
		await expect(
			moveWatchToPrivate(ref, f.repository, f.journal),
		).rejects.toThrow("offline");
		f.setDestination(undefined);
		await expect(
			moveWatchToPrivate(ref, f.repository, f.journal),
		).rejects.toThrow(WatchMigrationConflict);
		expect(f.snapshot().source).toEqual(record);
		expect(f.repository.createPrivate).toHaveBeenCalledTimes(1);
	});
	it("checks privacy again before deletion", async () => {
		const f = fixture();
		vi.mocked(f.repository.assertPrivate)
			.mockResolvedValueOnce()
			.mockRejectedValueOnce(new Error("policy changed"));
		await expect(
			moveWatchToPrivate(ref, f.repository, f.journal),
		).rejects.toThrow("policy changed");
		expect(f.repository.deletePublic).not.toHaveBeenCalled();
	});
	it("does not report success if another app recreates the public Watch", async () => {
		const f = fixture();
		vi.mocked(f.repository.deletePublic).mockImplementationOnce(async () => {
			f.setSource({ ...record, cid: "recreated" });
		});
		await expect(
			moveWatchToPrivate(ref, f.repository, f.journal),
		).rejects.toThrow(WatchMigrationConflict);
	});
});

// Reuse the same failure-injection fixture with private as source and public as
// destination; the direction-specific preflight must run before any publication.
function reverseFixture() {
	const f = fixture();
	return {
		...f,
		reverse: {
			assertPrivate: f.repository.assertPrivate,
			assertExistingPrivate: f.repository.assertPrivate,
			assertConditionalPrivateDelete: vi.fn(async () => {}),
			readPrivate: f.repository.readPublic,
			readPublic: f.repository.readPrivate,
			createPublic: f.repository.createPrivate,
			deletePrivate: f.repository.deletePublic,
			createPrivate: vi.fn(),
			deletePublic: vi.fn(),
		},
	};
}
describe("moving a Watch back to public", () => {
	it("checks deletion support before exposing any private record", async () => {
		const f = reverseFixture();
		f.reverse.assertConditionalPrivateDelete.mockRejectedValue(
			new Error("unsupported"),
		);
		await expect(moveWatchToPublic(ref, f.reverse, f.journal)).rejects.toThrow(
			"unsupported",
		);
		expect(f.reverse.readPrivate).not.toHaveBeenCalled();
		expect(f.reverse.createPublic).not.toHaveBeenCalled();
	});
	it("moves the complete record and retains a temporary durable recovery receipt", async () => {
		const f = reverseFixture();
		expect(await moveWatchToPublic(ref, f.reverse, f.journal)).toBe("moved");
		expect(f.snapshot()).toEqual({
			source: undefined,
			destination: record,
			receipt: { ...ref, ...record },
		});
		expect(f.reverse.deletePrivate).toHaveBeenCalledWith(ref, record.cid);
	});
	it("does not overwrite an independently edited public record", async () => {
		const f = reverseFixture();
		f.setDestination({ ...record, cid: "public-edit" });
		await expect(moveWatchToPublic(ref, f.reverse, f.journal)).rejects.toThrow(
			WatchMigrationConflict,
		);
		expect(f.reverse.deletePrivate).not.toHaveBeenCalled();
		expect(f.snapshot().source).toEqual(record);
	});
	it("retries after source deletion using the receipt", async () => {
		const f = reverseFixture();
		await moveWatchToPublic(ref, f.reverse, f.journal);
		expect(await moveWatchToPublic(ref, f.reverse, f.journal)).toBe("moved");
		expect(f.reverse.createPublic).toHaveBeenCalledTimes(1);
	});
});
