import { forwardRef, Module } from "@nestjs/common";
import { IngesterModule } from "../ingester/ingester.module";
import { PdsModule } from "../pds/pds.module";
import { PrismaModule } from "../prisma/prisma.module";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { AUTH_SERVICE } from "./auth.tokens";
import { DeviceSessionsService } from "./device-sessions.service";
import { DevicesController } from "./devices.controller";
import { GoogleSignupController } from "./google-signup.controller";
import { MobileHandoffController } from "./mobile-handoff.controller";
import { MobileHandoffService } from "./mobile-handoff.service";
import { NativeAccountService } from "./native-account.service";
import { OAuthClientFactory } from "./oauth-client.factory";
import { OptionalAuthGuard } from "./optional-auth.guard";
import { PermissionsController } from "./permissions.controller";
import { SignupController } from "./signup.controller";
import { SignupRateLimiter } from "./signup-rate-limiter";

@Module({
	imports: [
		PrismaModule,
		PdsModule,
		forwardRef(() => IngesterModule),
		forwardRef(() => UsersModule),
	],
	controllers: [
		AuthController,
		SignupController,
		GoogleSignupController,
		MobileHandoffController,
		PermissionsController,
		DevicesController,
	],
	providers: [
		AuthService,
		OAuthClientFactory,
		DeviceSessionsService,
		MobileHandoffService,
		NativeAccountService,
		SignupRateLimiter,
		AuthGuard,
		OptionalAuthGuard,
		{
			provide: AUTH_SERVICE,
			useExisting: AuthService,
		},
	],
	// Only AuthService, the guards and the AUTH_SERVICE token are consumed
	// outside this module; the new units stay internal.
	exports: [AuthService, AuthGuard, OptionalAuthGuard, AUTH_SERVICE],
})
export class AuthModule {}
