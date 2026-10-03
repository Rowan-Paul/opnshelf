import { Agent } from "@atproto/api";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { isAtprotoRecordMissingError } from "./atproto-record-errors";

/** Edit only the date; retain identity, creation time, and any extension fields. */
export async function updateWatchDate(
	session: { did: string },
	collection: string,
	rkey: string,
	watchedAt: string | null,
): Promise<{ cid: string; watchedDate: Date | null }> {
	const watchedDate = watchedAt === null ? null : new Date(watchedAt);
	if (
		watchedDate &&
		(!Number.isFinite(watchedDate.getTime()) ||
			watchedDate.getTime() > Date.now())
	) {
		throw new BadRequestException(
			"Watch date must be a valid date that is not in the future",
		);
	}
	const agent = new Agent(
		session as unknown as ConstructorParameters<typeof Agent>[0],
	);
	try {
		const existing = await agent.com.atproto.repo.getRecord({
			repo: session.did,
			collection,
			rkey,
		});
		const record = { ...existing.data.value };
		if (watchedDate === null) delete record.watchedAt;
		else record.watchedAt = watchedDate.toISOString();
		// An update (unlike putRecord) cannot recreate a deleted Watch. User edits
		// deliberately have no revision precondition: last successful write wins.
		const response = await agent.com.atproto.repo.applyWrites({
			repo: session.did,
			validate: false,
			writes: [
				{
					$type: "com.atproto.repo.applyWrites#update",
					collection,
					rkey,
					value: record,
				},
			],
		});
		const result = response.data.results?.[0];
		if (!result || !("cid" in result) || typeof result.cid !== "string") {
			throw new Error("PDS did not return the updated Watch");
		}
		return { cid: result.cid, watchedDate };
	} catch (error) {
		if (
			isAtprotoRecordMissingError(error) ||
			(error instanceof Error &&
				error.message.includes("Update target record does not exist"))
		) {
			throw new NotFoundException("Watch no longer exists");
		}
		throw error;
	}
}
