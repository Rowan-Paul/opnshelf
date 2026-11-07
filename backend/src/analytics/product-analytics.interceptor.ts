import {
	Injectable,
	type NestInterceptor,
	type ExecutionContext,
	type CallHandler,
} from "@nestjs/common";
import { tap } from "rxjs";
import { BackendEnv } from "../config/env.schema";
import type { AuthenticatedRequest } from "../auth/types";
import { captureProductEvent } from "./capture";

/** Explicit successful HTTP actions; never capture arbitrary bodies or responses. */
@Injectable()
export class ProductAnalyticsInterceptor implements NestInterceptor {
	constructor(private readonly env: BackendEnv) {}
	intercept(context: ExecutionContext, next: CallHandler) {
		const operation = `${context.getClass().name}.${context.getHandler().name}`;
		const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
		return next.handle().pipe(
			tap(() => {
				if (!request.user?.did) return;
				const capture = (
					event: string,
					properties: Record<string, string | boolean | string[]> = {},
				) => captureProductEvent(this.env, request.user.did, event, properties);
				const body: Record<string, unknown> = request.body ?? {};
				switch (operation) {
					case "ReleaseNotesController.markRead":
						capture("release_notes_read");
						break;
					case "NotesController.upsertNote":
						capture("note_saved");
						break;
					case "NotesController.deleteNote":
						capture("note_deleted");
						break;
					case "UsersController.deleteMyAccount":
						capture("account_deletion_requested", {
							delete_pds_data: body.deletePDSData === true,
						});
						break;
					case "NotificationsController.registerDevice":
						capture("notification_device_registered");
						break;
					case "NotificationsController.removeDevice":
						capture("notification_device_removed");
						break;
					case "NotificationsController.updateSettings": {
						const settings = [
							"pushNewReleases",
							"pushWatchlistReleases",
							"pushNewSeasons",
							"pushStats",
							"pushSyncErrors",
							"emailNewReleases",
							"emailWatchlistReleases",
							"emailNewSeasons",
							"emailStats",
						];
						for (const setting of settings)
							if (typeof body[setting] === "boolean")
								capture("notification_preference_changed", {
									setting,
									enabled: body[setting],
								});
						break;
					}
					case "UsersController.updateMySettings":
						if (
							"reviewsPublicationUri" in body ||
							"reviewsMirrorFormat" in body
						)
							capture("blog_mirror_settings_saved", {
								publication_selected:
									typeof body.reviewsPublicationUri === "string",
								format_changed: "reviewsMirrorFormat" in body,
							});
						break;
					case "PrivacyController.change":
					case "WatchPrivacyController.change":
					case "PrivacyController.listsDefault":
					case "PrivacyController.changeAllLists": {
						const category =
							operation === "WatchPrivacyController.change"
								? "watches"
								: operation === "PrivacyController.change"
									? body.category
									: "lists";
						if (
							typeof category === "string" &&
							["watches", "notes", "library", "lists"].includes(category) &&
							(body.visibility === "public" || body.visibility === "private")
						)
							capture("data_visibility_change_requested", {
								category,
								visibility: body.visibility,
							});
						break;
					}
				}
			}),
		);
	}
}
