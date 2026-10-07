import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client";
import type { PrismaService } from "../prisma/prisma.service";
import type { MoviesService } from "../movies/movies.service";
import type { ShowsService } from "../shows/shows.service";
import { LibraryService } from "../library/library.service";
import { NotesService } from "../notes/notes.service";
import { ListsService } from "../lists/lists.service";
import { privacyPdsFixture } from "../../test/privacy-pds";
import { privacyRepositoryConfig } from "./privacy-category";
import { WatchAccountLock } from "./watch-account-lock";
import { ContentPrivacyCoordinator } from "./content-privacy-coordinator";
import { ContentPrivacyProjection } from "./content-privacy-projection";
import { ContentPrivacyService } from "./content-privacy.service";
import { projectContent } from "./content-public-projection";

const url = process.env.WATCH_PRIVACY_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
	throw new Error("Use disposable local PostgreSQL");
const date = "2026-10-07T12:00:00.000Z";
describe.skipIf(!url)("content Privacy Alpha on PostgreSQL", () => {
	let db: PrismaClient;
	let pool: Pool;
	let coordinator: ContentPrivacyCoordinator;
	let projection: ContentPrivacyProjection;
	let locks: WatchAccountLock;
	let did: string;
	beforeAll(() => {
		db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
		pool = new Pool({
			connectionString: url,
			max: 2,
			query_timeout: 5000,
			connectionTimeoutMillis: 1000,
		});
		locks = new WatchAccountLock(pool);
		const prisma = db as PrismaService;
		coordinator = new ContentPrivacyCoordinator(prisma, locks);
		const movies = {
			getMovieByTMDBId: vi.fn().mockResolvedValue({ movieId: "550" }),
		} as unknown as MoviesService;
		const shows = {} as ShowsService;
		projection = new ContentPrivacyProjection(
			prisma,
			new LibraryService(prisma, movies, shows),
			new NotesService(prisma),
			new ListsService(prisma, movies, shows, coordinator),
		);
	});
	beforeEach(async () => {
		did = `did:plc:content-${crypto.randomUUID()}`;
		await db.user.create({
			data: {
				did,
				handle: `${crypto.randomUUID()}.test`,
				watchPrivacyEnabled: true,
			},
		});
		await db.movie.upsert({
			where: { movieId: "550" },
			create: { movieId: "550", title: "Test movie" },
			update: {},
		});
	});
	afterEach(async () => {
		await db.user.delete({ where: { did } });
	});
	afterAll(async () => {
		await db.$disconnect();
		await pool.end();
	});
	it.each(["library", "notes", "lists"] as const)(
		"round trips %s with full values and stable identity using standard deletion",
		async (category) => {
			const listRkey = category === "lists" ? "list-one" : undefined;
			const pds = privacyPdsFixture(
				did,
				privacyRepositoryConfig(category, listRkey),
			);
			const privacy = new ContentPrivacyService(
				db as PrismaService,
				coordinator,
				locks,
				projection,
				{ restore: vi.fn().mockResolvedValue(pds.session) },
			);
			const values: Array<[string, string, Record<string, unknown>]> =
				category === "library"
					? [
							[
								"xyz.opnshelf.library.item",
								"record-one",
								{
									mediaType: "movie",
									mediaId: "550",
									format: "bluray",
									createdAt: date,
								},
							],
						]
					: category === "notes"
						? [
								[
									"xyz.opnshelf.note",
									"record-one",
									{
										mediaType: "movie",
										mediaId: "550",
										content: "Keep the complete note",
										createdAt: date,
									},
								],
							]
						: [
								[
									"xyz.opnshelf.list",
									"list-one",
									{
										name: "One",
										slug: "one",
										isDefault: false,
										createdAt: date,
									},
								],
								[
									"xyz.opnshelf.list.item",
									"item-one",
									{
										listRkey: "list-one",
										mediaType: "movie",
										mediaId: "550",
										createdAt: date,
									},
								],
							];
			for (const [collection, rkey, value] of values)
				pds.seed(collection, rkey, {
					$type: collection,
					...value,
					extension: { preserve: "full record" },
				});
			const original = new Map(pds.publicRecords);
			if (category === "lists") {
				await db.list.create({
					data: {
						userDid: did,
						rkey: "list-one",
						uri: `at://${did}/xyz.opnshelf.list/list-one`,
						name: "One",
						slug: "one",
					},
				});
				pds.seed("xyz.opnshelf.list", "list-other", {
					$type: "xyz.opnshelf.list",
					name: "Other",
					slug: "other",
					isDefault: false,
					createdAt: date,
				});
				pds.seed("xyz.opnshelf.list.item", "item-other", {
					$type: "xyz.opnshelf.list.item",
					listRkey: "list-other",
					mediaType: "movie",
					mediaId: "550",
					createdAt: date,
				});
			}
			pds.disableConditionalDelete();
			const state = await privacy.start(
				did,
				pds.session,
				category,
				"private",
				false,
				listRkey,
			);
			expect(state).not.toBeNull();
			if (!state) throw new Error("Expected migration");
			await privacy.runMigration(state.id);
			expect(await db.privacyCopy.count({ where: { scopeId: state.id } })).toBe(
				values.length,
			);
			await expect(
				coordinator.write(did, category, listRkey, async () => {}),
			).rejects.toThrow("changing privacy");
			await privacy.runMigration(state.id);
			expect(
				(await db.privacyScope.findUniqueOrThrow({ where: { id: state.id } }))
					.visibility,
			).toBe("private");
			expect(await db.privacyCopy.count({ where: { scopeId: state.id } })).toBe(
				0,
			);
			for (const [key, value] of original) {
				expect(pds.publicRecords.has(key)).toBe(false);
				expect(pds.privateRecords.get(key)).toEqual(value);
			}
			const write = vi.fn();
			await projectContent(
				db as PrismaService,
				did,
				[state.key],
				"stream",
				write,
			);
			expect(write).not.toHaveBeenCalled();
			await privacy.start(did, pds.session, category, "public", true, listRkey);
			await privacy.runMigration(state.id);
			await privacy.runMigration(state.id);
			expect(
				(await db.privacyScope.findUniqueOrThrow({ where: { id: state.id } }))
					.visibility,
			).toBe("public");
			expect(pds.privateRecords.size).toBe(0);
			for (const [key, value] of original)
				expect(pds.publicRecords.get(key)).toEqual(value);
			if (category === "lists")
				expect(pds.publicRecords.has("xyz.opnshelf.list.item/item-other")).toBe(
					true,
				);
		},
	);
});
