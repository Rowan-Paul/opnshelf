import {
	Catch,
	type ArgumentsHost,
	type ExceptionFilter,
} from "@nestjs/common";
import type { Response } from "express";
import { WatchMigrationPdsError } from "./watch-migration-pds";

@Catch(WatchMigrationPdsError)
export class WatchPrivacyPdsFilter implements ExceptionFilter {
	catch(error: WatchMigrationPdsError, host: ArgumentsHost) {
		const messages: Record<string, string> = {
			InsufficientScope:
				"Authorize Private data access before changing or syncing private content.",
			SpaceNotPrivate:
				"Your content Space is shared. Restore owner-only access before continuing.",
			SpaceNotFound:
				"Your private content Space is missing. Restore it on your PDS before retrying; authorizing access alone cannot recover deleted records.",
		};
		host
			.switchToHttp()
			.getResponse<Response>()
			.status(error.status >= 400 && error.status < 500 ? error.status : 502)
			.json({
				message:
					messages[error.code] ??
					"The PDS could not complete this privacy request. Try again; an interrupted privacy change can be resumed.",
			});
	}
}
