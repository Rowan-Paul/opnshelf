import type { PrivacyRepositoryConfig } from "./privacy-category";
import { AsyncLocalStorage } from "node:async_hooks";
import { Agent } from "@atproto/api";
import {
	Injectable,
	ForbiddenException,
	type CallHandler,
	type ExecutionContext,
	type NestInterceptor,
} from "@nestjs/common";
import { defer, lastValueFrom } from "rxjs";
import type { AuthenticatedRequest } from "../auth/types";
import { WatchPrivacyCoordinator } from "./watch-privacy-coordinator";
import {
	WatchMigrationPds,
	type WatchOAuthSession,
} from "./watch-migration-pds";
import type { WatchVisibility } from "./watch-record-migration";

export const watchOperation = new AsyncLocalStorage<{
	did: string;
	visibility: WatchVisibility;
	repository?: PrivacyRepositoryConfig;
	signal: AbortSignal;
}>();

/** Encloses both the PDS mutation and its local projection, including bulk writes. */
@Injectable()
export class WatchWriteInterceptor implements NestInterceptor {
	constructor(private readonly coordinator: WatchPrivacyCoordinator) {}
	intercept(context: ExecutionContext, next: CallHandler) {
		const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
		return defer(() =>
			this.coordinator.write(user.did, (visibility, signal) =>
				watchOperation.run({ did: user.did, visibility, signal }, () =>
					lastValueFrom(next.handle()),
				),
			),
		);
	}
}

export function requireWatchSession(session: unknown): WatchOAuthSession {
	if (
		!session ||
		typeof session !== "object" ||
		!("did" in session) ||
		typeof session.did !== "string" ||
		!("fetchHandler" in session) ||
		typeof session.fetchHandler !== "function" ||
		!("getTokenInfo" in session) ||
		typeof session.getTokenInfo !== "function"
	) {
		throw new ForbiddenException(
			"Authorize Private data access to use private Watches",
		);
	}
	return session as WatchOAuthSession;
}

type Repo = Agent["com"]["atproto"]["repo"];
type Params<
	K extends "putRecord" | "getRecord" | "deleteRecord" | "applyWrites",
> = NonNullable<Parameters<Repo[K]>[0]>;

/** Dedicated Watch repository interface. Private responses retain their real
 * Space URIs; they must not pass through public-repository lexicon validation. */
export function createWatchAgent(
	session: { did: string },
	createSpace = false,
) {
	const context = watchOperation.getStore();
	if (!context || context.did !== session.did)
		throw new Error("Watch writes require the account coordinator");
	context.signal.throwIfAborted();
	if (context.visibility === "public") {
		const agent = new Agent(async (url, init) => {
			context.signal.throwIfAborted();
			const candidate = session as {
				did: string;
				fetchHandler?: (url: string, init?: RequestInit) => Promise<Response>;
			};
			if (!candidate.fetchHandler)
				throw new Error("Watch session cannot make authenticated requests");
			return candidate.fetchHandler(String(url), {
				...init,
				signal: AbortSignal.any([
					context.signal,
					AbortSignal.timeout(10000),
					...(init?.signal ? [init.signal] : []),
				]),
			});
		});
		return { com: { atproto: { repo: agent.com.atproto.repo } } };
	}
	const pds = new WatchMigrationPds(
		session.did,
		requireWatchSession(session),
		context.signal,
		context.repository,
	);
	const writeResult = (body: Record<string, unknown>) => {
		if (typeof body.uri !== "string" || typeof body.cid !== "string")
			throw new Error("Invalid private Watch response");
		return { uri: body.uri, cid: body.cid };
	};
	const repo = {
		async getRecord(params: Params<"getRecord">) {
			const body = await pds.watchRequest("getRecord", params, false);
			if (
				!body.value ||
				typeof body.value !== "object" ||
				Array.isArray(body.value)
			)
				throw new Error("Invalid private Watch record");
			return {
				data: {
					...writeResult(body),
					value: body.value as Record<string, unknown>,
				},
				headers: {},
			};
		},
		async putRecord(params: Params<"putRecord">) {
			if (createSpace) await pds.assertPrivate();
			const body = await pds.watchRequest("putRecord", params, true);
			return { data: writeResult(body), headers: {} };
		},
		async deleteRecord(params: Params<"deleteRecord">) {
			await pds.watchRequest("deleteRecord", params, true);
			return { data: {}, headers: {} };
		},
		async applyWrites(params: Params<"applyWrites">) {
			const body = await pds.watchRequest(
				"applyWrites",
				{
					...params,
					writes: params.writes.map((write) => ({
						...write,
						$type: write.$type?.replace(
							"com.atproto.repo.",
							"com.atproto.space.",
						),
					})),
				},
				true,
			);
			if (!Array.isArray(body.results))
				throw new Error("Invalid private Watch batch response");
			const results = body.results.map((result) => {
				if (!result || typeof result !== "object")
					throw new Error("Invalid private Watch batch result");
				return writeResult(result);
			});
			return { data: { results, commit: undefined }, headers: {} };
		},
	};
	return { com: { atproto: { repo } } };
}
export type WatchAgent = ReturnType<typeof createWatchAgent>;
