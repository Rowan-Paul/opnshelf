import {
	Body,
	Controller,
	Delete,
	Get,
	Patch,
	Param,
	Post,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import {
	ConfirmNotificationEmailDto,
	NotificationSettingsDto,
	NotificationCollectionDto,
	RegisterPushDeviceDto,
	RemovePushDeviceDto,
	RequestNotificationEmailDto,
	UpdateNotificationSettingsDto,
	TestNotificationDto,
} from "./notifications.dto";
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("notifications")
export class NotificationsController {
	constructor(private readonly notifications: NotificationsService) {}

	@Get("collections/:id")
	@ApiOkResponse({ type: NotificationCollectionDto })
	collection(
		@Req() req: AuthenticatedRequest,
		@Param("id") id: string,
	): Promise<NotificationCollectionDto> {
		return this.notifications.getCollection(req.user.did, id);
	}

	@Get("settings")
	@ApiOkResponse({ type: NotificationSettingsDto })
	settings(@Req() req: AuthenticatedRequest): Promise<NotificationSettingsDto> {
		return this.notifications.getSettings(req.user.did);
	}

	@Patch("settings")
	@ApiOkResponse({ type: NotificationSettingsDto })
	updateSettings(
		@Req() req: AuthenticatedRequest,
		@Body() body: UpdateNotificationSettingsDto,
	): Promise<NotificationSettingsDto> {
		return this.notifications.updateSettings(req.user.did, body);
	}

	@Post("test")
	@Throttle({ default: { limit: 3, ttl: 60_000 } })
	async testNotification(
		@Req() req: AuthenticatedRequest,
		@Body() body: TestNotificationDto,
	): Promise<void> {
		await this.notifications.sendTest(req.user.did, body.channel);
	}

	@Post("email/request")
	@Throttle({ default: { limit: 3, ttl: 60 * 60_000 } })
	async requestEmail(
		@Req() req: AuthenticatedRequest,
		@Body() body: RequestNotificationEmailDto,
	): Promise<void> {
		await this.notifications.requestEmail(req.user.did, body.email);
	}

	@Post("email/confirm")
	@Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
	@ApiOkResponse({ type: NotificationSettingsDto })
	confirmEmail(
		@Req() req: AuthenticatedRequest,
		@Body() body: ConfirmNotificationEmailDto,
	): Promise<NotificationSettingsDto> {
		return this.notifications.confirmEmail(req.user.did, body.code);
	}

	@Post("devices")
	@ApiOkResponse({ type: NotificationSettingsDto })
	registerDevice(
		@Req() req: AuthenticatedRequest,
		@Body() body: RegisterPushDeviceDto,
	): Promise<NotificationSettingsDto> {
		return this.notifications.registerPushDevice(req.user.did, body);
	}

	@Delete("devices")
	@ApiOkResponse({ type: NotificationSettingsDto })
	removeDevice(
		@Req() req: AuthenticatedRequest,
		@Body() body: RemovePushDeviceDto,
	): Promise<NotificationSettingsDto> {
		return this.notifications.removePushDevice(req.user.did, body.token);
	}
}
