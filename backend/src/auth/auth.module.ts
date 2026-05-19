import { forwardRef, Module } from "@nestjs/common";
import { IngesterModule } from "../ingester/ingester.module";
import { PrismaModule } from "../prisma/prisma.module";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { AUTH_SERVICE } from "./auth.tokens";
import { OptionalAuthGuard } from "./optional-auth.guard";

@Module({
	imports: [
		PrismaModule,
		forwardRef(() => IngesterModule),
		forwardRef(() => UsersModule),
	],
	controllers: [AuthController],
	providers: [
		AuthService,
		AuthGuard,
		OptionalAuthGuard,
		{
			provide: AUTH_SERVICE,
			useExisting: AuthService,
		},
	],
	exports: [AuthService, AuthGuard, OptionalAuthGuard, AUTH_SERVICE],
})
export class AuthModule {}
