import { Logger } from "@nestjs/common";
import { requestContext } from "../common/request-id";
import { EventEmitter } from "node:events";
import type { Pool } from "pg";
import { WatchAccountBusyError, WatchAccountLock } from "./watch-account-lock";

beforeEach(() =>
	vi.spyOn(Logger.prototype, "log").mockImplementation(() => {}),
);
afterEach(() => vi.restoreAllMocks());

function fixture() {
	const client = Object.assign(new EventEmitter(), {
		query: vi.fn(),
		release: vi.fn(),
	});
	const pool = {
		waitingCount: 0,
		idleCount: 1,
		totalCount: 1,
		options: { max: 2, query_timeout: 5000, connectionTimeoutMillis: 1000 },
		connect: vi.fn(async () => client),
	};
	return { client, pool, lock: new WatchAccountLock(pool as unknown as Pool) };
}
it("destroys a session when acquisition has an unknown outcome", async () => {
	const f = fixture();
	f.client.query.mockRejectedValue(new Error("query timeout"));
	const operation = vi.fn();
	await expect(f.lock.run("did:plc:owner", operation)).rejects.toThrow(
		"query timeout",
	);
	expect(operation).not.toHaveBeenCalled();
	expect(f.client.release).toHaveBeenCalledWith(true);
});
it("aborts the operation on connection loss and discards the session", async () => {
	const f = fixture();
	f.client.query.mockResolvedValue({ rows: [{ acquired: true }] });
	await expect(
		f.lock.run("did:plc:owner", async (signal) => {
			f.client.emit("error", new Error("connection lost"));
			expect(signal.aborted).toBe(true);
		}),
	).rejects.toThrow("lost its account lock");
	expect(f.client.release).toHaveBeenCalledWith(true);
});
it("destroys the connection if unlocking fails", async () => {
	const f = fixture();
	f.client.query
		.mockResolvedValueOnce({ rows: [{ acquired: true }] })
		.mockRejectedValueOnce(new Error("timeout"));
	await expect(f.lock.run("did:plc:owner", async () => "saved")).resolves.toBe(
		"saved",
	);
	expect(f.client.release).toHaveBeenCalledWith(true);
});

it("admits another account through the bounded pool wait instead of rejecting immediately", async () => {
	const f = fixture();
	f.pool.idleCount = 0;
	f.pool.totalCount = 2;
	f.client.query.mockResolvedValue({ rows: [{ acquired: true }] });
	await expect(
		f.lock.run("did:plc:another", async () => "saved"),
	).resolves.toBe("saved");
	expect(f.pool.connect).toHaveBeenCalledOnce();
});
it("bounds the queue without attempting a connection", async () => {
	const f = fixture();
	f.pool.waitingCount = 16;
	await expect(f.lock.run("did:plc:another", async () => {})).rejects.toThrow(
		"busy",
	);
	expect(f.pool.connect).not.toHaveBeenCalled();
});

it("queues interactive acquisition in PostgreSQL without retrying the operation", async () => {
	const f = fixture();
	f.client.query.mockResolvedValue({ rows: [{}] });
	const operation = vi.fn(async () => "saved");
	await expect(
		f.lock.run("did:plc:owner", operation, { wait: true }),
	).resolves.toBe("saved");
	expect(f.client.query.mock.calls[0][0].text).toBe(
		"SELECT pg_advisory_lock(hashtextextended($1, 252))",
	);
	expect(operation).toHaveBeenCalledOnce();
	expect(f.client.release).toHaveBeenCalledWith(false);
});

it("discards timed-out interactive acquisition without running a write", async () => {
	const f = fixture();
	f.client.query.mockRejectedValue(new Error("Query read timeout"));
	const operation = vi.fn();
	await expect(
		f.lock.run("did:plc:owner", operation, { wait: true }),
	).rejects.toBeInstanceOf(WatchAccountBusyError);
	expect(operation).not.toHaveBeenCalled();
	expect(f.client.release).toHaveBeenCalledWith(true);
});

it("lets background work yield immediately when the account is busy", async () => {
	const f = fixture();
	f.client.query.mockResolvedValue({ rows: [{ acquired: false }] });
	const operation = vi.fn();
	await expect(f.lock.run("did:plc:owner", operation)).rejects.toBeInstanceOf(
		WatchAccountBusyError,
	);
	expect(operation).not.toHaveBeenCalled();
	expect(f.client.release).toHaveBeenCalledWith(false);
});

it("holds the privacy barrier while releasing the local write mutex before remote work", async () => {
	const f = fixture();
	f.client.query.mockResolvedValue({ rows: [{ acquired: true }] });
	await f.lock.run(
		"did:plc:owner",
		async (_signal, withWrite) => {
			await withWrite(async () => "snapshot");
			expect(f.client.query.mock.calls.map(([query]) => query.text)).toEqual([
				"SELECT pg_try_advisory_lock_shared(hashtextextended($1, 252)) AS acquired",
				"SELECT pg_try_advisory_lock(hashtextextended($1, 253)) AS acquired",
				'UPDATE "User" SET "watchWriteGeneration" = "watchWriteGeneration" + 1 WHERE did = $1',
				"SELECT pg_advisory_unlock(hashtextextended($1, 253))",
			]);
		},
		{ mode: "shared" },
	);
	expect(f.pool.connect).toHaveBeenCalledOnce();
	expect(f.client.query.mock.calls.at(-1)?.[0].text).toBe(
		"SELECT pg_advisory_unlock_shared(hashtextextended($1, 252))",
	);
});

