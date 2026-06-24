import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaService } from "./prisma.service";

// Mock the adapter + client so constructing the service opens no real
// connection. PrismaService has no logic of its own beyond wiring the
// DATABASE_URL into the adapter, so that is the only thing worth asserting.
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: vi.fn() }));
vi.mock("../generated/client", () => ({ PrismaClient: vi.fn() }));

describe("PrismaService", () => {
	const originalEnv = process.env.DATABASE_URL;

	beforeAll(() => {
		process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
	});
	afterAll(() => {
		process.env.DATABASE_URL = originalEnv;
	});

	it("threads DATABASE_URL into the Postgres adapter", () => {
		new PrismaService();

		expect(PrismaPg).toHaveBeenCalledWith({
			connectionString: "postgres://test:test@localhost:5432/test",
		});
	});
});
