import { WatchPrivacyPdsFilter } from "./privacy-pds.filter";
import {
	Body,
	Controller,
	Get,
	Header,
	Post,
	Req,
	UseGuards,
	UseFilters,
	ForbiddenException,
} from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import {
	includesWatchSpaceGrant,
	PRIVACY_ALPHA_SCOPES,
} from "../auth/oauth-scopes";
import { PrismaService } from "../prisma/prisma.service";
import { WatchPrivacyService } from "./watch-privacy.service";
import { ContentPrivacyService } from "./content-privacy.service";
import {
	ContentPrivacyCoordinator,
	visibility,
} from "./content-privacy-coordinator";
import { WatchAccountLock } from "./watch-account-lock";
import { requireWatchSession } from "./watch-operation";
import { spacesAvailability } from "./privacy-status";
import { PRIVACY_ALPHA_DETAILS } from "./privacy-category";
import {
	PrivacyChangeDto,
	PrivacyDefaultDto,
	PrivacyStatusDto,
	type PrivacyScopeDto,
} from "./privacy.dto";

@ApiTags("privacy")
@Controller("users/me/privacy")
@UseGuards(AuthGuard)
@UseFilters(WatchPrivacyPdsFilter)
export class PrivacyController {
	constructor(
		private readonly prisma: PrismaService,
		private readonly watches: WatchPrivacyService,
		private readonly content: ContentPrivacyService,
		private readonly coordinator: ContentPrivacyCoordinator,
		private readonly locks: WatchAccountLock,
	) {}
	private async authorized(session: unknown) {
		const oauthSession = requireWatchSession(session);
		const granted = (await oauthSession.getTokenInfo()).scope;
		return PRIVACY_ALPHA_SCOPES.every((scope) =>
			includesWatchSpaceGrant(granted, scope, oauthSession.did),
		);
	}
	@Get()
	@Header("Cache-Control", "private, no-store")
	@ApiResponse({ status: 200, type: PrivacyStatusDto })
	async status(@Req() req: AuthenticatedRequest): Promise<PrivacyStatusDto> {
		const did = req.user.did;
		const [user, states, lists, watches, availability, authorized] =
			await Promise.all([
				this.prisma.user.findUniqueOrThrow({
					where: { did },
					select: { listsDefaultVisibility: true },
				}),
				this.prisma.privacyScope.findMany({
					where: { userDid: did },
					include: { _count: { select: { copies: true } } },
				}),
				this.prisma.list.findMany({
					where: { userDid: did },
					select: { rkey: true, name: true },
					orderBy: { createdAt: "asc" },
				}),
				this.watches.status(did, req.user.session),
				spacesAvailability(req.user.session),
				this.authorized(req.user.session),
			]);
		const scopes: PrivacyScopeDto[] = [
			{
				category: "watches",
				listRkey: null,
				label: "Watches",
				visibility: visibility(watches.visibility),
				migration: watches.migration
					? {
							...watches.migration,
							target: visibility(watches.migration.target),
						}
					: null,
			},
		];
		for (const item of [
			{ category: "library" as const, listRkey: null, label: "Library" },
			{ category: "notes" as const, listRkey: null, label: "Notes" },
			...lists.map((list) => ({
				category: "lists" as const,
				listRkey: list.rkey,
				label: list.name,
			})),
		]) {
			const state = states.find(
				(state) =>
					state.category === item.category && state.listRkey === item.listRkey,
			);
			scopes.push({
				...item,
				visibility: visibility(state?.visibility ?? "public"),
				migration:
					state?.migrationId && state.targetVisibility
						? {
								id: state.migrationId,
								target: visibility(state.targetVisibility),
								status: state.status ?? "queued",
								copied: state._count.copies,
								error: state.error,
							}
						: null,
			});
		}
		return {
			availability,
			authorized,
			listsDefaultVisibility: visibility(user.listsDefaultVisibility),
			scopes,
			alphaDetails: PRIVACY_ALPHA_DETAILS,
		};
	}
	@Post("change")
	@ApiResponse({ status: 201, type: PrivacyStatusDto })
	async change(
		@Req() req: AuthenticatedRequest,
		@Body() body: PrivacyChangeDto,
	) {
		if (body.category === "watches")
			await this.watches.start(
				req.user.did,
				req.user.session,
				body.visibility,
				body.publicationConfirmed === true,
			);
		else
			await this.content.start(
				req.user.did,
				req.user.session,
				body.category,
				body.visibility,
				body.publicationConfirmed === true,
				body.listRkey,
			);
		return this.status(req);
	}
	@Post("retry")
	@ApiResponse({ status: 201, type: PrivacyStatusDto })
	async retry(
		@Req() req: AuthenticatedRequest,
		@Body() body: PrivacyChangeDto,
	) {
		if (body.category === "watches")
			await this.watches.retry(req.user.did, req.user.session);
		else
			await this.coordinator.retry(req.user.did, body.category, body.listRkey);
		return this.status(req);
	}
	@Post("lists/default")
	@ApiResponse({ status: 201, type: PrivacyStatusDto })
	async listsDefault(
		@Req() req: AuthenticatedRequest,
		@Body() body: PrivacyDefaultDto,
	) {
		if (
			body.visibility === "private" &&
			!(await this.authorized(req.user.session))
		)
			throw new ForbiddenException(
				"Authorize Private data access before continuing.",
			);
		await this.locks.run(req.user.did, async () => {
			await this.coordinator.assertAccount(req.user.did);
			await this.prisma.user.update({
				where: { did: req.user.did },
				data: { listsDefaultVisibility: body.visibility },
			});
		});
		return this.status(req);
	}
	@Post("lists/change-all")
	@ApiResponse({ status: 201, type: PrivacyStatusDto })
	async changeAllLists(
		@Req() req: AuthenticatedRequest,
		@Body() body: PrivacyChangeDto,
	) {
		const lists = await this.prisma.list.findMany({
			where: { userDid: req.user.did },
			select: { rkey: true },
		});
		for (const list of lists)
			await this.content.start(
				req.user.did,
				req.user.session,
				"lists",
				body.visibility,
				body.publicationConfirmed === true,
				list.rkey,
			);
		return this.status(req);
	}
}
