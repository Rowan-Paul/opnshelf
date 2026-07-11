import { rebaseAvatarUrl } from "./avatar-url";

describe("rebaseAvatarUrl", () => {
	const OLD_ENV = process.env.BACKEND_PUBLIC_URL;

	beforeEach(() => {
		process.env.BACKEND_PUBLIC_URL = "https://api.example.com";
	});

	afterEach(() => {
		process.env.BACKEND_PUBLIC_URL = OLD_ENV;
	});

	it("re-bases stored proxy URLs onto the current public URL", () => {
		expect(
			rebaseAvatarUrl(
				"https://stale-tunnel.trycloudflare.com/users/avatar?did=did%3Aplc%3Aabc&cid=bafy123",
			),
		).toBe(
			"https://api.example.com/users/avatar?did=did%3Aplc%3Aabc&cid=bafy123",
		);
	});

	it("leaves external avatar URLs untouched", () => {
		expect(rebaseAvatarUrl("https://cdn.bsky.app/img/avatar/plain/x.jpg")).toBe(
			"https://cdn.bsky.app/img/avatar/plain/x.jpg",
		);
	});

	it("passes through null and unparseable values", () => {
		expect(rebaseAvatarUrl(null)).toBeNull();
		expect(rebaseAvatarUrl("not a url")).toBe("not a url");
	});
});
