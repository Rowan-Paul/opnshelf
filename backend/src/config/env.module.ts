import { Global, Module } from "@nestjs/common";
import { env } from "./env";
import { BackendEnv } from "./env.schema";

@Global()
@Module({
	providers: [{ provide: BackendEnv, useValue: env }],
	exports: [BackendEnv],
})
export class EnvModule {}
