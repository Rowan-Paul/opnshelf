import { vi } from "vitest";
import type { PrismaService } from "../src/prisma/prisma.service";
import type { WatchPrivacyCoordinator } from "../src/privacy/watch-privacy-coordinator";
import type { WatchVisibility } from "../src/privacy/watch-record-migration";
/** Service tests mock coordination; real lock/transaction semantics are covered
 * by watch-privacy-coordinator.integration.spec.ts on disposable PostgreSQL. */
export function mockWatchCoordinator(prisma?: PrismaService) {
	return {
		write: vi.fn(
			(
				_did: string,
				operation: (
					visibility: WatchVisibility,
					signal: AbortSignal,
				) => Promise<unknown>,
			) => operation("public", new AbortController().signal),
		),
		withAccountLock: vi.fn(
			(
				_did: string,
				operation: (
					tx: PrismaService | undefined,
					signal: AbortSignal,
				) => Promise<unknown>,
			) => operation(prisma, new AbortController().signal),
		),
		stopForAccountDeletion: vi.fn().mockResolvedValue(undefined),
		deleteLocalAccount: vi.fn(
			(
				_did: string,
				operation: (tx: PrismaService | undefined) => Promise<void>,
			) => prisma?.$transaction(() => operation(prisma)),
		),
	} as unknown as WatchPrivacyCoordinator;
}
