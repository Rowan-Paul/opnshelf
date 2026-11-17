import { Controller, Get, Query, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { TraktSyncService } from "./trakt-sync.service";

/**
 * Trakt's OAuth callback. Its URL is registered with Trakt, so it stays here;
 * every other request goes through the shared Integration API (ADR 0051).
 */
@ApiTags("trakt-sync")
@Controller("trakt-sync")
export class TraktSyncController {
	constructor(private readonly sync: TraktSyncService) {}
	@Get("callback")
	async callback(
		@Query("state") state: string,
		@Query("code") code: string | undefined,
		@Res() res: Response,
	) {
		res.redirect(await this.sync.callback(state, code));
	}
}
