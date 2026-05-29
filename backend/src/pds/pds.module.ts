import { Module } from "@nestjs/common";
import { CaptchaService } from "./captcha.service";
import { TranquilAdminService } from "./tranquil-admin.service";

/**
 * Everything opnshelf needs to drive its own Tranquil PDS: admin invite-code
 * minting and the captcha gate that protects it.
 */
@Module({
	providers: [TranquilAdminService, CaptchaService],
	exports: [TranquilAdminService, CaptchaService],
})
export class PdsModule {}
