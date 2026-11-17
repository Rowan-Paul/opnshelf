import { NotFoundException } from "@nestjs/common";
import { expect, it, vi } from "vitest";
import { IntegrationApiController } from "./integration-api.controller";

const req = { user: { did: "did:plc:fixture" } } as never;
function fixture() {
	const service = () => ({
		status: vi.fn(async () => ({})),
		connectRequest: vi.fn(async () => ({})),
		resolveIssue: vi.fn(async () => ({})),
		listIssues: vi.fn(async () => ({})),
	});
	const services = {
		trakt: service(),
		popfeed: service(),
		bingers: service(),
	};
	const controller = new IntegrationApiController(
		services.trakt as never,
		services.popfeed as never,
		services.bingers as never,
	);
	return { controller, services };
}

it.each(["trakt", "popfeed", "bingers"] as const)(
	"sends %s requests to that provider with the shared request shape",
	async (provider) => {
		const f = fixture();
		await f.controller.status(req, provider);
		await f.controller.connect(req, provider, { platform: "web" });
		await f.controller.resolve(req, provider, "item", { action: "remote" });
		await f.controller.issues(req, provider, { view: "attention" });
		const service = f.services[provider];
		expect(service.status).toHaveBeenCalledWith("did:plc:fixture");
		expect(service.connectRequest).toHaveBeenCalledWith(
			"did:plc:fixture",
			"web",
			undefined,
		);
		// Trakt takes the shared "remote" choice here, not its own "trakt".
		expect(service.resolveIssue).toHaveBeenCalledWith(
			"did:plc:fixture",
			"item",
			{ action: "remote" },
		);
		expect(service.listIssues).toHaveBeenCalledWith("did:plc:fixture", {
			view: "attention",
		});
		for (const [other, mock] of Object.entries(f.services))
			if (other !== provider) expect(mock.status).not.toHaveBeenCalled();
	},
);

it.each(["letterboxd", "constructor", "__proto__"])(
	"answers 404 for the unknown provider %s",
	(provider) => {
		expect(() => fixture().controller.status(req, provider)).toThrow(
			NotFoundException,
		);
	},
);
