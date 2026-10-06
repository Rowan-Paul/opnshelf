// Real, isolated local stack. No account/session/API mocks and no hosted .env.
import { spawn, spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	writeFileSync,
	readFileSync,
	openSync,
	closeSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const state = resolve(
	process.env.OPNSHELF_SPACES_STATE_DIR ||
		join(homedir(), ".local/share/opnshelf-spaces"),
);
const source = resolve(
	process.env.TRANQUIL_SOURCE || join(root, "../tranquil-pds"),
);
const target = resolve(process.env.CARGO_TARGET_DIR || join(source, "target"));
const cert = join(state, "pds.pem");
const key = join(state, "pds-key.pem");
const config = join(state, "pds.toml");
const command = process.argv[2] || "start";
const env = {
	HOME: homedir(),
	PATH: `${join(homedir(), ".cargo/bin")}:${process.env.PATH}`,
	TMPDIR: process.env.TMPDIR || "/tmp",
	OPNSHELF_SPACES_STATE_DIR: state,
	DOTENV_CONFIG_PATH: "/dev/null",
	NODE_EXTRA_CA_CERTS: cert,
};
const compose = [
	"compose",
	"--env-file",
	"/dev/null",
	"-f",
	join(root, "scripts/local-spaces/compose.yaml"),
];
const children = new Set();
let stopping = false;

function run(bin, args, cwd = root, extra = {}) {
	const result = spawnSync(bin, args, {
		cwd,
		env: { ...env, ...extra },
		stdio: "inherit",
	});
	if (result.error || result.status !== 0)
		throw new Error(`${bin} ${args[0]} failed`);
}
function start(name, bin, args, cwd, extra = {}) {
	const log = openSync(join(state, `${name}.log`), "a", 0o600);
	const child = spawn(bin, args, {
		cwd,
		env: { ...env, ...extra },
		stdio: ["ignore", log, log],
		detached: process.platform !== "win32",
	});
	closeSync(log);
	children.add(child);
	child.on("error", () => {
		console.error(`${name} failed to start; see ${state}/${name}.log`);
		shutdown(1);
	});
	child.on("exit", (code) => {
		children.delete(child);
		if (!stopping) {
			console.error(`${name} exited (${code}); see ${state}/${name}.log`);
			shutdown(1);
		}
	});
	return child;
}
function shutdown(code = 0) {
	if (stopping) return;
	stopping = true;
	for (const child of children) {
		try {
			process.platform === "win32"
				? child.kill("SIGTERM")
				: process.kill(-child.pid, "SIGTERM");
		} catch {
			/* Already stopped. */
		}
	}
	process.exitCode = code;
	console.log(
		"Local application processes stopped. Data and Docker services are retained; use pnpm dev:spaces:stop to stop services.",
	);
}
process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());

function pdsRequest(path, body) {
	return new Promise((accept, reject) => {
		const request = https.request(
			new URL(path, "https://pds.127.0.0.1.nip.io"),
			{
				ca: readFileSync(cert),
				method: body ? "POST" : "GET",
				headers: body ? { "content-type": "application/json" } : {},
			},
			(response) => {
				let data = "";
				response.on("data", (part) => {
					data += part;
				});
				response.on("end", () => {
					try {
						accept({ status: response.statusCode, data: JSON.parse(data) });
					} catch {
						reject(new Error("Invalid local PDS response"));
					}
				});
			},
		);
		request.setTimeout(5000, () =>
			request.destroy(new Error("Local PDS request timed out")),
		);
		request.on("error", reject);
		request.end(body ? JSON.stringify(body) : undefined);
	});
}
async function waitFor(check, label) {
	for (let attempt = 0; attempt < 120 && !stopping; attempt++) {
		try {
			if (await check()) return;
		} catch {
			/* The service is still starting. */
		}
		await new Promise((done) => setTimeout(done, 500));
	}
	throw new Error(`${label} did not become ready`);
}

