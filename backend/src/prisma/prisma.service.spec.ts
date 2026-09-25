const { env } = vi.hoisted(() => ({
	env: { DATABASE_URL: undefined as string | undefined },
}));
vi.mock("../config/env", () => ({ env }));
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaService } from "./prisma.service";

// Mock the adapter + client so constructing the service opens no real
// connection. PrismaService has no logic of its own beyond wiring the
// DATABASE_URL into the adapter, so that is the only thing worth asserting.
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("../generated/client", () => ({ PrismaClient: vi.fn() }));

describe("PrismaService", () => {
	const originalEnv = env.DATABASE_URL;

	beforeAll(() => {
		env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
	});
	afterAll(() => {
		env.DATABASE_URL = originalEnv;
	});

	it("uses a deliberately small pool for the shared production database", () => {
		new PrismaService();

		expect(PrismaPg).toHaveBeenCalledWith({
			connectionString: "postgres://test:test@localhost:5432/test",
			max: 3,
			idleTimeoutMillis: 10_000,
			connectionTimeoutMillis: 5_000,
		});
	});
});
