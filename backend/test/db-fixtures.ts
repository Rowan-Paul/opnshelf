import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../src/generated/client";

/** Database suites share one disposable PostgreSQL with each other, in
 * parallel, and with the foreign rows that test/db-isolation.setup.ts seeds.
 * A suite reads, asserts on, and cleans up only rows that belong to its own
 * FixtureOwner. Never count or delete across a whole table. */
export type FixtureOwner = {
	/** User did; unique per call, so parallel runs never meet. */
	did: string;
	handle: string;
	/** Unique prefix for any other key the suite creates (show ids, rkeys). */
	prefix: string;
};

export function fixtureOwner(label: string): FixtureOwner {
	const prefix = `${label}-${randomUUID()}`;
	return { did: `did:plc:${prefix}`, handle: `${prefix}.test`, prefix };
}

/** Postgres application_name for a suite's own connections, so lock-wait
 * probes on pg_stat_activity see only this suite's sessions. */
export function suiteApplicationName(label: string) {
	return `test-${label}-${randomUUID()}`.slice(0, 63);
}

/** Sessions of one suite currently waiting on a lock whose query matches. */
export async function lockWaiters(
	db: PrismaClient,
	applicationName: string,
	queryPattern: string,
) {
	const [row] = await db.$queryRaw<{ count: number }[]>`
		SELECT COUNT(*)::int AS count FROM pg_stat_activity
		WHERE application_name = ${applicationName}
			AND wait_event_type = 'Lock'
			AND query LIKE ${queryPattern}`;
	return row.count;
}

/** Sync entries of the owner's Integration connections, optionally narrowed. */
export function ownedEntries<T extends object>(did: string, where?: T) {
	return { ...where, connection: { userDid: did } };
}

/** Removes the owner and everything it owns. Watch privacy journals restrict
 * deletion of their job and user, so they go first; the rest cascades. */
export async function deleteFixtureOwner(db: PrismaClient, did: string) {
	const jobs = await db.backgroundJob.findMany({
		where: { userDid: did },
		select: { id: true },
	});
	await db.watchPrivacyCopy.deleteMany({
		where: { jobId: { in: jobs.map((job) => job.id) } },
	});
	await db.watchPrivacyMigration.deleteMany({ where: { userDid: did } });
	await db.backgroundJob.deleteMany({ where: { userDid: did } });
	await db.user.deleteMany({ where: { did } });
}
