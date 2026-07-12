import {
	Injectable,
	type OnModuleDestroy,
	type OnModuleInit,
} from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client";

@Injectable()
export class PrismaService
	extends PrismaClient
	implements OnModuleInit, OnModuleDestroy
{
	constructor() {
		super({
			adapter: new PrismaPg({
				connectionString: process.env.DATABASE_URL,
				// Railway's Postgres connection budget is shared with the PDS and
				// deployment overlap. A large Trakt import plus the dashboard's
				// parallel queries could otherwise exhaust it for every request.
				max: 3,
				idleTimeoutMillis: 10_000,
				connectionTimeoutMillis: 5_000,
			}),
		});
	}

	async onModuleInit() {
		await this.$connect();
	}

	async onModuleDestroy() {
		await this.$disconnect();
	}
}
