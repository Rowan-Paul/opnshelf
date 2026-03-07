import {
	listsControllerGetUserListsOptions,
	shelfControllerGetUserShelfOptions,
	showsControllerGetUserUpNextOptions,
	type UserDto,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarRange, LayoutDashboard, Search } from "lucide-react";
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

	const { data: lists, isLoading: isListsLoading } = useQuery({
		...listsControllerGetUserListsOptions(),
		enabled: !!user.did,
	});

	const { data: upNext, isLoading: isUpNextLoading } = useQuery({
		...showsControllerGetUserUpNextOptions({
			path: { userDid: user.did },
		}),
		enabled: !!user.did,
	});

	const { recentWatched, watchedInRangeCount, activityBars } = useMemo(() => {
		const now = Date.now();
		const days = range === "week" ? 7 : 30;
		const cutoff = now - days * 24 * 60 * 60 * 1000;

		const items = shelfData?.items ?? [];

		const sorted = [...items].sort((a, b) => {
			const dateA = new Date(a.watchedDate ?? a.createdAt).getTime();
			const dateB = new Date(b.watchedDate ?? b.createdAt).getTime();
			return dateB - dateA;
		});

		const inRange = sorted.filter((item) => {
			const date = new Date(item.watchedDate ?? item.createdAt).getTime();
			return date >= cutoff;
		});

		return {
			recentWatched: sorted.slice(0, 8),
			watchedInRangeCount: inRange.length,
			activityBars: buildActivityBars(sorted, range),
		};
	}, [shelfData, range]);

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

	const metricCards = [
		{
			key: "watched",
			icon: CalendarRange,
			label: `Watched ${range === "week" ? "7 days" : "30 days"}`,
			value: watchedInRangeCount,
		},
	] as const;

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
							<LayoutDashboard className="h-7 w-7 text-[var(--md-sys-color-primary)]" />
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
						upNext={upNext ?? []}
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
										<p className="text-sm font-semibold text-[var(--md-sys-color-on-surface)]">
											Viewing rhythm
										</p>
										<p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
											{range === "week" ? "Last 7 days" : "Weekly activity"}
										</p>
									</div>
									<p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
										{activityBars.reduce((sum, bar) => sum + bar.value, 0)}{" "}
										watched
									</p>
								</div>
								<div className="grid grid-cols-7 gap-2">
									{activityBars.map((bar) => (
										<div
											key={bar.label}
											className="flex min-w-0 flex-col items-center gap-2"
										>
											<div className="flex h-24 w-full items-end overflow-hidden rounded-2xl bg-[color:rgba(127,127,127,0.14)] px-1 py-1">
												<div
													className="w-full rounded-xl bg-[var(--md-sys-color-primary)]"
													style={{
														height: `${Math.max((bar.value / maxActivityValue) * 100, bar.value > 0 ? 18 : 8)}%`,
													}}
												/>
											</div>
											<span className="text-xs font-semibold text-[var(--md-sys-color-on-surface)]">
												{bar.value}
											</span>
											<span className="text-[11px] text-[var(--md-sys-color-on-surface-variant)]">
												{bar.label}
											</span>
										</div>
									))}
								</div>
							</div>
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1">
								{metricCards.map((metric) => {
									const Icon = metric.icon;

									return (
										<div
											key={metric.key}
											className="rounded-[24px] border p-4"
											style={{
												backgroundColor:
													"var(--md-sys-color-surface-container)",
												borderColor: "var(--md-sys-color-outline-variant)",
											}}
										>
											<div
												className="mb-3 flex items-center gap-2 text-sm font-medium"
												style={{
													color: "var(--md-sys-color-on-surface-variant)",
												}}
											>
												<Icon className="h-4 w-4 text-[var(--md-sys-color-primary)]" />
												<span>{metric.label}</span>
											</div>
											<p className="text-3xl font-semibold tracking-tight text-[var(--md-sys-color-on-surface)]">
												{metric.value}
											</p>
											{metric.caption ? (
												<p
													className="mt-1 text-sm"
													style={{
														color: "var(--md-sys-color-on-surface-variant)",
													}}
												>
													{metric.caption}
												</p>
											) : null}
										</div>
									);
								})}
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
							<Link to="/profile/shelf">View shelf</Link>
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
	items: Array<{ watchedDate?: string | null; createdAt: string }>,
	range: DashboardRange,
) {
	const bucketSize = range === "week" ? 1 : 7;
	const bucketCount = 7;
	const endOfToday = new Date();
	endOfToday.setHours(23, 59, 59, 999);

	const start = new Date(endOfToday);
	start.setDate(start.getDate() - (bucketSize * bucketCount - 1));
	start.setHours(0, 0, 0, 0);

	return Array.from({ length: bucketCount }, (_, index) => {
		const bucketStart = new Date(start);
		bucketStart.setDate(start.getDate() + index * bucketSize);

		const bucketEnd = new Date(bucketStart);
		bucketEnd.setDate(bucketStart.getDate() + bucketSize - 1);
		bucketEnd.setHours(23, 59, 59, 999);

		const value = items.filter((item) => {
			const watchedAt = new Date(item.watchedDate ?? item.createdAt).getTime();
			return (
				watchedAt >= bucketStart.getTime() && watchedAt <= bucketEnd.getTime()
			);
		}).length;

		return {
			label:
				range === "week"
					? bucketStart
							.toLocaleDateString(undefined, { weekday: "short" })
							.slice(0, 3)
					: `W${index + 1}`,
			value,
		};
	});
}
