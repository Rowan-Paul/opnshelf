import { WATCH_SPACE_SCOPE } from "../auth/oauth-scopes";
import { createWatchAgent, watchOperation } from "./watch-operation";
const did = "did:plc:owner";
const collection = "xyz.opnshelf.movie";
const policy = { $type: "com.atproto.simplespace.defs#memberListPolicy" };
function fixture() {
	const calls: {
		path: string;
		body?: Record<string, unknown>;
		signal?: AbortSignal | null;
	}[] = [];
	const session = {
		did,
		getTokenInfo: async () => ({ scope: WATCH_SPACE_SCOPE }),
		fetchHandler: async (path: string, init?: RequestInit) => {
			calls.push({
				path,
				body:
					typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
				signal: init?.signal,
			});
			const body = path.includes("getSpace")
				? { readPolicy: policy, writePolicy: policy }
				: path.includes("listMembers")
					? { members: [] }
					: path.includes("applyWrites")
						? {
								results: [
									{
										uri: `at://${did}/space/xyz.opnshelf.watches/self/${did}/${collection}/key`,
										cid: "cid-private",
									},
								],
							}
						: {
								uri: `at://${did}/space/xyz.opnshelf.watches/self/${did}/${collection}/key`,
								cid: "cid-private",
								value: { $type: collection },
							};
			return new Response(JSON.stringify(body), {
				headers: { "content-type": "application/json" },
			});
		},
	};
	return { calls, session };
}
describe("coordinated Watch repository", () => {
	it("fails closed outside the coordinator and for a different account", () => {
		const { session } = fixture();
		expect(() => createWatchAgent(session)).toThrow("coordinator");
		watchOperation.run(
			{
				did: "did:plc:other",
				visibility: "private",
				signal: new AbortController().signal,
			},
			() => expect(() => createWatchAgent(session)).toThrow("coordinator"),
		);
	});
	it("routes private creation and date edits only to Spaces and keeps actual private URIs", async () => {
		const { session, calls } = fixture();
		await watchOperation.run(
			{ did, visibility: "private", signal: new AbortController().signal },
			async () => {
				const repo = createWatchAgent(session).com.atproto.repo;
				const response = await repo.putRecord({
					repo: did,
					collection,
					rkey: "key",
					record: { $type: collection, movieId: "1" },
				});
				expect(response.data.uri).toContain("/space/");
				await repo.applyWrites({
					repo: did,
					writes: [
						{
							$type: "com.atproto.repo.applyWrites#update",
							collection,
							rkey: "key",
							value: { $type: collection, movieId: "1" },
						},
					],
				});
			},
		);
		expect(
			calls.every((call) => !call.path.includes("com.atproto.repo.")),
		).toBe(true);
		const write = calls.find((call) => call.path.endsWith("applyWrites"));
		expect(write?.body).toMatchObject({
			space: `at://${did}/space/xyz.opnshelf.watches/self`,
			writes: [{ $type: "com.atproto.space.applyWrites#update", rkey: "key" }],
		});
	});
	it("stops both repository paths after the account lock signal aborts", async () => {
		for (const visibility of ["public", "private"] as const) {
			const { session, calls } = fixture();
			const abort = new AbortController();
			await watchOperation.run(
				{ did, visibility, signal: abort.signal },
				async () => {
					const repo = createWatchAgent(session).com.atproto.repo;
					abort.abort();
					await expect(
						repo.deleteRecord({ repo: did, collection, rkey: "key" }),
					).rejects.toThrow();
				},
			);
			expect(calls).toHaveLength(0);
		}
	});
	it("never downgrades a private write to public when authorization is missing", async () => {
		const { session, calls } = fixture();
		session.getTokenInfo = async () => ({ scope: "atproto" });
		await watchOperation.run(
			{ did, visibility: "private", signal: new AbortController().signal },
			async () => {
				await expect(
					createWatchAgent(session).com.atproto.repo.putRecord({
						repo: did,
						collection,
						rkey: "key",
						record: {},
					}),
				).rejects.toThrow("InsufficientScope");
			},
		);
		expect(calls).toHaveLength(0);
	});
});
