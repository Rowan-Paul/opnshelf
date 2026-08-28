/**
 * Row → DTO mapping for Trakt import jobs. Pure: no Prisma client, no network,
 * so the wire shape can be asserted without a running module.
 */
import type { PrismaService } from "../prisma/prisma.service";
import {
	parseTraktImportData,
	type TraktImportJobData,
} from "./background-job-data";
import type {
	TraktImportIssueDto,
	TraktImportJobDto,
	TraktPublicProfileDto,
} from "./dto/import-history.dto";

export type BackgroundJobRecord = Awaited<
	ReturnType<PrismaService["backgroundJob"]["findFirst"]>
>;

/** The columns mapTraktImportIssue needs off a traktImportItem row. */
export type TraktImportIssueRow = {
	id: string;
	sourceIndex: number;
	outcome: string;
	mediaType: string;
	title: string | null;
	year: number | null;
	episodeTitle: string | null;
	seasonNumber: number | null;
	episodeNumber: number | null;
	watchedAt: Date | null;
	reason: string | null;
	message: string | null;
	traktMediaKey: string | null;
};

const RETRYABLE_IMPORT_REASONS = new Set([
	"metadata_unavailable",
	"upstream_write_failed",
	"unknown",
	"write_failed",
]);

export function getTraktImportRecovery(
	item: Pick<
		TraktImportIssueRow,
		| "outcome"
		| "reason"
		| "mediaType"
		| "watchedAt"
		| "seasonNumber"
		| "episodeNumber"
		| "traktMediaKey"
	>,
): "match" | "retry" | "none" {
	const canMatch =
		!!item.traktMediaKey &&
		!!item.watchedAt &&
		(item.mediaType === "movie" ||
			(item.mediaType === "episode" &&
				item.seasonNumber !== null &&
				item.episodeNumber !== null));
	if (
		canMatch &&
		(item.outcome === "unmatched" ||
			item.reason === "missing_tmdb_id" ||
			item.reason === "no_tmdb_match" ||
			item.reason === "invalid_match")
	) {
		return "match";
	}
	return RETRYABLE_IMPORT_REASONS.has(item.reason ?? "") ? "retry" : "none";
}

export function mapTraktImportJob(
	job: NonNullable<BackgroundJobRecord>,
): TraktImportJobDto {
	const jobData = parseTraktImportData(job.data);
	return {
		id: job.id,
		traktUsername: jobData.traktUsername,
		status: job.status as TraktImportJobDto["status"],
		currentPage: jobData.currentPage,
		totalPages: jobData.totalPages ?? undefined,
		sourceCount: jobData.sourceCount,
		normalizedCount: jobData.normalizedCount,
		importedCount: jobData.importedCount,
		skippedCount: jobData.skippedCount,
		failedCount: jobData.failedCount,
		alreadyOnShelfCount: jobData.alreadyOnShelfCount,
		unmatchedCount: jobData.unmatchedCount,
		couldntImportCount: jobData.failedCount,
		issuesPreview: [],
		unmatchedGroups: [],
		acknowledgedAt: jobData.acknowledgedAt,
		reminderSnoozedUntil: jobData.reminderSnoozedUntil,
		nextRunAt: job.nextRunAt.toISOString(),
		lastError: job.lastError ?? undefined,
		profileUsername: jobData.profileUsername,
		profileSlug: jobData.profileSlug,
		profileName: jobData.profileName,
		profileAvatarUrl: jobData.profileAvatarUrl,
		startedAt: job.startedAt?.toISOString(),
		completedAt: job.completedAt?.toISOString(),
		createdAt: job.createdAt.toISOString(),
		updatedAt: job.updatedAt.toISOString(),
	};
}

export function mapTraktImportIssue(
	item: TraktImportIssueRow,
): TraktImportIssueDto {
	return {
		id: item.id,
		sourceIndex: item.sourceIndex,
		outcome: item.outcome === "unmatched" ? "unmatched" : "couldnt_import",
		mediaType:
			item.mediaType === "movie" || item.mediaType === "episode"
				? item.mediaType
				: "unknown",
		title: item.title ?? undefined,
		year: item.year ?? undefined,
		episodeTitle: item.episodeTitle ?? undefined,
		seasonNumber: item.seasonNumber ?? undefined,
		episodeNumber: item.episodeNumber ?? undefined,
		watchedAt: item.watchedAt?.toISOString(),
		reason: item.reason ?? undefined,
		message: item.message ?? undefined,
		recovery: getTraktImportRecovery(item),
		matchKey: item.traktMediaKey ?? undefined,
	};
}

/**
 * The profile we can rebuild from the job itself, for when Trakt is unreachable
 * or the import is already running and we just need something to show.
 */
export function buildProfileFromJobData(
	jobData: TraktImportJobData,
): TraktPublicProfileDto {
	return {
		username: jobData.profileUsername ?? jobData.traktUsername,
		slug: jobData.profileSlug ?? jobData.traktUsername,
		name: jobData.profileName,
		isPrivate: false,
		isVip: false,
		avatarUrl: jobData.profileAvatarUrl,
	};
}
