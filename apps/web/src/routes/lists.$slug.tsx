import {
	authControllerMeOptions,
	listsControllerDeleteListMutation,
	listsControllerGetListOptions,
	listsControllerGetListQueryKey,
	listsControllerGetUserListsQueryKey,
	listsControllerRemoveItemFromListMutation,
	type MediaInListDto,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, List, Loader2, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MovieGridSkeleton } from "@/components/MovieGrid";
import { useTheme } from "@/components/theme-provider";
import { UnauthenticatedState } from "@/components/UnauthenticatedState";
import { M3Button } from "@/components/ui/m3-button";
import {
	M3Card,
	M3CardContent,
	M3CardDescription,
	M3CardHeader,
	M3CardTitle,
} from "@/components/ui/m3-card";
import { getTmdbPosterUrl } from "@/lib/utils";

export const Route = createFileRoute("/lists/$slug")({
	head: ({ params }) => ({
		meta: [{ title: `${params.slug} | OpnShelf` }],
	}),
	component: ListDetailPage,
});

function ListDetailPage() {
	const { slug } = Route.useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const { seedColor } = useTheme();

	const { data: user, isLoading: isAuthLoading } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	const { data: list, isLoading: isListLoading } = useQuery({
		...listsControllerGetListOptions({
			path: { slug },
		}),
		enabled: !!user?.did,
	});

	const removeMutation = useMutation({
		mutationKey: ["lists", slug, "removeItem"],
		...listsControllerRemoveItemFromListMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: listsControllerGetListQueryKey({ path: { slug } }),
			});
			toast.success("Removed from list");
		},
		onError: () => {
			toast.error("Failed to remove. Please try again.");
		},
	});

	const deleteMutation = useMutation({
		mutationKey: ["lists", slug, "delete"],
		...listsControllerDeleteListMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: listsControllerGetUserListsQueryKey(),
			});
			toast.success("List deleted");
			navigate({ to: "/profile/lists" });
		},
		onError: () => {
			toast.error("Failed to delete. Please try again.");
		},
	});

	if (isAuthLoading) {
		return (
			<div
				className="min-h-screen"
				style={{
					backgroundColor: "var(--md-sys-color-background)",
					color: "var(--md-sys-color-on-background)",
				}}
			>
				<div className="container mx-auto px-4 py-4 max-w-7xl">
					<MovieGridSkeleton />
				</div>
			</div>
		);
	}

	if (!user) {
		return (
			<UnauthenticatedState
				title="List"
				description="Sign in to view your lists"
			/>
		);
	}

	if (isListLoading) {
		return (
			<div
				className="min-h-screen"
				style={{
					backgroundColor: "var(--md-sys-color-background)",
					color: "var(--md-sys-color-on-background)",
				}}
			>
				<div className="container mx-auto px-4 py-4 max-w-7xl">
					<MovieGridSkeleton />
				</div>
			</div>
		);
	}

	if (!list) {
		return (
			<div
				className="min-h-screen"
				style={{
					backgroundColor: "var(--md-sys-color-background)",
					color: "var(--md-sys-color-on-background)",
				}}
			>
				<div className="container mx-auto px-4 py-4 max-w-7xl">
					<M3Card variant="elevated" className="text-center max-w-md mx-auto">
						<M3CardHeader>
							<List
								className="w-16 h-16 mx-auto mb-4"
								style={{ color: "var(--md-sys-color-outline)" }}
							/>
							<M3CardTitle className="md-headline-small">
								List not found
							</M3CardTitle>
							<M3CardDescription>
								This list doesn&apos;t exist or you don&apos;t have access to it
							</M3CardDescription>
						</M3CardHeader>
						<M3CardContent>
							<M3Button variant="filled" asChild>
								<Link to="/profile/lists">Back to lists</Link>
							</M3Button>
						</M3CardContent>
					</M3Card>
				</div>
			</div>
		);
	}

	const items = list.items || [];

	return (
		<div
			className="min-h-screen"
			style={{
				backgroundColor: "var(--md-sys-color-background)",
				color: "var(--md-sys-color-on-background)",
			}}
		>
			<div className="container mx-auto px-4 py-4 max-w-7xl">
				<div className="mb-6">
					<M3Button variant="text" size="sm" asChild className="mb-4">
						<Link to="/profile/lists">
							<ArrowLeft className="w-4 h-4 mr-2" />
							Back to lists
						</Link>
					</M3Button>
					<div className="flex items-start justify-between">
						<div>
							<div className="flex items-center gap-3 mb-2">
								<List className="w-6 h-6" style={{ color: seedColor }} />
								<h1 className="md-headline-medium">{list.name}</h1>
								{list.isDefault && (
									<span
										className="px-2 py-0.5 text-xs rounded-full"
										style={{
											backgroundColor: seedColor,
											color: "var(--md-sys-color-on-primary)",
										}}
									>
										Default
									</span>
								)}
							</div>
							{list.description && (
								<p style={{ color: "var(--md-sys-color-on-surface-variant)" }}>
									{list.description}
								</p>
							)}
						</div>
						{!list.isDefault && (
							<M3Button
								variant="outlined"
								size="sm"
								onClick={() => setShowDeleteConfirm(true)}
								disabled={deleteMutation.isPending}
								className="text-[var(--md-sys-color-error)] border-[var(--md-sys-color-error)]"
							>
								<Trash2 className="w-4 h-4 mr-2" />
								{deleteMutation.isPending ? "Deleting..." : "Delete"}
							</M3Button>
						)}
					</div>
				</div>

				{items.length > 0 && (
					<>
						<p
							className="mb-6 md-body-large"
							style={{ color: "var(--md-sys-color-on-surface-variant)" }}
						>
							{items.length} item{items.length !== 1 ? "s" : ""}
						</p>
						<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
							{items.map((item) => (
								<ListMediaCard
									key={item.id}
									item={item}
									onRemove={({ mediaType, mediaId }) => {
										removeMutation.mutate({
											path: { slug, mediaType, mediaId },
										});
									}}
									isRemoving={
										removeMutation.isPending &&
										removeMutation.variables?.path?.mediaType ===
											item.mediaType &&
										removeMutation.variables?.path?.mediaId === item.mediaId
									}
								/>
							))}
						</div>
					</>
				)}

				{items.length === 0 && (
					<M3Card variant="elevated" className="text-center max-w-md mx-auto">
						<M3CardHeader>
							<List
								className="w-16 h-16 mx-auto mb-4"
								style={{ color: "var(--md-sys-color-outline)" }}
							/>
							<M3CardTitle className="md-headline-small">
								No items yet
							</M3CardTitle>
							<M3CardDescription>
								Add movies or shows to this list from the search page
							</M3CardDescription>
						</M3CardHeader>
						<M3CardContent>
							<M3Button variant="filled" asChild>
								<Link to="/search" search={{ q: "", type: "all" }}>
									Search for media
								</Link>
							</M3Button>
						</M3CardContent>
					</M3Card>
				)}
			</div>
			<ConfirmDialog
				open={showDeleteConfirm}
				onOpenChange={setShowDeleteConfirm}
				onConfirm={() => deleteMutation.mutate({ path: { slug } })}
				title="Delete List"
				description={`Are you sure you want to delete "${list.name}"? This action cannot be undone.`}
				confirmText="Delete"
				isLoading={deleteMutation.isPending}
			/>
		</div>
	);
}

