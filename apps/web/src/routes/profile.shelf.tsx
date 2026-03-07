import { shelfControllerGetUserShelfOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BookOpen, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { ShelfEpisodeCard } from "@/components/ShelfEpisodeCard";
import { ShelfMovieCard } from "@/components/ShelfMovieCard";
import { M3Button } from "@/components/ui/m3-button";
import {
	M3Card,
	M3CardContent,
	M3CardDescription,
	M3CardHeader,
	M3CardTitle,
} from "@/components/ui/m3-card";
import { useUserSettings } from "@/hooks/useUserSettings";
import { getDayKeyInTimezone, getShelfDayLabel } from "@/lib/utils";

const PAGE_SIZE = 24;

export const Route = createFileRoute("/profile/shelf")({
	validateSearch: (search: Record<string, unknown>) => ({
		page: parsePageNumber(search.page),
	}),
	head: () => ({
		meta: [{ title: "My Shelf | OpnShelf" }],
	}),
	component: ShelfPage,
});

function ShelfPage() {
	const { user, timezone } = useUserSettings();
	const { page } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });

	const userDid = user?.did || "";

	const shelfQuery = useQuery({
		...shelfControllerGetUserShelfOptions({
			path: { userDid },
			query: { page, pageSize: PAGE_SIZE },
		}),
		enabled: !!userDid,
	});

	const items = shelfQuery.data?.items ?? [];
	const totalCount = shelfQuery.data?.total ?? 0;
	const currentPage = shelfQuery.data?.page ?? page;
	const totalPages = shelfQuery.data?.totalPages ?? 0;
	const pageSize = shelfQuery.data?.pageSize ?? PAGE_SIZE;
	const pageNumbers = useMemo(
		() => getVisiblePages(currentPage, totalPages),
		[currentPage, totalPages],
	);

	const daySections = useMemo(() => {
		const sections: Array<{
			dayKey: string;
			label: string;
			items: typeof items;
		}> = [];
		const sectionByKey = new Map<
			string,
			{
				dayKey: string;
				label: string;
				items: typeof items;
			}
		>();

		for (const item of items) {
			const watchedAt = item.watchedDate ?? item.createdAt;
			const dayKey = getDayKeyInTimezone(watchedAt, timezone);
			const existingSection = sectionByKey.get(dayKey);

			if (existingSection) {
				existingSection.items.push(item);
				continue;
			}

			const nextSection = {
				dayKey,
				label: getShelfDayLabel(dayKey, timezone),
				items: [item],
			};

			sectionByKey.set(dayKey, nextSection);
			sections.push(nextSection);
		}

		return sections;
	}, [items, timezone]);

	useEffect(() => {
		if (!shelfQuery.data) {
			return;
		}

		if (shelfQuery.data.page !== page) {
			navigate({
				search: { page: shelfQuery.data.page },
				replace: true,
				resetScroll: false,
			});
		}
	}, [navigate, page, shelfQuery.data]);

	if (shelfQuery.isLoading) {
		return (
			<div className="flex justify-center py-12">
				<Loader2 className="w-8 h-8 animate-spin" />
			</div>
		);
	}

	if (items.length === 0) {
		return (
			<M3Card variant="elevated" className="text-center max-w-md mx-auto">
				<M3CardHeader>
					<BookOpen
						className="w-16 h-16 mx-auto mb-4"
						style={{ color: "var(--md-sys-color-outline)" }}
					/>
					<M3CardTitle className="md-headline-small">
						Your shelf is empty
					</M3CardTitle>
					<M3CardDescription>
						Start tracking movies and shows you&apos;ve watched
					</M3CardDescription>
				</M3CardHeader>
				<M3CardContent>
					<M3Button variant="filled" asChild>
						<Link to="/search" search={{ q: "", type: "all" }}>
							Search for movies or shows
						</Link>
					</M3Button>
				</M3CardContent>
			</M3Card>
		);
	}

	return (
		<div className="space-y-6">
			<PaginationControls
				currentPage={currentPage}
				totalPages={totalPages}
				pageNumbers={pageNumbers}
				isFetching={shelfQuery.isFetching}
				onPageChange={(nextPage) => {
					navigate({ search: { page: nextPage } });
				}}
			/>

			<div className="space-y-6">
				{daySections.map((section) => (
					<section
						key={section.dayKey}
						className="rounded-[28px] border p-4 md:p-5"
						style={{
							backgroundColor: "var(--md-sys-color-surface-container-low)",
							borderColor: "var(--md-sys-color-outline-variant)",
						}}
					>
						<div
							className="mb-4 flex items-center justify-between gap-3 rounded-[22px] border px-4 py-3"
							style={{
								backgroundColor:
									"var(--md-sys-color-surface-container-highest)",
								borderColor: "var(--md-sys-color-outline-variant)",
							}}
						>
							<h2 className="md-title-large">{section.label}</h2>
							<p
								className="md-body-small"
								style={{ color: "var(--md-sys-color-on-surface-variant)" }}
							>
								{section.items.length} item
								{section.items.length !== 1 ? "s" : ""}
							</p>
						</div>

						<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
							{section.items.map((item) =>
								item.type === "movie" ? (
									<ShelfMovieCard
										key={item.id}
										tracked={item as never}
										user={user}
									/>
								) : (
									<ShelfEpisodeCard
										key={item.id}
										tracked={item as never}
										user={user}
									/>
								),
							)}
						</div>
					</section>
				))}
			</div>

			<PaginationControls
				currentPage={currentPage}
				totalPages={totalPages}
				pageNumbers={pageNumbers}
				isFetching={shelfQuery.isFetching}
				onPageChange={(nextPage) => {
					navigate({ search: { page: nextPage } });
				}}
			/>
		</div>
	);
}

