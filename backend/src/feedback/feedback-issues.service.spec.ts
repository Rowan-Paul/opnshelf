import { mockEnvironment } from "../../test/env";
import { FeedbackIssuesService } from "./feedback-issues.service";

describe("feedback GitHub delivery", () => {
	const fetchMock = vi.fn();
	const config = {
		FEEDBACK_GITHUB_TOKEN: "test-token",
		BACKEND_PUBLIC_URL: "https://api.example.com",
		FEEDBACK_GITHUB_REPOSITORY: "example/feedback",
	};

	beforeEach(() => {
		fetchMock.mockReset().mockResolvedValue({ ok: true });
		vi.stubGlobal("fetch", fetchMock);
	});
	afterEach(() => vi.unstubAllGlobals());

	it.each(["bug", "feature_request"] as const)(
		"creates a %s issue",
		async (category) => {
			const service = new FeedbackIssuesService(mockEnvironment(config));
			await service.createIssue("feedback-id", {
				category,
				message: "First line\n@someone\n```\n# More detail",
				pageUrl:
					"https://user:password@example.com/search?token=secret#private",
			});
			expect(fetchMock).toHaveBeenCalledOnce();
			const [url, options] = fetchMock.mock.calls[0];
			expect(url).toBe("https://api.github.com/repos/example/feedback/issues");
			expect(options.method).toBe("POST");
			expect(options.headers.Authorization).toBe("Bearer test-token");
			const issue = JSON.parse(options.body);
			expect(issue.title).toBe(
				`${category === "bug" ? "Bug report" : "Feature request"}: First line`,
			);
			expect(issue.labels).toEqual([
				"needs-triage",
				category === "bug" ? "bug" : "enhancement",
			]);
			expect(issue.body).toContain("    @someone\n    ```\n    # More detail");
			expect(issue.body).toContain("    https://example.com/search");
			expect(issue.body).not.toMatch(/password|token=|private/);
			expect(issue.body).toContain("Feedback ID: feedback-id");
		},
	);

	it("embeds a saved screenshot using the public API URL", async () => {
		await new FeedbackIssuesService(mockEnvironment(config)).createIssue(
			"feedback-id",
			{
				category: "bug",
				message: "Test",
				screenshot: "/9j/2Q==",
			},
		);
		const body = JSON.parse(fetchMock.mock.calls[0][1].body).body;
		expect(body).toContain(
			"![Screenshot submitted with feedback](https://api.example.com/feedback/feedback-id/screenshot)",
		);
		expect(body).not.toContain("/9j/");
	});

	it("skips delivery without configuration", async () => {
		await new FeedbackIssuesService(mockEnvironment()).createIssue("id", {
			category: "bug",
			message: "Test",
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it.each([403, 429, 500])(
		"does not reject saved feedback on HTTP %s",
		async (status) => {
			fetchMock.mockResolvedValue({ ok: false, status });
			await expect(
				new FeedbackIssuesService(mockEnvironment(config)).createIssue("id", {
					category: "bug",
					message: "Test",
				}),
			).resolves.toBeUndefined();
		},
	);

	it("does not reject saved feedback on network failure", async () => {
		fetchMock.mockRejectedValue(new Error("Network failure"));
		await expect(
			new FeedbackIssuesService(mockEnvironment(config)).createIssue("id", {
				category: "bug",
				message: "Test",
			}),
		).resolves.toBeUndefined();
	});

	it("bounds the title and tolerates a URL without a scheme", async () => {
		await new FeedbackIssuesService(mockEnvironment(config)).createIssue("id", {
			category: "bug",
			message: "x".repeat(5000),
			pageUrl: "example.com",
		});
		expect(JSON.parse(fetchMock.mock.calls[0][1].body).title).toHaveLength(160);
	});
});
