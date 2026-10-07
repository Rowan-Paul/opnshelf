import { ContentPrivacyGuard } from "./content-privacy.guard";
import { ContentPrivacyCoordinator } from "./content-privacy-coordinator";
import { ContentPrivacyInterceptor } from "./content-privacy.interceptor";
import { PrismaModule } from "../prisma/prisma.module";
import { WatchWriteInterceptor } from "./watch-operation";
import {
	Global,
	Injectable,
	Module,
	type OnModuleDestroy,
} from "@nestjs/common";
import { Pool } from "pg";
import { env } from "../config/env";
import { PrismaService } from "../prisma/prisma.service";
import { WatchAccountLock } from "./watch-account-lock";
import { WatchPrivacyCoordinator } from "./watch-privacy-coordinator";
import { WatchReadGuard } from "./watch-access";

@Injectable()
class WatchLockPool extends Pool implements OnModuleDestroy {
	constructor() {
		super({
			connectionString: env.DATABASE_URL,
			max: 2,
			idleTimeoutMillis: 10000,
			connectionTimeoutMillis: 5000,
			query_timeout: 5000,
		});
	}
	async onModuleDestroy() {
		await this.end();
	}
}
@Global()
@Module({
	imports: [PrismaModule],
	providers: [
		ContentPrivacyGuard,
		ContentPrivacyCoordinator,
		ContentPrivacyInterceptor,
		WatchLockPool,
		WatchReadGuard,
		WatchWriteInterceptor,
		{
			provide: WatchAccountLock,
			inject: [WatchLockPool],
			useFactory: (pool: WatchLockPool) => new WatchAccountLock(pool),
		},
		{
			provide: WatchPrivacyCoordinator,
			inject: [PrismaService, WatchAccountLock],
			useFactory: (prisma: PrismaService, lock: WatchAccountLock) =>
				new WatchPrivacyCoordinator(prisma, lock),
		},
	],
	exports: [
		ContentPrivacyGuard,
		ContentPrivacyCoordinator,
		ContentPrivacyInterceptor,
		WatchAccountLock,
		WatchPrivacyCoordinator,
		WatchReadGuard,
		WatchWriteInterceptor,
	],
})
export class WatchPrivacyModule {}
