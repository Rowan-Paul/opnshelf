import {
	listsControllerGetPublicUserListsOptions,
	listsControllerGetUserListsOptions,
	type MovieListSummaryDto,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { List, ListPlus, Star } from "lucide-react";
import { CreateListDialog } from "@/components/CreateListDialog";
import { ListCard } from "@/components/ListCard";
import { useTheme } from "@/components/theme-provider";
import {
	M3Card,
	M3CardContent,
	M3CardDescription,
	M3CardHeader,
	M3CardTitle,
} from "@/components/ui/m3-card";
import { useProfileRouteState } from "@/hooks/useProfileRouteState";
import { getProfileListDetailRoute } from "@/lib/profile-routes";

export const Route = createFileRoute("/profile/$handle/lists")({
	head: ({ params }) => ({
		meta: [{ title: `@${params.handle.replace(/^@/, "")} Lists | OpnShelf` }],
	}),
	component: ProfileListsPage,
});

function ProfileListsPage() {
	const { handle } = Route.useParams();
	const { profile, currentUser, isOwner } = useProfileRouteState(handle);
	const { seedColor } = useTheme();

	const userDid = profile?.did ?? "";
	const displayName = String(
		profile?.displayName || profile?.handle || "This user",
	);
	const ownerListsQuery = useQuery({
		...listsControllerGetUserListsOptions(),
		enabled: isOwner && !!currentUser?.did,
	});
	const publicListsQuery = useQuery({
		...listsControllerGetPublicUserListsOptions({
			path: { userDid },
		}),
		enabled: !isOwner && !!userDid,
	});

	if (!profile) {
		return null;
	}

	const lists = isOwner ? ownerListsQuery.data : publicListsQuery.data;
	const isLoading = isOwner ? ownerListsQuery.isLoading : publicListsQuery.isLoading;

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
			<div>
				{isOwner ? (
					<div className="mb-6 flex items-center justify-between">
						<CreateListDialog />
					</div>
				) : null}
				<M3Card variant="elevated" className="mx-auto max-w-md text-center">
					<M3CardHeader>
						<ListPlus
							className="mx-auto mb-4 h-16 w-16"
							style={{ color: "var(--md-sys-color-outline)" }}
						/>
						<M3CardTitle className="md-headline-small">No lists yet</M3CardTitle>
						<M3CardDescription>
							{isOwner
								? "Your default lists will appear after you add movies"
								: `${displayName} hasn&apos;t published any list summaries yet.`}
						</M3CardDescription>
					</M3CardHeader>
				</M3Card>
			</div>
		);
	}

	if (isOwner) {
		return (
			<div>
				<div className="mb-6 flex items-center justify-between">
					<CreateListDialog />
				</div>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{lists.map((list) => (
						<ListCard key={list.id} handle={profile.handle} list={list} />
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{lists.map((list) => (
				<PublicListSummaryCard
					key={list.id}
					handle={profile.handle}
					list={list}
					seedColor={seedColor}
				/>
			))}
		</div>
	);
}

function PublicListSummaryCard({
	handle,
	list,
	seedColor,
}: {
	handle: string;
	list: MovieListSummaryDto;
	seedColor: string;
}) {
	const isFavorites = list.slug.includes("favorites");
	const Icon = isFavorites ? Star : List;

	return (
		<Link
			{...getProfileListDetailRoute(handle, list.slug)}
			search={{ page: 1 }}
			className="block h-full"
		>
			<M3Card
				variant="elevated"
				className="h-full transition-all hover:md-elevation-2"
			>
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
		</Link>
	);
}
