import { forwardRef, Module } from "@nestjs/common";
import { IngesterModule } from "../ingester/ingester.module";
import { PrismaModule } from "../prisma/prisma.module";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";

@Module({
	imports: [
		PrismaModule,
		forwardRef(() => IngesterModule),
		forwardRef(() => UsersModule),
	],
	controllers: [AuthController],
	providers: [AuthService, AuthGuard],
	exports: [AuthService, AuthGuard],
})
export class AuthModule {}
