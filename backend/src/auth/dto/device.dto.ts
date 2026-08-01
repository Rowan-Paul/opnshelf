import { ApiProperty } from "@nestjs/swagger";

/**
 * One signed-in device. Deliberately carries no AuthSession.id: that value is
 * the live Bearer token, so it must never leave the server (ADR-0015).
 */
export class DeviceDto {
	@ApiProperty({
		description: "Opaque id of the install, used to revoke this device",
	})
	deviceId: string;

	@ApiProperty({
		description: 'Client-reported label, e.g. "iPhone 15 Pro"',
		nullable: true,
		type: String,
	})
	name: string | null;

	@ApiProperty({
		description: "Client-reported platform",
		enum: ["ios", "android", "web"],
		nullable: true,
		type: String,
	})
	platform: string | null;

	@ApiProperty({ description: "Whether this is the device making the request" })
	isCurrent: boolean;

	@ApiProperty({ description: "Last authenticated request from this device" })
	lastUsedAt: string;

	@ApiProperty({ description: "When this device signed in" })
	createdAt: string;
}

export class RevokeDevicesResponseDto {
	@ApiProperty({ description: "How many devices were signed out" })
	revoked: number;
}
