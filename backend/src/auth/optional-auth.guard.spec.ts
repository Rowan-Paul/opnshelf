import type { ExecutionContext } from "@nestjs/common";
import { UnauthorizedException } from "@nestjs/common";
import type { AuthGuard } from "./auth.guard";
import { OptionalAuthGuard } from "./optional-auth.guard";

describe("OptionalAuthGuard", () => {
	const context = {} as ExecutionContext;

	const createGuard = (canActivate: () => Promise<boolean>) =>
		new OptionalAuthGuard({ canActivate } as unknown as AuthGuard);

	it("passes through when the underlying AuthGuard accepts the session", async () => {
		const guard = createGuard(async () => true);

		await expect(guard.canActivate(context)).resolves.toBe(true);
	});

	it("allows the request through anonymously on UnauthorizedException", async () => {
		const guard = createGuard(async () => {
			throw new UnauthorizedException("No session");
		});

		await expect(guard.canActivate(context)).resolves.toBe(true);
	});

	it("propagates non-auth failures instead of downgrading to anonymous", async () => {
		const failure = new Error("db down");
		const guard = createGuard(async () => {
			throw failure;
		});

		await expect(guard.canActivate(context)).rejects.toBe(failure);
	});
});
