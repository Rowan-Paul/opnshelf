import {
	type LibraryItemDto,
	libraryControllerGetUserLibraryOptions,
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

function getTitle(media: Record<string, unknown>): string {
	if (typeof media.title === "string") return media.title;
	if (typeof media.name === "string") return media.name;
	return "Unknown";
}

function getPosterUrl(media: Record<string, unknown>): string {
	if (typeof media.posterPath === "string") {
		return `https://image.tmdb.org/t/p/w500${media.posterPath}`;
	}
	return "";
}

function getBackdropUrl(media: Record<string, unknown>): string | undefined {
	if (typeof media.backdropPath === "string") {
		return `https://image.tmdb.org/t/p/original${media.backdropPath}`;
	}
	return undefined;
}

const CHIP =
	"rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-50";
const CHIP_ON = "border-(--accent) bg-(--accent)/10 text-(--accent)";
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
						title={getTitle(item.media)}
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
	const [groupByFormat, setGroupByFormat] = useState(false);

	const { data: items, isLoading } = useQuery({
		...libraryControllerGetUserLibraryOptions({ path: { userDid } }),
		enabled: !!userDid,
	});

	const filtered = useMemo(() => {
		const all = items ?? [];
		return formatFilter === "all"
			? all
			: all.filter((item) => item.format === formatFilter);
	}, [items, formatFilter]);

	const grouped = useMemo(() => {
		if (!groupByFormat) return null;
		// Render in the canonical format order, skipping empty groups.
		return LIBRARY_FORMATS.map(({ value }) => ({
			format: value,
			items: filtered.filter((item) => item.format === value),
		})).filter((group) => group.items.length > 0);
	}, [filtered, groupByFormat]);

	if (isLoading) {
		return <PosterGridSkeleton gridClassName={LIBRARY_GRID} />;
	}

	if (!items || items.length === 0) {
		return (
			<div className="py-10 text-center text-(--foreground-muted) text-sm">
				Nothing owned yet.
			</div>
		);
	}

	return (
		<div className="space-y-4">
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

			{grouped ? (
				<div className="space-y-6">
					{grouped.map((group) => (
						<section key={group.format} className="space-y-2">
							<h3 className="font-display font-semibold text-(--foreground) text-lg">
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
	);
}
