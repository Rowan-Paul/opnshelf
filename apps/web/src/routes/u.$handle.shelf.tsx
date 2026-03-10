import { shelfControllerGetUserShelfOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookOpen, Loader2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { PaginationControls } from "@/components/PaginationControls";
import { ShelfEpisodeCard } from "@/components/ShelfEpisodeCard";
import { ShelfMovieCard } from "@/components/ShelfMovieCard";
import {
	M3Card,
	M3CardDescription,
	M3CardHeader,
	M3CardTitle,
} from "@/components/ui/m3-card";
import { useUserSettings } from "@/hooks/useUserSettings";
import { usePublicProfile } from "@/hooks/usePublicProfile";
import { getVisiblePages, parsePageNumber } from "@/lib/pagination";
import { getDayKeyInTimezone, getShelfDayLabel } from "@/lib/utils";

const PAGE_SIZE = 24;

export const Route = createFileRoute("/u/$handle/shelf")({
	validateSearch: (search: Record<string, unknown>) => ({
		page: parsePageNumber(search.page),
	}),
	head: ({ params }) => ({
		meta: [{ title: `@${params.handle.replace(/^@/, "")} Shelf | OpnShelf` }],
	}),
	component: PublicShelfPage,
});

function PublicShelfPage() {
	const { handle } = Route.useParams();
	const { page } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const { data: profile } = usePublicProfile(handle);
	const { timezone } = useUserSettings();

	const userDid = profile?.did ?? "";
	const displayName = String(profile?.displayName || profile?.handle || "This user");
	const shelfQuery = useQuery({
		...shelfControllerGetUserShelfOptions({
			path: { userDid },
			query: { page, pageSize: PAGE_SIZE },
		}),
		enabled: !!userDid,
	});

	const items = shelfQuery.data?.items ?? [];
	const currentPage = shelfQuery.data?.page ?? page;
	const totalPages = shelfQuery.data?.totalPages ?? 0;
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

	if (!profile) {
		return null;
	}

	if (shelfQuery.isLoading) {
		return (
			<div className="flex justify-center py-12">
				<Loader2 className="h-8 w-8 animate-spin" />
			</div>
		);
	}

	if (items.length === 0) {
		return (
			<M3Card variant="elevated" className="mx-auto max-w-md text-center">
				<M3CardHeader>
					<BookOpen
						className="mx-auto mb-4 h-16 w-16"
						style={{ color: "var(--md-sys-color-outline)" }}
					/>
					<M3CardTitle className="md-headline-small">
						{displayName}&apos;s shelf is empty
					</M3CardTitle>
					<M3CardDescription>
						No watched movies or episodes have been added yet.
					</M3CardDescription>
				</M3CardHeader>
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
							className="mb-4 flex flex-col gap-1 rounded-[22px] border px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-3"
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
										user={undefined}
										readOnly
									/>
								) : (
									<ShelfEpisodeCard
										key={item.id}
										tracked={item as never}
										user={undefined}
										readOnly
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
