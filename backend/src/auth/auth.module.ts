import { forwardRef, Module } from "@nestjs/common";
import { IngesterModule } from "../ingester/ingester.module";
import { PrismaModule } from "../prisma/prisma.module";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { AUTH_SERVICE } from "./auth.tokens";

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
		{
			provide: AUTH_SERVICE,
			useExisting: AuthService,
		},
	],
	exports: [AuthService, AuthGuard, AUTH_SERVICE],
})
export class AuthModule {}
