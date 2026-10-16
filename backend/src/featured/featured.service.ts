import {
	BadRequestException,
	ConflictException,
	Injectable,
	InternalServerErrorException,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import { getPaginationMeta } from "../common/pagination";
import type { FeaturedContent, Prisma } from "../generated/client";
import { PrismaService } from "../prisma/prisma.service";
import { FeaturedCatalogueService } from "./featured-catalogue.service";
import type {
	FeaturedDto,
	FeaturedQueryDto,
	PublishFeaturedDto,
} from "./featured.dto";

const activeWhere = (now: Date) => ({
	published: true,
	expiresAt: { gt: now },
});
const orderBy = [{ position: "asc" as const }, { id: "asc" as const }];
@Injectable()
export class FeaturedService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly catalogue: FeaturedCatalogueService,
	) {}
	private dto(item: FeaturedContent): FeaturedDto {
		const mediaType = item.mediaType;
		if (mediaType !== "movie" && mediaType !== "show" && mediaType !== "season")
			throw new InternalServerErrorException("Invalid featured media type");
		return {
			id: item.id,
			mediaType,
			mediaId: item.mediaId,
			seasonNumber: item.seasonNumber,
			title: item.title,
			posterPath: item.posterPath,
			message: item.message,
			sourceUrl: item.sourceUrl,
			sourceLabel: item.sourceLabel,
			expiresAt: item.expiresAt.toISOString(),
			active: item.published && item.expiresAt.getTime() > Date.now(),
		};
	}
	private async publicEntry(
		entry: FeaturedContent,
	): Promise<FeaturedDto | null> {
		let timeout: ReturnType<typeof setTimeout> | undefined;
		try {
			// Discovery must remain usable during a slow catalogue outage. The
			// underlying read can still warm the shared cache for the next visit.
			const metadata = await Promise.race([
				this.catalogue.resolve(this.dto(entry)),
				new Promise<null>((resolve) => {
					timeout = setTimeout(() => resolve(null), 1500);
				}),
			]);
			return this.dto({ ...entry, ...metadata });
		} catch (error) {
			return error instanceof NotFoundException ? null : this.dto(entry);
		} finally {
			clearTimeout(timeout);
		}
	}
	async selection() {
		const entries = await this.prisma.featuredContent.findMany({
			where: activeWhere(new Date()),
			orderBy,
			take: 5,
		});
		const items = await Promise.all(
			entries.map((entry) => this.publicEntry(entry)),
		);
		return {
			items: items.filter((item): item is FeaturedDto => !!item?.active),
		};
	}

	async list(query: FeaturedQueryDto) {
		const now = new Date();
		const where =
			query.status === "inactive"
				? { OR: [{ published: false }, { expiresAt: { lte: now } }] }
				: activeWhere(now);
		const pageSize = query.pageSize ?? 20;
		const total = await this.prisma.featuredContent.count({ where });
		const meta = getPaginationMeta(total, query.page ?? 1, pageSize);
		const items = await this.prisma.featuredContent.findMany({
			where,
			orderBy:
				query.status === "inactive"
					? [{ updatedAt: "desc" }, { id: "asc" }]
					: orderBy,
			skip: (meta.page - 1) * pageSize,
			take: pageSize,
		});
		return { ...meta, items: items.map((item) => this.dto(item)) };
	}
	// Serialize concurrent editorial requests, so separate tabs cannot
	// exceed the cap, duplicate an active title, or race a reorder.
	private async edit<T>(
		run: (tx: Prisma.TransactionClient) => Promise<T>,
	): Promise<T> {
		return this.prisma.$transaction(async (tx) => {
			await tx.$executeRaw`SELECT pg_advisory_xact_lock(255, 1)`;
			return run(tx);
		});
	}
	async publish(input: PublishFeaturedDto, id?: string) {
		if ((input.mediaType === "season") !== (input.seasonNumber != null))
			throw new BadRequestException("Only seasons require a season number");
		if (!!input.sourceUrl !== !!input.sourceLabel)
			throw new BadRequestException("Choose a label and HTTPS URL together");
		const expiresAt = new Date(input.expiresAt);
		if (
			!Number.isFinite(expiresAt.getTime()) ||
			!/[zZ]|[+-]\d{2}:\d{2}$/.test(input.expiresAt) ||
			(input.published !== false && expiresAt.getTime() <= Date.now())
		)
			throw new BadRequestException(
				"Expiry must be a future date and time with a timezone",
			);
		let metadata: { title: string; posterPath: string | null };
		try {
			metadata = await this.catalogue.resolve(input);
		} catch (error) {
			if (error instanceof NotFoundException) throw error;
			throw new ServiceUnavailableException(
				"Couldn't verify this title. Try publishing again shortly.",
			);
		}
		return this.edit(async (tx) => {
			const existing = id
				? await tx.featuredContent.findUnique({ where: { id } })
				: null;
			if (id && !existing)
				throw new NotFoundException("Featured entry not found");
			const now = new Date();
			// Catalogue verification and lock acquisition may outlive the initial expiry check.
			if (input.published !== false && expiresAt <= now)
				throw new BadRequestException("Expiry must be in the future");
			const active = await tx.featuredContent.findMany({
				where: activeWhere(now),
				orderBy,
			});
			const others = active.filter((item) => item.id !== id);
			if (input.published !== false && others.length >= 5)
				throw new ConflictException(
					"Remove an active entry before publishing another",
				);
			if (
				input.published !== false &&
				others.some(
					(item) =>
						item.mediaType === input.mediaType &&
						item.mediaId === input.mediaId &&
						item.seasonNumber === (input.seasonNumber ?? null),
				)
			)
				throw new ConflictException("This Media Item is already featured");
			const data = {
				mediaType: input.mediaType,
				mediaId: input.mediaId,
				message: input.message,
				...metadata,
				seasonNumber: input.seasonNumber ?? null,
				sourceUrl: input.sourceUrl ?? null,
				sourceLabel: input.sourceLabel ?? null,
				expiresAt,
				published: input.published !== false,
				position:
					active.find((item) => item.id === id)?.position ??
					Math.max(-1, ...active.map((item) => item.position)) + 1,
			};
			return this.dto(
				id
					? await tx.featuredContent.update({ where: { id }, data })
					: await tx.featuredContent.create({ data }),
			);
		});
	}
	async remove(id: string) {
		return this.edit(async (tx) => {
			const result = await tx.featuredContent.updateMany({
				where: { id },
				data: { published: false },
			});
			if (!result.count)
				throw new NotFoundException("Featured entry not found");
		});
	}
	async reorder(ids: string[]) {
		return this.edit(async (tx) => {
			const active = await tx.featuredContent.findMany({
				where: activeWhere(new Date()),
				orderBy,
			});
			if (
				ids.length !== active.length ||
				new Set(ids).size !== ids.length ||
				active.some((item) => !ids.includes(item.id))
			)
				throw new ConflictException(
					"The active selection changed. Refresh it before reordering.",
				);
			for (const [position, id] of ids.entries())
				await tx.featuredContent.update({ where: { id }, data: { position } });
		});
	}
}
