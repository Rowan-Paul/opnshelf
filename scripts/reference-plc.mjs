// Synthetic DID resolver for the disposable reference test network only.
import { createServer } from "node:http";
const operations = new Map();
createServer(async (req, res) => {
	try {
		const url = new URL(req.url, "http://localhost:3214");
		const did = decodeURIComponent(url.pathname.split("/")[1]);
		if (!/^did:plc:[a-z2-7]{24}$/.test(did))
			throw new Error("Synthetic DID required");
		if (req.method === "POST") {
			const chunks = [];
			for await (const chunk of req) chunks.push(chunk);
			operations.set(did, JSON.parse(Buffer.concat(chunks)));
			res.end("{}");
			return;
		}
		const operation = operations.get(did);
		if (!operation) throw new Error("Unknown synthetic DID");
		const value = url.pathname.endsWith("/log/last")
			? { operation }
			: {
					"@context": ["https://www.w3.org/ns/did/v1"],
					id: did,
					alsoKnownAs: operation.alsoKnownAs,
					verificationMethod: Object.entries(operation.verificationMethods).map(
						([name, key]) => ({
							id: `${did}#${name}`,
							controller: did,
							type: "Multikey",
							publicKeyMultibase: key.slice("did:key:".length),
						}),
					),
					service: Object.entries(operation.services).map(
						([name, service]) => ({
							id: `${did}#${name}`,
							type: service.type,
							serviceEndpoint: service.endpoint,
						}),
					),
				};
		res.setHeader("Content-Type", "application/json");
		res.end(JSON.stringify(value));
	} catch {
		res.writeHead(404).end("{}");
	}
}).listen(3214, "127.0.0.1");
