import { describe, expect, it, vi } from "vitest";
import {
	isExternalWebUrl,
	isTrustedEditorUrl,
	openExternalWebUrl,
	trustedEditorOrigin,
	trustedEditorUrl,
} from "./safe-links";

describe("isExternalWebUrl", () => {
	it.each([
		"https://example.com/review",
		"http://example.com/review",
		"HTTPS://EXAMPLE.COM/review",
	])("allows public HTTP(S) URL %s", (url) => {
		expect(isExternalWebUrl(url)).toBe(true);
	});

	it.each([
		"javascript:alert(1)",
		"data:text/html,hello",
		"file:///etc/passwd",
		"opnshelf://review/1",
		"//example.com/review",
		"not a url",
		"",
	])("rejects non-web or malformed URL %s", (url) => {
		expect(isExternalWebUrl(url)).toBe(false);
	});

	it("only invokes the platform opener for an allowed URL", async () => {
		const openUrl = vi.fn().mockResolvedValue(undefined);

		openExternalWebUrl("https://example.com/review", openUrl);
		openExternalWebUrl("javascript:alert(1)", openUrl);
		openExternalWebUrl("opnshelf://review/1", openUrl);

		expect(openUrl).toHaveBeenCalledOnce();
		expect(openUrl).toHaveBeenCalledWith("https://example.com/review");
	});

	it("swallows platform failures", async () => {
		const openUrl = vi.fn().mockRejectedValue(new Error("not supported"));
		openExternalWebUrl("https://example.com/review", openUrl);
		await Promise.resolve();
		expect(openUrl).toHaveBeenCalledOnce();
	});
});

describe("editor URL policy", () => {
	const siteUrl = "https://OpnShelf.xyz/";

	it("normalizes the configured origin and builds the editor route", () => {
		expect(trustedEditorOrigin(siteUrl)).toBe("https://opnshelf.xyz");
		expect(trustedEditorUrl(siteUrl, "dark")).toBe(
			"https://opnshelf.xyz/embed/review-editor?theme=dark",
		);
	});

	it.each([
		"https://opnshelf.xyz/embed/review-editor",
		"HTTPS://OPNSHELF.XYZ/embed/review-editor?theme=dark",
		"https://opnshelf.xyz/embed/review-editor?theme=light#selection",
	])("allows the exact trusted editor route %s", (url) => {
		expect(isTrustedEditorUrl(url, siteUrl)).toBe(true);
	});

	it.each([
		"http://opnshelf.xyz/embed/review-editor",
		"https://evil.example/embed/review-editor",
		"https://opnshelf.xyz.evil.example/embed/review-editor",
		"https://editor.opnshelf.xyz/embed/review-editor",
		"https://opnshelf.xyz/embed/review-editor/preview",
		"https://opnshelf.xyz/embed/other",
		"https://user@opnshelf.xyz/embed/review-editor",
		"//opnshelf.xyz/embed/review-editor",
		"not a url",
	])("rejects an untrusted editor URL %s", (url) => {
		expect(isTrustedEditorUrl(url, siteUrl)).toBe(false);
	});

	it.each([
		"https://opnshelf.xyz/prefix",
		"https://user@opnshelf.xyz",
		"javascript:alert(1)",
		"//opnshelf.xyz",
		"not a url",
	])("fails closed for an ambiguous site URL %s", (url) => {
		expect(trustedEditorOrigin(url)).toBeNull();
		expect(trustedEditorUrl(url, "dark")).toBeNull();
		expect(
			isTrustedEditorUrl("https://opnshelf.xyz/embed/review-editor", url),
		).toBe(false);
	});
});
