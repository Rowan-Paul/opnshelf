import {
	Controller,
	Delete,
	Get,
	NotFoundException,
	Param,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "./auth.guard";
import { DeviceSessionsService } from "./device-sessions.service";
import { DeviceDto, RevokeDevicesResponseDto } from "./dto/device.dto";
import { extractSessionId } from "./session-id";
import type { AuthenticatedRequest } from "./types";

/**
 * The Devices settings surface (ADR-0015): list and revoke the signed-in
 * Devices of the current account. Routes keep their `AuthController_*`
 * operationIds: the generated client names its functions after them, so
 * moving a route must not rename it.
 */
@ApiTags("auth")
@Controller()
export class DevicesController {
	constructor(private readonly sessions: DeviceSessionsService) {}

	/**
	 * The user's signed-in devices, most recently used first (ADR-0015).
	 */
	@Get("auth/devices")
	@UseGuards(AuthGuard)
	@ApiOperation({
		operationId: "AuthController_listDevices",
		summary: "List the signed-in devices for this account",
	})
	@ApiResponse({ status: 200, type: [DeviceDto] })
	async listDevices(@Req() req: AuthenticatedRequest): Promise<DeviceDto[]> {
		const sessionId = extractSessionId(req) ?? "";
		const devices = await this.sessions.listDevices(req.user.did, sessionId);
		return devices.map((device) => ({
			...device,
			lastUsedAt: device.lastUsedAt.toISOString(),
			createdAt: device.createdAt.toISOString(),
		}));
	}

	/**
	 * Sign out every device except the one making the request. The current
	 * device keeps its session — settings already has a Sign out button for that.
	 */
	@Delete("auth/devices")
	@UseGuards(AuthGuard)
	@ApiOperation({
		operationId: "AuthController_revokeOtherDevices",
		summary: "Sign out all other devices",
	})
	@ApiResponse({ status: 200, type: RevokeDevicesResponseDto })
	async revokeOtherDevices(
		@Req() req: AuthenticatedRequest,
	): Promise<RevokeDevicesResponseDto> {
		const sessionId = extractSessionId(req) ?? "";
		const revoked = await this.sessions.revokeOtherDevices(
			req.user.did,
			sessionId,
		);
		return { revoked };
	}

	/**
	 * Sign out one device. deviceId comes from the client, so the revoke is
	 * scoped by DID — an unknown or someone else's device is a 404, never a
	 * successful revoke.
	 */
	@Delete("auth/devices/:deviceId")
	@UseGuards(AuthGuard)
	@ApiOperation({
		operationId: "AuthController_revokeDevice",
		summary: "Sign out one device",
	})
	@ApiResponse({ status: 200, type: RevokeDevicesResponseDto })
	async revokeDevice(
		@Req() req: AuthenticatedRequest,
		@Param("deviceId") deviceId: string,
	): Promise<RevokeDevicesResponseDto> {
		const revoked = await this.sessions.revokeDevice(req.user.did, deviceId);
		if (revoked === 0) {
			throw new NotFoundException("Device not found");
		}
		return { revoked };
	}
}
