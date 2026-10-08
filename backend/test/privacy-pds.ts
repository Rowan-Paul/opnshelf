import { createHash } from "node:crypto";
import type { PrivacyRepositoryConfig } from "../src/privacy/privacy-category";
export function privacyPdsFixture(
	did: string,
	config: PrivacyRepositoryConfig,
) {
	const publicRecords = new Map<
		string,
		{ cid: string; value: Record<string, unknown> }
	>();
	const privateRecords = new Map<
		string,
		{ cid: string; value: Record<string, unknown> }
	>();
	let hasSpace = false;
	let supportsDelete = true;
	let failDelete = false;
	const policy = { $type: "com.atproto.simplespace.defs#memberListPolicy" };
	const cid = (value: unknown) =>
		createHash("sha256").update(JSON.stringify(value)).digest("hex");
	const session = {
		did,
		getTokenInfo: async () => ({ scope: config.scope }),
		fetchHandler: async (path: string, init?: RequestInit) => {
			const endpoint = new URL(path, "http://local.test");
			const params = init?.body
				? JSON.parse(String(init.body))
				: Object.fromEntries(endpoint.searchParams);
			const method = endpoint.pathname.split(".").at(-1);
			const space = `at://${did}/space/${config.spaceType}/${config.skey}`;
			const isPrivate = endpoint.pathname.includes(".space.");
			const records = isPrivate ? privateRecords : publicRecords;
			const key = `${params.collection}/${params.rkey}`;
			const uri = (key: string) =>
				isPrivate ? `${space}/${did}/${key}` : `at://${did}/${key}`;
			const respond = (body: unknown, status = 200) =>
				new Response(JSON.stringify(body), { status });
			if (method === "describeServer")
				return respond({
					tranquilSpaceCapabilities: supportsDelete
						? ["deleteRecord.swapRecord.v1"]
						: [],
				});
			if (method === "createSpace") {
				hasSpace = true;
				return respond({});
			}
			if (method === "getSpace")
				return hasSpace
					? respond({ readPolicy: policy, writePolicy: policy })
					: respond({ error: "SpaceNotFound" }, 400);
			if (method === "listMembers") return respond({ members: [] });
			if (method === "listRecords")
				return respond({
					records: [...records]
						.filter(([key]) => key.startsWith(`${params.collection}/`))
						.slice(0, Number(params.limit))
						.map(([key, record]) => ({
							...(isPrivate
								? { collection: key.split("/")[0], rkey: key.split("/")[1] }
								: { uri: uri(key) }),
							...record,
						})),
				});
			if (method === "getRecord")
				return records.has(key)
					? respond({ uri: uri(key), ...records.get(key) })
					: respond({ error: "RecordNotFound" }, 400);
			if (method === "createRecord") {
				if (records.has(key))
					return respond({ error: "RecordAlreadyExists" }, 400);
				records.set(key, { cid: cid(params.record), value: params.record });
				return respond({ uri: uri(key), cid: records.get(key)?.cid });
			}
			if (method === "deleteRecord") {
				if (failDelete) {
					failDelete = false;
					return respond({ error: "InternalError" }, 500);
				}
				if (!isPrivate && records.get(key)?.cid !== params.swapRecord)
					return respond({ error: "InvalidSwap" }, 400);
				records.delete(key);
				return respond({});
			}
			throw new Error(`Unexpected test method ${method}`);
		},
	};
	return {
		session,
		publicRecords,
		privateRecords,
		seed(collection: string, rkey: string, value: Record<string, unknown>) {
			publicRecords.set(`${collection}/${rkey}`, { cid: cid(value), value });
		},
		failNextDelete() {
			failDelete = true;
		},
		disableConditionalDelete() {
			supportsDelete = false;
		},
	};
}