function PaginationControls({
	currentPage,
	totalPages,
	pageNumbers,
	isFetching,
	onPageChange,
}: {
	currentPage: number;
	totalPages: number;
	pageNumbers: Array<number | "ellipsis">;
	isFetching: boolean;
	onPageChange: (page: number) => void;
}) {
	if (totalPages <= 1) {
		return null;
	}

	return (
		<div
			className="grid gap-3 rounded-[28px] border px-4 py-4 md:grid-cols-[1fr_auto_1fr] md:items-center"
			style={{
				backgroundColor: "var(--md-sys-color-surface-container)",
				borderColor: "var(--md-sys-color-outline-variant)",
			}}
		>
			<div className="flex items-center gap-2 md:justify-self-start">
				<M3Button
					variant="outlined"
					size="sm"
					disabled={currentPage <= 1 || isFetching}
					onClick={() => onPageChange(currentPage - 1)}
				>
					<ChevronLeft className="size-4" />
					Previous
				</M3Button>
			</div>

			<div className="flex flex-wrap items-center justify-center gap-2 md:justify-self-center">
				{pageNumbers.map((pageNumber, index) =>
					pageNumber === "ellipsis" ? (
						<span
							key={`ellipsis-${index}`}
							className="px-1 text-sm"
							style={{ color: "var(--md-sys-color-on-surface-variant)" }}
						>
							...
						</span>
					) : (
						<M3Button
							key={pageNumber}
							variant={pageNumber === currentPage ? "filled-tonal" : "text"}
							size="sm"
							onClick={() => onPageChange(pageNumber)}
							disabled={isFetching && pageNumber === currentPage}
							aria-current={pageNumber === currentPage ? "page" : undefined}
						>
							{pageNumber}
						</M3Button>
					),
				)}
			</div>

			<div className="flex items-center gap-2 md:justify-self-end">
				<M3Button
					variant="outlined"
					size="sm"
					disabled={currentPage >= totalPages || isFetching}
					onClick={() => onPageChange(currentPage + 1)}
				>
					Next
					<ChevronRight className="size-4" />
				</M3Button>
			</div>
		</div>
	);
}

function parsePageNumber(input: unknown) {
	const parsed = Number(input);
	if (!Number.isInteger(parsed) || parsed < 1) {
		return 1;
	}

	return parsed;
}

function getVisiblePages(currentPage: number, totalPages: number) {
	if (totalPages <= 0) {
		return [];
	}

	if (totalPages <= 5) {
		return Array.from({ length: totalPages }, (_, index) => index + 1);
	}

	const pages = new Set<number>([
		1,
		Math.max(currentPage - 1, 1),
		currentPage,
		Math.min(currentPage + 1, totalPages),
		totalPages,
	]);

	const orderedPages = [...pages]
		.filter((page) => page >= 1 && page <= totalPages)
		.sort((a, b) => a - b);

	const visiblePages: Array<number | "ellipsis"> = [];

	for (let index = 0; index < orderedPages.length; index += 1) {
		const page = orderedPages[index];
		const previousPage = orderedPages[index - 1];

		if (previousPage && page - previousPage > 1) {
			visiblePages.push("ellipsis");
		}

		visiblePages.push(page);
	}

	return visiblePages;
}
