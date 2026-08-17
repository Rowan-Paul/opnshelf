import { Module } from "@nestjs/common";
import { CaptchaService } from "./captcha.service";
import { GoogleOAuthService } from "./google-oauth.service";
import { TranquilAdminService } from "./tranquil-admin.service";

/**
 * Everything opnshelf needs to drive its own Tranquil PDS: admin invite-code
 * minting, the captcha gate that protects it, and the Google client used for
 * "Continue with Google" signups.
 */
@Module({
	providers: [TranquilAdminService, CaptchaService, GoogleOAuthService],
	exports: [TranquilAdminService, CaptchaService, GoogleOAuthService],
})
export class PdsModule {}
