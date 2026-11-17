import { Controller, Get, Query, Res } from "@nestjs/common";
import { ApiExcludeEndpoint, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { BingersSyncService } from "./bingers-sync.service";

/**
 * Bingers' OAuth client metadata and callback. Their URLs are registered with
 * Bingers, so they stay here; every other request goes through the shared
 * Integration API (ADR 0051).
 */
@ApiTags("bingers-sync")
@Controller("bingers-sync")
export class BingersSyncController {
	constructor(private readonly sync: BingersSyncService) {}
	@Get("client-metadata")
	metadata() {
		return this.sync.metadata();
	}
	@Get("client")
	@ApiExcludeEndpoint()
	client(@Res() res: Response) {
		res.redirect(this.sync.homepage());
	}
	@Get("callback")
	async callback(
		@Query("state") state: string,
		@Query("code") code: string | undefined,
		@Res() res: Response,
	) {
		res.redirect(await this.sync.callback(state, code));
	}
}
