import {
	listsControllerGetUserListsOptions,
	type ShelfActivityBucketDto,
	type ShelfActivitySummaryDto,
	shelfControllerGetUserActivitySummaryOptions,
	shelfControllerGetUserShelfOptions,
	showsControllerGetUserUpNextOptions,
	type UserDto,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { LayoutDashboard, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { CreateListDialog } from "@/components/CreateListDialog";
import { UpNextSection } from "@/components/home/UpNextSection";
import { ListCard } from "@/components/ListCard";
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

type DashboardRange = "week" | "month";

export function DashboardHomePage({ user }: { user: UserDto }) {
	const [range, setRange] = useState<DashboardRange>("week");
	const displayName =
		(user as unknown as { displayName?: string | null }).displayName ??
		user.handle;

	const { data: shelfData, isLoading } = useQuery({
		...shelfControllerGetUserShelfOptions({
			path: { userDid: user.did },
			query: { page: 1, pageSize: 6 },
		}),
		enabled: !!user.did,
	});

	const { data: activitySummary } = useQuery({
		...shelfControllerGetUserActivitySummaryOptions({
			path: { userDid: user.did },
		}),
		enabled: !!user.did,
	});

	const { data: lists, isLoading: isListsLoading } = useQuery({
		...listsControllerGetUserListsOptions(),
		enabled: !!user.did,
	});

	const { data: upNext, isLoading: isUpNextLoading } = useQuery({
		...showsControllerGetUserUpNextOptions({
			path: { userDid: user.did },
			query: { page: 1, pageSize: 4 },
		}),
		enabled: !!user.did,
	});

	const { recentWatched } = useMemo(() => {
		const items = shelfData?.items ?? [];

		const sorted = [...items].sort((a, b) => {
			const dateA = new Date(a.watchedDate ?? a.createdAt).getTime();
			const dateB = new Date(b.watchedDate ?? b.createdAt).getTime();
			return dateB - dateA;
		});

		return {
			recentWatched: sorted.slice(0, 8),
		};
	}, [shelfData]);

	const activityBars = useMemo(
		() => buildActivityBars(activitySummary?.dailyActivity, range),
		[activitySummary?.dailyActivity, range],
	);
	const watchedInRangeCount =
		range === "week"
			? (activitySummary?.watchedLast7Days ?? 0)
			: (activitySummary?.watchedLast30Days ?? 0);

	const maxActivityValue = Math.max(...activityBars.map((bar) => bar.value), 1);

	const { recentLists } = useMemo(() => {
		const listItems = lists ?? [];
		const sortedLists = [...listItems].sort((a, b) => {
			return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
		});

		return {
			recentLists: sortedLists.slice(0, 6),
		};
	}, [lists]);

	return (
		<div className="container mx-auto max-w-6xl px-4 py-8 md:py-10">
			<div
				className="mb-8 rounded-[28px] border p-5 md:p-6"
				style={{
					backgroundColor: "var(--md-sys-color-surface-container-high)",
					borderColor: "var(--md-sys-color-outline-variant)",
				}}
			>
				<div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
					<div className="flex items-center gap-4">
						<div
							className="flex size-14 shrink-0 items-center justify-center rounded-full"
							style={{
								backgroundColor: "var(--md-sys-color-primary-container)",
							}}
						>
							<LayoutDashboard className="h-7 w-7 text-(--md-sys-color-primary)" />
						</div>
						<div className="min-w-0">
							<h1 className="md-display-small mb-1">Dashboard</h1>
							<p
								className="md-body-large"
								style={{ color: "var(--md-sys-color-on-surface-variant)" }}
							>
								Welcome back, {displayName}
							</p>
						</div>
					</div>
					<M3Button
						variant="filled"
						asChild
						className="h-12 rounded-full px-6 md:min-w-40"
					>
						<Link to="/search" search={{ q: "", type: "all" }}>
							<Search className="size-5" />
							Search
						</Link>
					</M3Button>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
				<div className="lg:col-span-3">
					<UpNextSection
						isLoading={isUpNextLoading}
						upNext={upNext?.items ?? []}
						userDid={user.did}
					/>
				</div>

				<div className="lg:col-span-2">
					<M3Card
						variant="elevated"
						className="h-full rounded-[28px] border"
						style={{ borderColor: "var(--md-sys-color-outline-variant)" }}
					>
						<M3CardHeader>
							<M3CardTitle className="md-title-large">At a glance</M3CardTitle>
							<M3CardDescription>
								A lighter read on your recent momentum.
							</M3CardDescription>
						</M3CardHeader>
						<M3CardContent className="space-y-5">
							<div
								className="inline-flex w-full flex-wrap gap-2 rounded-full border p-1"
								style={{
									backgroundColor: "var(--md-sys-color-surface-container)",
									borderColor: "var(--md-sys-color-outline-variant)",
								}}
							>
								<M3Button
									size="sm"
									variant={range === "week" ? "filled-tonal" : "text"}
									className="min-w-24 flex-1 rounded-full"
									onClick={() => setRange("week")}
								>
									Week
								</M3Button>
								<M3Button
									size="sm"
									variant={range === "month" ? "filled-tonal" : "text"}
									className="min-w-24 flex-1 rounded-full"
									onClick={() => setRange("month")}
								>
									Month
								</M3Button>
							</div>
							<div
								className="rounded-[24px] border p-4"
								style={{
									backgroundColor: "var(--md-sys-color-surface-container)",
									borderColor: "var(--md-sys-color-outline-variant)",
								}}
							>
								<div className="mb-4 flex items-center justify-between gap-3">
									<div>
										<p className="text-sm font-semibold text-(--md-sys-color-on-surface)">
											Viewing rhythm
										</p>
										<p className="text-xs text-(--md-sys-color-on-surface-variant)">
											{range === "week" ? "Last 7 days" : "Past 30 days"}
										</p>
									</div>
									<p className="text-xs text-(--md-sys-color-on-surface-variant)">
										{watchedInRangeCount} watched
									</p>
								</div>
								<div
									className={range === "month" ? "overflow-x-auto pb-2" : ""}
								>
									<div
										className={
											range === "month"
												? "flex min-w-[720px] gap-2"
												: "grid grid-cols-7 gap-2"
										}
									>
										{activityBars.map((bar) => (
											<div
												key={bar.key}
												className={`flex min-w-0 flex-col items-center gap-2 ${
													range === "month" ? "w-5 shrink-0" : ""
												}`}
											>
												<div className="flex h-24 w-full items-end overflow-hidden rounded-2xl bg-[rgba(127,127,127,0.14)] px-1 py-1">
													<div
														className="w-full rounded-xl bg-(--md-sys-color-primary)"
														style={{
															height: `${Math.max((bar.value / maxActivityValue) * 100, bar.value > 0 ? 18 : 8)}%`,
														}}
													/>
												</div>
												<span className="text-xs font-semibold text-(--md-sys-color-on-surface)">
													{bar.value}
												</span>
												<span className="min-h-4 text-center text-[11px] text-(--md-sys-color-on-surface-variant)">
													{bar.showLabel ? bar.label : ""}
												</span>
											</div>
										))}
									</div>
								</div>
							</div>
						</M3CardContent>
					</M3Card>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-8">
				<div className="lg:col-span-3">
					<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
						<h2 className="md-headline-small">Recent Watched</h2>
						<M3Button variant="text" className="rounded-full px-4" asChild>
							<Link to="/profile/shelf" search={{ page: 1 }}>
								View shelf
							</Link>
						</M3Button>
					</div>
					{isLoading ? (
						<div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
							{[1, 2, 3, 4, 5, 6].map((i) => (
								<div
									key={i}
									className="aspect-2/3 rounded-lg animate-pulse"
									style={{
										backgroundColor:
											"var(--md-sys-color-surface-container-high)",
									}}
								/>
							))}
						</div>
					) : recentWatched.length > 0 ? (
						<div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
							{recentWatched.map((item) =>
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
					) : (
						<M3Card
							variant="elevated"
							className="rounded-[28px] border"
							style={{ borderColor: "var(--md-sys-color-outline-variant)" }}
						>
							<M3CardHeader>
								<M3CardTitle>No items watched yet</M3CardTitle>
								<M3CardDescription>
									Start adding watched items and your activity appears here.
								</M3CardDescription>
							</M3CardHeader>
							<M3CardContent>
								<M3Button
									variant="filled"
									className="rounded-full px-6"
									asChild
								>
									<Link to="/search" search={{ q: "", type: "all" }}>
										Search
									</Link>
								</M3Button>
							</M3CardContent>
						</M3Card>
					)}
				</div>

				<div className="lg:col-span-2">
					<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
						<h2 className="md-headline-small">Your Lists</h2>
						<M3Button variant="text" className="rounded-full px-4" asChild>
							<Link to="/profile/lists">All lists</Link>
						</M3Button>
					</div>
					<div className="mb-4">
						<CreateListDialog triggerClassName="ml-0 h-12 w-full justify-center rounded-full px-6 sm:w-auto" />
					</div>
					{isListsLoading ? (
						<div className="grid grid-cols-1 gap-4">
							{[1, 2, 3].map((i) => (
								<div
									key={i}
									className="h-28 rounded-lg animate-pulse"
									style={{
										backgroundColor:
											"var(--md-sys-color-surface-container-high)",
									}}
								/>
							))}
						</div>
					) : recentLists.length > 0 ? (
						<div className="grid grid-cols-1 gap-4">
							{recentLists.map((list) => (
								<ListCard key={list.id} list={list} />
							))}
						</div>
					) : (
						<M3Card
							variant="elevated"
							className="rounded-[28px] border"
							style={{ borderColor: "var(--md-sys-color-outline-variant)" }}
						>
							<M3CardHeader>
								<M3CardTitle>No lists yet</M3CardTitle>
								<M3CardDescription>
									Create your first list to organize items.
								</M3CardDescription>
							</M3CardHeader>
						</M3Card>
					)}
				</div>
			</div>
		</div>
	);
}

function buildActivityBars(
	dailyActivity: ShelfActivitySummaryDto["dailyActivity"] | undefined,
	range: DashboardRange,
) {
	const visibleBuckets =
		range === "week" ? (dailyActivity?.slice(-7) ?? []) : (dailyActivity ?? []);

	if (visibleBuckets.length === 0) {
		return Array.from({ length: range === "week" ? 7 : 30 }, (_, index) => ({
			key: `placeholder-${range}-${index}`,
			value: 0,
			label: "",
			showLabel: false,
		}));
	}

	return visibleBuckets.map((bucket, index) => ({
		key: bucket.date,
		value: bucket.count,
		label:
			range === "week"
				? formatDayKey(bucket, { weekday: "short" }).slice(0, 3)
				: formatDayKey(bucket, { month: "short", day: "numeric" }),
		showLabel:
			range === "week" ||
			index % 5 === 0 ||
			index === visibleBuckets.length - 1,
	}));
}

function formatDayKey(
	bucket: ShelfActivityBucketDto,
	options: Intl.DateTimeFormatOptions,
) {
	const [year, month, day] = bucket.date.split("-").map(Number);
	return new Intl.DateTimeFormat(undefined, {
		...options,
		timeZone: "UTC",
	}).format(new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0)));
}
