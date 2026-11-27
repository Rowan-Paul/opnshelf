import {
	filterLibraryItems,
	LIBRARY_SORT_OPTIONS,
	type LibraryItemDto,
	type LibrarySort,
	libraryControllerGetUserLibraryOptions,
	libraryItemTitle,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PosterGridSkeleton } from "#/components/skeletons";
import {
	FORMAT_LABELS,
	LIBRARY_FORMATS,
	type LibraryFormat,
	ShowProgressScope,
} from "#/lib/hooks";
import ActionableMediaCard from "../../components/ActionableMediaCard";

function getPosterUrl(media: Record<string, unknown>): string {
	if (typeof media.posterPath === "string") {
		return `https://image.tmdb.org/t/p/w500${media.posterPath}`;
	}
	return "";
}

function getBackdropUrl(media: Record<string, unknown>): string | undefined {
	if (typeof media.backdropPath === "string") {
		return `https://image.tmdb.org/t/p/w780${media.backdropPath}`;
	}
	return undefined;
}

const CHIP =
	"rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-50";
const CHIP_ON = "border-(--accent) bg-(--accent)/10 text-(--accent-text)";
const CHIP_OFF =
	"border-(--border) text-(--foreground-muted) hover:border-(--border-strong)";

const LIBRARY_GRID =
	"grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7";

function LibraryGrid({ items }: { items: LibraryItemDto[] }) {
	return (
		<ShowProgressScope
			showIds={items
				.filter((item) => item.mediaType === "show")
				.map((item) => String(item.mediaId))}
		>
			<div className={`grid ${LIBRARY_GRID}`}>
				{items.map((item) => (
					<ActionableMediaCard
						key={item.id}
						fill
						id={String(item.mediaId)}
						title={libraryItemTitle(item)}
						posterUrl={getPosterUrl(item.media)}
						backdropUrl={getBackdropUrl(item.media)}
						type={item.mediaType === "movie" ? "movie" : "show"}
					/>
				))}
			</div>
		</ShowProgressScope>
	);
}

export function ProfileLibraryPage({ userDid }: { userDid: string }) {
	const [formatFilter, setFormatFilter] = useState<LibraryFormat | "all">(
		"all",
	);
	const [search, setSearch] = useState("");
	const [sort, setSort] = useState<LibrarySort>("added");
	const [groupByFormat, setGroupByFormat] = useState(false);

	const { data: items, isLoading } = useQuery({
		...libraryControllerGetUserLibraryOptions({ path: { userDid } }),
		enabled: !!userDid,
	});

	const filtered = useMemo(
		() =>
			filterLibraryItems(items ?? [], { format: formatFilter, search, sort }),
		[items, formatFilter, search, sort],
	);

	const grouped = useMemo(() => {
		if (!groupByFormat) return null;
		// Render in the canonical format order, skipping empty groups.
		return LIBRARY_FORMATS.map(({ value }) => ({
			format: value,
			items: filtered.filter((item) => item.format === value),
		})).filter((group) => group.items.length > 0);
	}, [filtered, groupByFormat]);

	return (
		<div className="space-y-6">
			<h1 className="text-display-2">Library</h1>
			{isLoading ? (
				<PosterGridSkeleton gridClassName={LIBRARY_GRID} />
			) : !items || items.length === 0 ? (
				<div className="py-10 text-center text-(--foreground-muted) text-sm">
					Nothing owned yet.
				</div>
			) : (
				<div className="space-y-4">
					<div className="flex flex-wrap gap-2">
						<input
							type="search"
							aria-label="Search Library"
							placeholder="Search by title or Box Set"
							className="input min-w-0 flex-1 basis-56"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
						/>
						<select
							aria-label="Sort Library by"
							className="input w-auto!"
							value={sort}
							onChange={(event) => {
								const option = LIBRARY_SORT_OPTIONS.find(
									({ value }) => value === event.target.value,
								);
								if (option) setSort(option.value);
							}}
						>
							{LIBRARY_SORT_OPTIONS.map(({ value, label }) => (
								<option key={value} value={value}>
									{label}
								</option>
							))}
						</select>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<button
							type="button"
							onClick={() => setFormatFilter("all")}
							className={`${CHIP} ${formatFilter === "all" ? CHIP_ON : CHIP_OFF}`}
						>
							All
						</button>
						{LIBRARY_FORMATS.map(({ value, label }) => (
							<button
								key={value}
								type="button"
								onClick={() => setFormatFilter(value)}
								className={`${CHIP} ${formatFilter === value ? CHIP_ON : CHIP_OFF}`}
							>
								{label}
							</button>
						))}
						<button
							type="button"
							onClick={() => setGroupByFormat((v) => !v)}
							className={`${CHIP} ml-auto ${groupByFormat ? CHIP_ON : CHIP_OFF}`}
						>
							{groupByFormat ? "Grouped by format" : "Group by format"}
						</button>
					</div>

					{filtered.length === 0 ? (
						<div className="space-y-2 py-10 text-center text-(--foreground-muted) text-sm">
							<output className="block">No Library Items match.</output>
							{search && (
								<button
									type="button"
									className="btn btn-secondary"
									onClick={() => setSearch("")}
								>
									Clear search
								</button>
							)}
						</div>
					) : grouped ? (
						<div className="space-y-6">
							{grouped.map((group) => (
								<section key={group.format} className="space-y-2">
									<h3 className="text-(--foreground) text-display-3">
										{FORMAT_LABELS[group.format]}
									</h3>
									<LibraryGrid items={group.items} />
								</section>
							))}
						</div>
					) : (
						<LibraryGrid items={filtered} />
					)}
				</div>
			)}
		</div>
	);
}
