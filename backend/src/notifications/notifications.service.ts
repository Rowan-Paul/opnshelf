import { sendPushNotification } from "./send-push";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import {
	BadRequestException,
	Injectable,
	ServiceUnavailableException,
} from "@nestjs/common";
import { EmailService } from "../email/email.service";
import { PrismaService } from "../prisma/prisma.service";
import type {
	RegisterPushDeviceDto,
	UpdateNotificationSettingsDto,
} from "./notifications.dto";

const EMAIL_CODE_LIFETIME_MS = 10 * 60_000;
const EMAIL_CODE_MAX_ATTEMPTS = 5;

@Injectable()
export class NotificationsService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly email: EmailService,
	) {}

	private ensureSettings(did: string) {
		return this.prisma.notificationSettings.upsert({
			where: { userDid: did },
			create: { userDid: did },
			update: {},
		});
	}

	async getSettings(did: string) {
		const [settings, pushDeviceCount] = await Promise.all([
			this.ensureSettings(did),
			this.prisma.pushDevice.count({ where: { userDid: did } }),
		]);
		return {
			email: settings.email,
			emailVerified: !!settings.emailVerifiedAt,
			pushDeviceCount,
			pushNewReleases: settings.pushNewReleases,
			pushWatchlistReleases: settings.pushWatchlistReleases,
			pushNewSeasons: settings.pushNewSeasons,
			pushStats: settings.pushStats,
			emailNewReleases: settings.emailNewReleases,
			emailWatchlistReleases: settings.emailWatchlistReleases,
			emailNewSeasons: settings.emailNewSeasons,
			emailStats: settings.emailStats,
		};
	}

	async updateSettings(did: string, patch: UpdateNotificationSettingsDto) {
		await this.prisma.notificationSettings.upsert({
			where: { userDid: did },
			create: { userDid: did, ...patch },
			update: { ...patch, nextQueueAt: new Date() },
		});
		return this.getSettings(did);
	}

	async requestEmail(did: string, rawEmail: string): Promise<void> {
		const email = rawEmail.trim().toLowerCase();
		const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
		// Send first. A provider outage must not replace a valid pending code.
		await this.email.sendNotification({
			to: email,
			subject: "Confirm your Opnshelf notification email",
			text: `Your Opnshelf notification code is ${code}. It expires in 10 minutes. If you did not request this, ignore this message.`,
		});
		await this.prisma.notificationSettings.upsert({
			where: { userDid: did },
			create: {
				userDid: did,
				pendingEmail: email,
				emailCodeHash: this.hashCode(code),
				emailCodeExpiresAt: new Date(Date.now() + EMAIL_CODE_LIFETIME_MS),
			},
			update: {
				pendingEmail: email,
				emailCodeHash: this.hashCode(code),
				emailCodeExpiresAt: new Date(Date.now() + EMAIL_CODE_LIFETIME_MS),
				emailCodeAttempts: 0,
			},
		});
	}

	async confirmEmail(did: string, code: string) {
		const settings = await this.ensureSettings(did);
		if (
			!settings.pendingEmail ||
			!settings.emailCodeHash ||
			!settings.emailCodeExpiresAt ||
			settings.emailCodeExpiresAt <= new Date() ||
			settings.emailCodeAttempts >= EMAIL_CODE_MAX_ATTEMPTS
		) {
			throw new BadRequestException("Code expired; request a new one");
		}
		const expected = Buffer.from(settings.emailCodeHash, "hex");
		const actual = Buffer.from(this.hashCode(code), "hex");
		if (!timingSafeEqual(expected, actual)) {
			await this.prisma.notificationSettings.update({
				where: { userDid: did },
				data: { emailCodeAttempts: { increment: 1 } },
			});
			throw new BadRequestException("Invalid code");
		}
		await this.prisma.notificationSettings.update({
			where: { userDid: did },
			data: {
				email: settings.pendingEmail,
				emailVerifiedAt: new Date(),
				emailIsCustom: true,
				pendingEmail: null,
				emailCodeHash: null,
				emailCodeExpiresAt: null,
				emailCodeAttempts: 0,
				nextQueueAt: new Date(),
			},
		});
		return this.getSettings(did);
	}

	async registerPushDevice(did: string, device: RegisterPushDeviceDto) {
		const previous = await this.prisma.pushDevice.findUnique({
			where: { token: device.token },
			select: { userDid: true },
		});
		await this.prisma.pushDevice.upsert({
			where: { token: device.token },
			create: { ...device, userDid: did },
			update: { userDid: did, platform: device.platform },
		});
		// Granting OS permission opts the account into push categories once. A
		// later token refresh must not override any switches the user turned off.
		const settings = await this.ensureSettings(did);
		if (!settings.pushInitialized) {
			await this.prisma.notificationSettings.update({
				where: { userDid: did },
				data: {
					pushNewReleases: true,
					pushWatchlistReleases: true,
					pushNewSeasons: true,
					pushStats: true,
					pushInitialized: true,
					nextQueueAt: new Date(),
				},
			});
		} else if (previous?.userDid !== did) {
			await this.prisma.notificationSettings.update({
				where: { userDid: did },
				data: { nextQueueAt: new Date() },
			});
		}
		return this.getSettings(did);
	}

	async removePushDevice(did: string, token: string) {
		await this.prisma.pushDevice.deleteMany({ where: { userDid: did, token } });
		return this.getSettings(did);
	}

	async sendTest(did: string, channel: "push" | "email"): Promise<void> {
		const title = "Opnshelf test notification";
		const body =
			"Your notifications are working. This is a test you requested from Settings.";
		if (channel === "email") {
			const settings = await this.ensureSettings(did);
			if (!settings.email || !settings.emailVerifiedAt)
				throw new BadRequestException("Confirm your notification email first");
			try {
				await this.email.sendNotification({
					to: settings.email,
					subject: title,
					text: body,
				});
			} catch {
				throw new ServiceUnavailableException(
					"Could not send the test email. Try again later.",
				);
			}
			return;
		}
		const devices = await this.prisma.pushDevice.findMany({
			where: { userDid: did },
		});
		if (!devices.length)
			throw new BadRequestException(
				"Enable mobile notifications on a device first",
			);
		const results = await Promise.allSettled(
			devices.map(({ token }) =>
				sendPushNotification(this.prisma, token, {
					title,
					body,
					url: "/settings/notifications",
				}),
			),
		);
		if (
			results.some((result) => result.status === "rejected" || !result.value)
		) {
			throw new ServiceUnavailableException(
				"One or more devices could not receive the test. Reconnect mobile notifications and try again.",
			);
		}
	}

	private hashCode(code: string): string {
		return createHash("sha256").update(code).digest("hex");
	}
}