it("releases the shared barrier if another local write owns the mutex", async () => {
	const f = fixture();
	f.client.query
		.mockResolvedValueOnce({ rows: [{ acquired: true }] })
		.mockResolvedValueOnce({ rows: [{ acquired: false }] })
		.mockResolvedValue({ rows: [{}] });
	const operation = vi.fn();
	await expect(
		f.lock.run("did:plc:owner", operation, { mode: "write" }),
	).rejects.toBeInstanceOf(WatchAccountBusyError);
	expect(operation).not.toHaveBeenCalled();
	expect(f.client.query.mock.calls.at(-1)?.[0].text).toBe(
		"SELECT pg_advisory_unlock_shared(hashtextextended($1, 252))",
	);
	expect(f.client.release).toHaveBeenCalledWith(false);
});

it("aborts and discards the session if the scoped write mutex cannot be released", async () => {
	const f = fixture();
	f.client.query
		.mockResolvedValueOnce({ rows: [{ acquired: true }] })
		.mockResolvedValueOnce({ rows: [{ acquired: true }] })
		.mockRejectedValueOnce(new Error("unlock timeout"));
	const remote = vi.fn();
	await expect(
		f.lock.run(
			"did:plc:owner",
			async (signal, withWrite) => {
				try {
					await withWrite(async () => "snapshot");
				} catch (error) {
					expect(signal.aborted).toBe(true);
					throw error;
				}
				await remote();
			},
			{ mode: "shared" },
		),
	).rejects.toThrow("unlock timeout");
	expect(remote).not.toHaveBeenCalled();
	expect(f.client.release).toHaveBeenCalledWith(true);
});

it.each(["connect", "work"] as const)(
	"releases remote admission after a %s failure",
	async (failure) => {
		const f = fixture();
		f.client.query.mockResolvedValue({ rows: [{ acquired: true }] });
		if (failure === "connect")
			f.pool.connect.mockRejectedValueOnce(new Error("offline"));
		await expect(
			f.lock.run(
				"did:plc:owner",
				async () => {
					throw new Error("failed work");
				},
				{ mode: "shared" },
			),
		).rejects.toThrow();
		await expect(
			f.lock.run("did:plc:owner", async () => "retry", { mode: "shared" }),
		).resolves.toBe("retry");
	},
);

function capturedLogs() {
	const spy = vi.spyOn(Logger.prototype, "log").mockImplementation(() => {});
	return () => spy.mock.calls.map(([message]) => JSON.parse(message as string));
}

it("correlates the holder and a timed-out waiter across lock instances", async () => {
	const logs = capturedLogs();
	const holder = fixture();
	const waiter = fixture();
	holder.client.query.mockResolvedValue({ rows: [{ acquired: true }] });
	waiter.client.query.mockRejectedValue(new Error("Query read timeout"));
	await holder.lock.run(
		"did:plc:owner",
		async () => {
			await requestContext.run({ requestId: "request-123" }, async () => {
				await expect(
					waiter.lock.run("did:plc:owner", async () => {}, {
						wait: true,
						mode: "write",
						operationName: "watch.write",
					}),
				).rejects.toBeInstanceOf(WatchAccountBusyError);
			});
			expect(logs()).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						event: "account_lock.acquired",
						operation: "trakt.snapshot",
						namespace: 252,
						shared: false,
					}),
					expect.objectContaining({
						event: "account_lock.acquisition_failed",
						operation: "watch.write",
						requestId: "request-123",
						namespace: 252,
						shared: true,
					}),
				]),
			);
		},
		{ operationName: "trakt.snapshot" },
	);
	const acquired = logs().find(
		(entry) => entry.event === "account_lock.acquired",
	);
	const failed = logs().find(
		(entry) => entry.event === "account_lock.acquisition_failed",
	);
	expect(acquired.accountHash).toBe(failed.accountHash);
	expect(acquired.lockId).not.toBe(failed.lockId);
	expect(
		logs()
			.filter((entry) => entry.lockId === failed.lockId)
			.map((entry) => entry.event),
	).toEqual([
		"account_lock.acquiring",
		"account_lock.acquisition_failed",
		"account_lock.connection_invalidated",
		"account_lock.discarded",
	]);
	expect(
		logs().find((entry) => entry.event === "account_lock.released"),
	).toMatchObject({ lockId: acquired.lockId, namespace: 252 });
	expect(JSON.stringify(logs())).not.toContain("did:plc:owner");
});

it("logs each scoped write release before the shared operation finishes", async () => {
	const logs = capturedLogs();
	const f = fixture();
	f.client.query.mockResolvedValue({ rows: [{ acquired: true }] });
	await f.lock.run(
		"did:plc:owner",
		async (_signal, withWrite) => {
			await withWrite(async () => {});
			expect(logs().at(-1)).toMatchObject({
				event: "account_lock.released",
				namespace: 254,
			});
		},
		{ mode: "shared", scope: "content", operationName: "content.sync" },
	);
	expect(
		logs()
			.filter((entry) => entry.event === "account_lock.released")
			.map((entry) => entry.namespace),
	).toEqual([254, 252]);
	expect(new Set(logs().map((entry) => entry.lockId)).size).toBe(1);
});

it("does not report a successful release when unlocking fails", async () => {
	const logs = capturedLogs();
	const f = fixture();
	f.client.query
		.mockResolvedValueOnce({ rows: [{ acquired: true }] })
		.mockRejectedValueOnce(new Error("unlock timeout"));
	await f.lock.run("did:plc:owner", async () => {});
	expect(logs().some((entry) => entry.event === "account_lock.released")).toBe(
		false,
	);
	expect(logs().at(-1)).toMatchObject({ event: "account_lock.discarded" });
});
