import { createHash, randomUUID } from "node:crypto";
import type { Logger } from "@nestjs/common";
import { requestContext } from "../common/request-id";

/** Correlates session and transaction lock holders without recording account DIDs. */
export function createAccountLockLog(
	logger: Logger,
	{
		ownerDid,
		operation,
		mode,
		scope,
	}: {
		ownerDid: string;
		operation: string;
		mode: string;
		scope: string;
	},
) {
	const startedAt = Date.now();
	const context = {
		lockId: randomUUID(),
		accountHash: createHash("sha256").update(ownerDid).digest("hex"),
		operation,
		requestId: requestContext.getStore()?.requestId ?? null,
		mode,
		scope,
	};
	return (event: string, namespace?: number, sharedLock?: boolean) => {
		logger.log(
			JSON.stringify({
				event: `account_lock.${event}`,
				timestamp: new Date().toISOString(),
				...context,
				namespace,
				shared: sharedLock,
				elapsedMs: Date.now() - startedAt,
			}),
		);
	};
}
