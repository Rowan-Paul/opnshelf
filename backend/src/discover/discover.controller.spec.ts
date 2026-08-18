import { Test, type TestingModule } from "@nestjs/testing";

vi.mock("../auth/auth.guard", () => ({
	AuthGuard: class MockAuthGuard {
		canActivate() {
			return true;
		}
	},
}));

import { DiscoverController } from "./discover.controller";
import { DiscoverService } from "./discover.service";

describe("DiscoverController", () => {
	it("forwards onboarding deck requests to the service", async () => {
		const expected = { results: [{ id: 1, media_type: "movie" }] };
		const discoverService = { onboarding: vi.fn().mockResolvedValue(expected) };
		const module: TestingModule = await Test.createTestingModule({
			controllers: [DiscoverController],
			providers: [{ provide: DiscoverService, useValue: discoverService }],
		}).compile();

		const result = await module.get(DiscoverController).onboarding();

		expect(result).toBe(expected);
		expect(discoverService.onboarding).toHaveBeenCalledOnce();
	});
});
