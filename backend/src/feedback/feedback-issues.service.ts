import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CreateFeedbackDto } from "./dto/feedback.dto";

@Injectable()
export class FeedbackIssuesService {
	private readonly logger = new Logger(FeedbackIssuesService.name);

	constructor(private readonly config: ConfigService) {}

	async createIssue(id: string, dto: CreateFeedbackDto): Promise<void> {
		const token = this.config.get<string>("FEEDBACK_GITHUB_TOKEN");
		const repository = this.config.get<string>("FEEDBACK_GITHUB_REPOSITORY");
		if (!token || !repository) {
			this.logger.warn(
				`Feedback ${id} saved; GitHub delivery is not configured`,
			);
			return;
		}
		if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) {
			this.logger.error(
				`Feedback ${id} saved; invalid GitHub repository configuration`,
			);
			return;
		}

		const category = dto.category === "bug" ? "Bug report" : "Feature request";
		// Indented code blocks keep submitted Markdown and @mentions inert.
		const message = dto.message
			.split("\n")
			.map((line) => `    ${line}`)
			.join("\n");
		const body = [`${category} submitted through Opnshelf.`, "", message];
		if (dto.pageUrl && URL.canParse(dto.pageUrl)) {
			// Never publish URL credentials, query parameters or fragments.
			const url = new URL(dto.pageUrl);
			body.push("", "Page:", "", `    ${url.origin}${url.pathname}`);
		}
		body.push("", `Feedback ID: ${id}`);

		try {
			const response = await fetch(
				`https://api.github.com/repos/${repository}/issues`,
				{
					method: "POST",
					headers: {
						Accept: "application/vnd.github+json",
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
						"X-GitHub-Api-Version": "2026-03-10",
					},
					body: JSON.stringify({
						title:
							`${category}: ${dto.message.trim().split(/\r?\n/)[0] || "Feedback"}`.slice(
								0,
								160,
							),
						body: body.join("\n"),
						labels: [
							"needs-triage",
							dto.category === "bug" ? "bug" : "enhancement",
						],
					}),
					signal: AbortSignal.timeout(10_000),
				},
			);
			if (!response.ok) {
				this.logger.error(
					`Feedback ${id} saved; GitHub delivery failed (HTTP ${response.status})`,
				);
			}
		} catch {
			this.logger.error(`Feedback ${id} saved; GitHub delivery failed`);
		}
	}
}