async function main() {
	if (command === "stop") {
		run("docker", [...compose, "stop"]);
		return;
	}
	mkdirSync(state, { recursive: true, mode: 0o700 });
	// Both applications auto-load .env. Keep their runtime cwd isolated and empty.
	if (!existsSync(join(state, ".env")))
		writeFileSync(join(state, ".env"), "", { mode: 0o600 });
	if (!existsSync(join(source, "crates/tranquil-server")))
		throw new Error(
			"Set TRANQUIL_SOURCE to your Spaces-enabled Tranquil checkout",
		);
	if (command === "setup") {
		if (!existsSync(cert) || !existsSync(key)) {
			run("openssl", [
				"req",
				"-x509",
				"-newkey",
				"rsa:2048",
				"-sha256",
				"-nodes",
				"-days",
				"30",
				"-keyout",
				key,
				"-out",
				cert,
				"-subj",
				"/CN=Opnshelf Local PDS",
				"-addext",
				"subjectAltName=DNS:pds.127.0.0.1.nip.io,DNS:*.pds.127.0.0.1.nip.io",
			]);
			run("chmod", ["600", key]);
		}
		if (process.platform === "darwin") {
			const trusted =
				spawnSync(
					"security",
					[
						"verify-cert",
						"-c",
						cert,
						"-p",
						"ssl",
						"-s",
						"pds.127.0.0.1.nip.io",
					],
					{ env, stdio: "ignore" },
				).status === 0;
			if (!trusted)
				run("security", [
					"add-trusted-cert",
					"-r",
					"trustRoot",
					"-k",
					join(homedir(), "Library/Keychains/login.keychain-db"),
					cert,
				]);
		} else {
			console.log(
				`Trust ${cert} in your browser and system certificate store before starting the PDS.`,
			);
		}
		run("docker", [...compose, "up", "-d", "--wait", "db", "plc", "mail"]);
		run(
			"pnpm",
			["install", "--frozen-lockfile", "--ignore-scripts"],
			join(source, "frontend"),
		);
		run("pnpm", ["build"], join(source, "frontend"), {
			VITE_OPNSHELF_SIGNUP_URL: "http://127.0.0.1:3000/signup",
		});
		run(
			"cargo",
			[
				"build",
				"--locked",
				"-p",
				"tranquil-server",
				"--features",
				"native-tls-roots",
			],
			source,
			{ SQLX_OFFLINE: "true", CARGO_TARGET_DIR: target },
		);
		run(
			"pnpm",
			["--filter", "backend", "exec", "prisma", "migrate", "deploy"],
			root,
			{ DATABASE_URL: "postgresql://postgres@127.0.0.1:55432/opnshelf_spaces" },
		);
		run("pnpm", ["--filter", "backend", "run", "build"]);
		writeFileSync(
			config,
			`[server]
hostname = "pds.127.0.0.1.nip.io"
host = "127.0.0.1"
port = 3443
user_handle_domains = ["pds.127.0.0.1.nip.io"]
allow_http_proxy = true
allow_private_fetch = true
invite_code_required = false
disable_rate_limiting = true
enable_atproto_spaces = true
[server.tls]
cert_path = ${JSON.stringify(cert)}
key_path = ${JSON.stringify(key)}
[frontend]
enabled = true
dir = ${JSON.stringify(join(source, "frontend/dist"))}
[database]
url = "postgres://postgres@127.0.0.1:55432/tranquil_spaces"
min_connections = 2
max_connections = 10
[storage]
path = ${JSON.stringify(join(state, "blobs"))}
[plc]
directory_url = "http://127.0.0.1:2582"
[firehose]
crawlers = []
[email]
from_address = "noreply@pds.127.0.0.1.nip.io"
from_name = "Opnshelf Local PDS"
[email.smarthost]
host = "127.0.0.1"
port = 1025
tls = "none"
[secrets]
allow_insecure = true
`,
		);
		console.log(
			"Setup complete. Run pnpm dev:spaces with the same TRANQUIL_SOURCE and CARGO_TARGET_DIR.",
		);
		return;
	}
	if (command !== "start") throw new Error("Use setup, start or stop");
	if (!existsSync(config)) throw new Error("Run pnpm dev:spaces:setup first");
	// Refuse to mistake an existing process for one owned by this stack.
	for (const port of [3000, 3102, 3443, 8083]) {
		const { createServer } = await import("node:net");
		await new Promise((accept, reject) => {
			const server = createServer();
			server.once("error", () =>
				reject(new Error(`Port ${port} is occupied; stop its owner first`)),
			);
			server.listen(port, "127.0.0.1", () => server.close(accept));
		});
	}
	run("docker", [...compose, "up", "-d", "--wait", "db", "plc", "mail"]);
	start(
		"pds",
		join(target, "debug/tranquil-server"),
		["--config", config],
		state,
		{
			RUST_LOG: "warn",
			PROTOCOL_DNS_SERVER:
				process.env.OPNSHELF_SPACES_DNS_SERVER || "1.1.1.1:53",
		},
	);
	run("docker", [...compose, "up", "-d", "gateway"]);
	await waitFor(
		async () =>
			(await pdsRequest("/xrpc/com.atproto.server.describeServer")).status ===
			200,
		"PDS",
	);
	// Provision a local operator, not an application login. Browser users sign up
	// and verify email normally. These public development credentials are local-only.
	const adminPassword = "Local-only-admin-password-1-not-for-production";
	const existing = await pdsRequest("/xrpc/com.atproto.server.createSession", {
		identifier: "localadmin.pds.127.0.0.1.nip.io",
		password: adminPassword,
	});
	const account =
		existing.status === 200
			? existing
			: await pdsRequest("/xrpc/com.atproto.server.createAccount", {
					handle: "localadmin.pds.127.0.0.1.nip.io",
					email: "admin@pds.127.0.0.1.nip.io",
					password: adminPassword,
				});
	if (account.status !== 200)
		throw new Error(`Local operator creation failed (${account.data.error})`);
	run("docker", [
		...compose,
		"exec",
		"-T",
		"db",
		"psql",
		"-U",
		"postgres",
		"-d",
		"tranquil_spaces",
		"-c",
		"UPDATE users SET is_admin = true, email_verified = true WHERE handle = 'localadmin.pds.127.0.0.1.nip.io';",
	]);
	run("docker", [...compose, "up", "-d", "tab"]);
	start(
		"backend",
		process.execPath,
		[join(root, "backend/dist/src/main.js")],
		state,
		{
			NODE_ENV: "development",
			DATABASE_URL: "postgresql://postgres@127.0.0.1:55432/opnshelf_spaces",
			ENABLE_ATPROTO_SPACES: "true",
			HOST: "127.0.0.1",
			PORT: "3102",
			BACKEND_PUBLIC_URL: "http://127.0.0.1:3102",
			FRONTEND_URL: "http://127.0.0.1:3000",
			PDS_URL: "https://pds.127.0.0.1.nip.io",
			PDS_HANDLE_DOMAIN: "pds.127.0.0.1.nip.io",
			PLC_DIRECTORY_URL: "http://127.0.0.1:2582",
			HANDLE_RESOLVER_URL: "https://pds.127.0.0.1.nip.io",
			TAB_URL: "http://127.0.0.1:2481",
			PDS_ADMIN_IDENTIFIER: "localadmin.pds.127.0.0.1.nip.io",
			PDS_ADMIN_PASSWORD: adminPassword,
		},
	);
	await waitFor(
		async () => (await fetch("http://127.0.0.1:3102/auth/me")).status === 401,
		"Backend",
	);
	start(
		"web",
		"pnpm",
		["--filter", "web", "dev", "--host", "127.0.0.1"],
		root,
		{
			VITE_API_URL: "http://127.0.0.1:3102",
			VITE_PDS_HANDLE_DOMAIN: "pds.127.0.0.1.nip.io",
		},
	);
	start(
		"mobile",
		"pnpm",
		["--filter", "mobile", "start", "--dev-client", "--port", "8083", "--lan"],
		root,
		{
			EXPO_NO_DOTENV: "1",
			REACT_NATIVE_PACKAGER_HOSTNAME: "127.0.0.1",
			EXPO_PUBLIC_API_URL: "http://127.0.0.1:3102",
			EXPO_PUBLIC_PDS_HANDLE_DOMAIN: "pds.127.0.0.1.nip.io",
		},
	);
	await waitFor(
		async () => (await fetch("http://127.0.0.1:3000/signup")).ok,
		"Web",
	);
	await waitFor(
		async () => (await fetch("http://127.0.0.1:8083/status")).ok,
		"Metro",
	);
	console.log(
		`Ready: http://127.0.0.1:3000/signup\nEmail inbox: http://127.0.0.1:8025\nPDS: https://pds.127.0.0.1.nip.io\nLogs: ${state}\nCtrl-C stops application processes and keeps local data.`,
	);
}
main().catch((error) => {
	console.error(error.message);
	shutdown(1);
});
