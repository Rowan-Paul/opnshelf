import { validatePublicHttpUrl } from "./public-url";

describe("validatePublicHttpUrl", () => {
	it.each([
		"https://bsky.social",
		"https://pds.example.com/xrpc/com.atproto.sync.getBlob?did=x",
		"https://8.8.8.8",
		"https://[2606:4700:4700::1111]",
		"https://[64:ff9b::808:808]",
	])("accepts the public URL %s", (url) => {
		expect(validatePublicHttpUrl(url)).toBeNull();
	});

	it("rejects http unless explicitly allowed", () => {
		expect(validatePublicHttpUrl("http://pds.example.com")).toMatch(/scheme/);
		expect(
			validatePublicHttpUrl("http://pds.example.com", { allowHttp: true }),
		).toBeNull();
	});

	it.each(["ftp://pds.example.com", "file:///etc/passwd", "not a url", ""])(
		"rejects the non-http URL %j",
		(url) => {
			expect(validatePublicHttpUrl(url, { allowHttp: true })).not.toBeNull();
		},
	);

	it("rejects credentials in the URL", () => {
		expect(validatePublicHttpUrl("https://user:pw@pds.example.com")).toMatch(
			/credentials/,
		);
	});

	it.each([
		"https://localhost",
		"https://localhost.",
		"https://api.localhost",
		"https://backend.railway.internal",
		"https://metadata.internal",
		"https://printer.local",
	])("rejects the internal hostname %s", (url) => {
		expect(validatePublicHttpUrl(url)).toMatch(/hostname/);
	});

	it.each([
		"https://127.0.0.1",
		"https://127.1", // URL parser expands shorthand to 127.0.0.1
		"https://0x7f000001", // hex form of 127.0.0.1
		"https://0.0.0.0",
		"https://10.1.2.3",
		"https://172.16.0.1",
		"https://172.31.255.255",
		"https://192.168.1.1",
		"https://169.254.169.254",
		"https://100.64.0.1",
		"https://224.0.0.1",
		"https://255.255.255.255",
	])("rejects the private IPv4 address %s", (url) => {
		expect(validatePublicHttpUrl(url)).toMatch(/IPv4/);
	});

	it.each([
		"https://172.15.255.255",
		"https://172.32.0.1",
		"https://192.167.0.1",
		"https://1.1.1.1",
	])("accepts the public IPv4 address %s", (url) => {
		expect(validatePublicHttpUrl(url)).toBeNull();
	});

	it.each([
		"https://[::1]",
		"https://[::]",
		"https://[fc00::1]",
		"https://[fd12:3456::1]",
		"https://[fe80::1]",
		"https://[febf::1]",
		"https://[ff02::1]",
		"https://[::ffff:127.0.0.1]",
		"https://[::ffff:7f00:1]",
		"https://[::ffff:10.0.0.1]",
		"https://[::ffff:169.254.169.254]",
		"https://[::ffff:c0a8:101]",
		"https://[::127.0.0.1]",
	])("rejects the private IPv6 address %s", (url) => {
		expect(validatePublicHttpUrl(url)).toMatch(/IPv6/);
	});

	it.each(["https://[::ffff:8.8.8.8]", "https://[2001:db8::1]"])(
		"accepts the public IPv6 address %s",
		(url) => {
			expect(validatePublicHttpUrl(url)).toBeNull();
		},
	);
});
