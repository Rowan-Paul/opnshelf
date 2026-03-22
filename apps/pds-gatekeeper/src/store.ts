import crypto from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import type { GatekeeperConfig } from "./config.js";

export type ConsumeCodeResult =
	| { ok: true }
	| { ok: false; reason: "invalid" | "expired" };

export class GateCodeStore {
	private constructor(
		private readonly sql: SqlJsStatic,
		private readonly db: Database,
		private readonly dbPath: string,
	) {}

	static async open(
		config: Pick<GatekeeperConfig, "dbPath" | "signupCodeTtlSeconds">,
	): Promise<GateCodeStore> {
		const SQL = await initSqlJs();
		const db = existsSync(config.dbPath)
			? new SQL.Database(readFileSync(config.dbPath))
			: new SQL.Database();
		db.run(`
			CREATE TABLE IF NOT EXISTS gate_codes (
				code TEXT PRIMARY KEY,
				handle TEXT NOT NULL,
				created_at_ms INTEGER NOT NULL
			);
			CREATE INDEX IF NOT EXISTS idx_gate_codes_handle ON gate_codes(handle);
			CREATE INDEX IF NOT EXISTS idx_gate_codes_created_at ON gate_codes(created_at_ms);
		`);
		const store = new GateCodeStore(SQL, db, config.dbPath);
		store.persist();
		return store;
	}

	close() {
		this.persist();
		this.db.close();
	}

	issueCode(handle: string, now = Date.now()): string {
		this.cleanupExpired(now);
		const code = crypto.randomBytes(32).toString("base64url");
		this.db.run(
			"INSERT INTO gate_codes (code, handle, created_at_ms) VALUES ($code, $handle, $createdAtMs)",
			{
				$code: code,
				$handle: handle,
				$createdAtMs: now,
			},
		);
		this.persist();
		return code;
	}

	consumeCode(
		handle: string,
		code: string,
		ttlSeconds: number,
		now = Date.now(),
	): ConsumeCodeResult {
		const statement = this.db.prepare(
			"SELECT created_at_ms FROM gate_codes WHERE code = $code AND handle = $handle LIMIT 1",
		);
		statement.bind({
			$code: code,
			$handle: handle,
		});
		const row = statement.step()
			? (statement.getAsObject() as { created_at_ms: number })
			: undefined;
		statement.free();

		if (!row) {
			return { ok: false, reason: "invalid" };
		}

		this.db.run("DELETE FROM gate_codes WHERE code = $code", {
			$code: code,
		});
		this.persist();

		if (now - row.created_at_ms > ttlSeconds * 1000) {
			return { ok: false, reason: "expired" };
		}

		return { ok: true };
	}

	private cleanupExpired(now: number) {
		const oldestAllowed = now - 24 * 60 * 60 * 1000;
		this.db.run("DELETE FROM gate_codes WHERE created_at_ms < $oldestAllowed", {
			$oldestAllowed: oldestAllowed,
		});
		this.persist();
	}

	private persist() {
		const bytes = this.db.export();
		writeFileSync(this.dbPath, Buffer.from(bytes));
	}
}
