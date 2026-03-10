import {
	listsControllerGetPublicUserListsOptions,
	type MovieListSummaryDto,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { List, ListPlus, Star } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import {
	M3Card,
	M3CardContent,
	M3CardDescription,
	M3CardHeader,
	M3CardTitle,
} from "@/components/ui/m3-card";
import { usePublicProfile } from "@/hooks/usePublicProfile";

export const Route = createFileRoute("/u/$handle/lists")({
	head: ({ params }) => ({
		meta: [{ title: `@${params.handle.replace(/^@/, "")} Lists | OpnShelf` }],
	}),
	component: PublicListsPage,
});

function PublicListsPage() {
	const { handle } = Route.useParams();
	const { data: profile } = usePublicProfile(handle);
	const { seedColor } = useTheme();

	const userDid = profile?.did ?? "";
	const displayName = String(
		profile?.displayName || profile?.handle || "This user",
	);
	const { data: lists, isLoading } = useQuery({
		...listsControllerGetPublicUserListsOptions({
			path: { userDid },
		}),
		enabled: !!userDid,
	});

	if (!profile) {
		return null;
	}

	if (isLoading) {
		return (
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{[1, 2, 3].map((item) => (
					<div
						key={item}
						className="h-32 animate-pulse rounded-lg"
						style={{
							backgroundColor: "var(--md-sys-color-surface-container-highest)",
						}}
					/>
				))}
			</div>
		);
	}

	if (!lists?.length) {
		return (
			<M3Card variant="elevated" className="mx-auto max-w-md text-center">
				<M3CardHeader>
					<ListPlus
						className="mx-auto mb-4 h-16 w-16"
						style={{ color: "var(--md-sys-color-outline)" }}
					/>
					<M3CardTitle className="md-headline-small">No lists yet</M3CardTitle>
					<M3CardDescription>
						{displayName} hasn&apos;t published any list summaries yet.
					</M3CardDescription>
				</M3CardHeader>
			</M3Card>
		);
	}

	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{lists.map((list) => (
				<PublicListSummaryCard
					key={list.id}
					list={list}
					seedColor={seedColor}
				/>
			))}
		</div>
	);
}

function PublicListSummaryCard({
	list,
	seedColor,
}: {
	list: MovieListSummaryDto;
	seedColor: string;
}) {
	const isFavorites = list.slug.includes("favorites");
	const Icon = isFavorites ? Star : List;

	return (
		<M3Card variant="elevated" className="h-full">
			<M3CardHeader className="pb-2">
				<div className="flex items-center gap-2">
					<div
						className="rounded-lg p-2"
						style={{
							backgroundColor: `${seedColor}20`,
							color: seedColor,
						}}
					>
						<Icon className="h-5 w-5" />
					</div>
					<div className="min-w-0 flex-1">
						<M3CardTitle className="truncate md-title-medium">
							{list.name}
						</M3CardTitle>
						{list.isDefault ? (
							<span className="md-label-small" style={{ color: seedColor }}>
								Default list
							</span>
						) : null}
					</div>
				</div>
			</M3CardHeader>
			<M3CardContent>
				{list.description ? (
					<M3CardDescription className="mb-2 line-clamp-2">
						{list.description}
					</M3CardDescription>
				) : null}
				<p
					className="md-body-medium"
					style={{ color: "var(--md-sys-color-on-surface-variant)" }}
				>
					{list.movieCount} item{list.movieCount !== 1 ? "s" : ""}
				</p>
			</M3CardContent>
		</M3Card>
	);
}
