import { Inject, Injectable, Logger } from "@nestjs/common";
import { AUTH_SERVICE } from "../auth/auth.tokens";
import type { AuthService } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { PrivateSettingsService } from "../pds/private-settings.service";

@Injectable()
export class RetiredSettingsCleanup {
	private nextAttempt = 0;
	private readonly deferred = new Map<string, number>();
	private readonly logger = new Logger(RetiredSettingsCleanup.name);
	constructor(
		private readonly prisma: PrismaService,
		private readonly settings: PrivateSettingsService,
		@Inject(AUTH_SERVICE) private readonly auth: Pick<AuthService, "restore">,
	) {}
	async tick() {
		if (Date.now() < this.nextAttempt) return;
		this.nextAttempt = Date.now() + 60000;
		const users = await this.prisma.user.findMany({
			where: {
				OR: [
					{ privateSettingsHasCopy: true },
					{ privateSettingsEnabled: true },
				],
			},
			select: { did: true },
		});
		for (const user of users) {
			if ((this.deferred.get(user.did) ?? 0) > Date.now()) continue;
			try {
				const session = await this.auth.restore(user.did);
				if (!session || !(await this.settings.canDelete(session))) {
					this.deferred.set(user.did, Date.now() + 60 * 60 * 1000);
					continue;
				}
				await this.settings.delete(user.did, session);
				this.deferred.delete(user.did);
				await this.prisma.user.update({
					where: { did: user.did },
					data: {
						privateSettingsHasCopy: false,
						privateSettingsEnabled: false,
					},
				});
			} catch {
				this.logger.warn(
					"Retired Settings cleanup will retry for an unavailable account.",
				);
			}
		}
	}
}
