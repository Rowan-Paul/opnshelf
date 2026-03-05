import { shelfControllerGetUserShelfOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Loader2 } from "lucide-react";
import { useMemo } from "react";
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

export const Route = createFileRoute("/profile/shelf")({
	head: () => ({
		meta: [{ title: "My Shelf | OpnShelf" }],
	}),
	component: ShelfPage,
});

function ShelfPage() {
	const { user, timezone } = useUserSettings();

	const userDid = user?.did || "";

	const shelfQuery = useQuery({
		...shelfControllerGetUserShelfOptions({
			path: { userDid },
			query: { limit: 100 },
		}),
		enabled: !!userDid,
	});

	const items = shelfQuery.data?.items ?? [];
	const totalCount = shelfQuery.data?.total ?? 0;

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
		<div>
			<p
				className="mb-6 md-body-large"
				style={{ color: "var(--md-sys-color-on-surface-variant)" }}
			>
				{totalCount} item{totalCount !== 1 ? "s" : ""} watched
			</p>

			<div className="space-y-8">
				{daySections.map((section) => (
					<section key={section.dayKey}>
						<div
							className="sticky top-16 z-20 -mx-2 px-2 py-2 border-b"
							style={{
								backgroundColor: "var(--md-sys-color-surface)",
								borderColor: "var(--md-sys-color-outline-variant)",
								boxShadow: "0 1px 0 0 var(--md-sys-color-outline-variant)",
							}}
						>
							<div className="flex items-center justify-between gap-3">
								<h2 className="md-title-medium">{section.label}</h2>
								<p
									className="md-body-small"
									style={{ color: "var(--md-sys-color-on-surface-variant)" }}
								>
									{section.items.length} item
									{section.items.length !== 1 ? "s" : ""}
								</p>
							</div>
						</div>

						<div className="pt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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
		</div>
	);
}
