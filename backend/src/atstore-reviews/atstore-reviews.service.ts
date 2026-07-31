import { Agent } from "@atproto/api";
import { TID } from "@atproto/common";
import {
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { PublishAtStoreReviewDto } from "./dto/atstore-review.dto";

export interface ATSession {
	did: string;
}

const ATSTORE_ORIGIN = "https://atstore.fyi";
const OPNSHELF_PUBLIC_URL = "https://opnshelf.xyz/";
const ATSTORE_REVIEW_COLLECTION = "fyi.atstore.listing.review";
const ONBOARDING_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type AtStoreListingResponse = { listing?: { uri?: unknown } };
type AtStoreReviewRecord = { subject?: unknown };

/**
 * Owns the server-side portion of the one-time AT Store review request.
 *
 * Authorization is deliberately not initiated here: #192 owns progressive
 * scopes and resumes callers after the user accepts or declines the AT Store
 * permission set. Once it supplies an upgraded `ATSession`, this service is
 * agnostic to platform and can safely run the same preflight/write path.
 */
@Injectable()
export class AtStoreReviewsService {
	private readonly logger = new Logger(AtStoreReviewsService.name);

	constructor(private readonly prisma: PrismaService) {}

	async getPrompt(
		did: string,
		session: ATSession,
	): Promise<{ eligible: boolean }> {
		const user = await this.prisma.user.findUnique({
			where: { did },
			select: { onboardingCompletedAt: true, atStoreReviewHandledAt: true },
		});
		if (!user) throw new NotFoundException("User not found");

		if (
			user.atStoreReviewHandledAt ||
			!user.onboardingCompletedAt ||
			Date.now() - user.onboardingCompletedAt.getTime() < ONBOARDING_AGE_MS
		) {
			return { eligible: false };
		}

		try {
			const listingUri = await this.resolveListingUri();
			if (await this.hasExistingReview(session, listingUri)) {
				await this.markHandled(did);
				return { eligible: false };
			}
			return { eligible: true };
		} catch (error) {
			// A prompt must never make Home unavailable. A later Home visit retries
			// both the public directory and the user's PDS preflight.
			this.logger.warn(
				`AT Store review preflight unavailable for ${did}`,
				error instanceof Error ? error.message : undefined,
			);
			return { eligible: false };
		}
	}

	async dismiss(did: string): Promise<void> {
		await this.markHandled(did);
	}

	async publish(
		did: string,
		session: ATSession,
		dto: PublishAtStoreReviewDto,
	): Promise<{ uri: string }> {
		const listingUri = await this.resolveListingUri();
		if (await this.hasExistingReview(session, listingUri)) {
			await this.markHandled(did);
			throw new ConflictException("You already have an AT Store review");
		}

		const rkey = await this.reserveRkey(did);
		const text = dto.text?.trim();
		const record = {
			$type: ATSTORE_REVIEW_COLLECTION,
			subject: listingUri,
			rating: dto.rating,
			...(text ? { text } : {}),
			createdAt: new Date().toISOString(),
		};
		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		const response = await agent.com.atproto.repo.putRecord({
			repo: session.did,
			collection: ATSTORE_REVIEW_COLLECTION,
			rkey,
			record,
			// The user's PDS may not have the third-party lexicon installed.
			validate: false,
		});

		await this.markHandled(did);
		return { uri: response.data.uri };
	}

	private async resolveListingUri(): Promise<string> {
		const url = new URL(
			"/xrpc/fyi.atstore.directory.getListing",
			ATSTORE_ORIGIN,
		);
		url.searchParams.set("externalUrl", OPNSHELF_PUBLIC_URL);
		const response = await fetch(url, {
			headers: { Accept: "application/json" },
		});
		if (!response.ok) {
			throw new Error(`AT Store directory returned ${response.status}`);
		}
		const data = (await response.json()) as AtStoreListingResponse;
		const uri = data.listing?.uri;
		if (
			typeof uri !== "string" ||
			!uri.startsWith("at://") ||
			!uri.includes("/fyi.atstore.listing.detail/")
		) {
			throw new Error("AT Store directory returned an invalid listing URI");
		}
		return uri;
	}

	private async hasExistingReview(session: ATSession, subject: string) {
		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);
		let cursor: string | undefined;
		do {
			const response = await agent.com.atproto.repo.listRecords({
				repo: session.did,
				collection: ATSTORE_REVIEW_COLLECTION,
				limit: 100,
				cursor,
			});
			if (
				response.data.records.some(
					(item) =>
						(item.value as AtStoreReviewRecord | undefined)?.subject ===
						subject,
				)
			) {
				return true;
			}
			cursor = response.data.cursor;
		} while (cursor);
		return false;
	}

	private async reserveRkey(did: string): Promise<string> {
		const existing = await this.prisma.user.findUnique({
			where: { did },
			select: { atStoreReviewRkey: true, atStoreReviewHandledAt: true },
		});
		if (!existing) throw new NotFoundException("User not found");
		if (existing.atStoreReviewHandledAt) {
			throw new ConflictException("AT Store review request is already handled");
		}
		if (existing.atStoreReviewRkey) return existing.atStoreReviewRkey;

		const rkey = TID.nextStr();
		const claimed = await this.prisma.user.updateMany({
			where: { did, atStoreReviewRkey: null, atStoreReviewHandledAt: null },
			data: { atStoreReviewRkey: rkey },
		});
		if (claimed.count === 1) return rkey;

		const concurrent = await this.prisma.user.findUnique({
			where: { did },
			select: { atStoreReviewRkey: true, atStoreReviewHandledAt: true },
		});
		if (concurrent?.atStoreReviewHandledAt) {
			throw new ConflictException("AT Store review request is already handled");
		}
		if (concurrent?.atStoreReviewRkey) return concurrent.atStoreReviewRkey;
		throw new ConflictException("Unable to reserve an AT Store review key");
	}

	private async markHandled(did: string): Promise<void> {
		await this.prisma.user.update({
			where: { did },
			data: { atStoreReviewHandledAt: new Date() },
		});
	}
}