interface ListMediaCardProps {
	item: MediaInListDto;
	onRemove: (item: { mediaType: "movie" | "show"; mediaId: string }) => void;
	isRemoving: boolean;
}

function ListMediaCard({ item, onRemove, isRemoving }: ListMediaCardProps) {
	const media = item.media as {
		title?: string;
		posterPath?: string | null;
		releaseYear?: number | null;
	};
	const mediaType: "movie" | "show" =
		item.mediaType === "show" ? "show" : "movie";
	const posterUrl = getTmdbPosterUrl(media.posterPath ?? null);
	const mediaTitle = media.title ?? "Untitled";
	const releaseYear = media.releaseYear;
	const mediaSlug = mediaTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
	const isMovie = mediaType === "movie";
	const { seedColor } = useTheme();

	return (
		<div className="group">
			<Link
				to={isMovie ? "/movies/$movieId/$title" : "/shows/$showId/$title"}
				params={
					isMovie
						? { movieId: item.mediaId, title: mediaSlug }
						: { showId: item.mediaId, title: mediaSlug }
				}
				className="block relative aspect-2/3 rounded-lg overflow-hidden mb-2"
				style={{
					backgroundColor: "var(--md-sys-color-surface-container-highest)",
				}}
			>
				{posterUrl ? (
					<img
						src={posterUrl}
						alt={mediaTitle}
						className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
					/>
				) : (
					<div
						className="w-full h-full flex items-center justify-center"
						style={{ color: "var(--md-sys-color-outline)" }}
					>
						No poster
					</div>
				)}
				<M3Button
					type="button"
					size="icon-sm"
					variant="filled"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						onRemove({ mediaType, mediaId: item.mediaId });
					}}
					disabled={isRemoving}
					className="absolute top-2 right-2 z-10 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity"
					style={{
						backgroundColor: "var(--md-sys-color-error-container)",
						color: "var(--md-sys-color-error)",
					}}
				>
					{isRemoving ? (
						<Loader2 className="w-4 h-4 animate-spin" />
					) : (
						<X className="w-4 h-4" />
					)}
				</M3Button>
			</Link>
			<Link
				to={isMovie ? "/movies/$movieId/$title" : "/shows/$showId/$title"}
				params={
					isMovie
						? { movieId: item.mediaId, title: mediaSlug }
						: { showId: item.mediaId, title: mediaSlug }
				}
				className="block"
			>
				<h3
					className="font-semibold text-sm line-clamp-2 mb-1 transition-colors"
					style={{ color: "var(--md-sys-color-on-surface)" }}
					onMouseEnter={(e) => {
						e.currentTarget.style.color = seedColor;
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.color = "var(--md-sys-color-on-surface)";
					}}
				>
					{mediaTitle}
				</h3>
				{releaseYear && (
					<p
						className="text-sm"
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						{releaseYear}
					</p>
				)}
			</Link>
		</div>
	);
}
