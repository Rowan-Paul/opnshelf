import {
	listsControllerAddItemToListMutation,
	listsControllerGetPublicUserListQueryKey,
	listsControllerGetPublicUserListsQueryKey,
	listsControllerRemoveItemFromListMutation,
	type MediaInListDto,
	searchControllerSearchAllOptions,
	type UnifiedSearchResultDto,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Film, Loader2, Plus, Search, Tv, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { useDebounce } from "#/hooks/useDebounce";

interface AddListItemsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Owner did — used to invalidate the public list queries the profile reads. */
	userDid: string;
	slug: string;
	/** Current items in the list, used to show the add/added state per row. */
	existingItems: MediaInListDto[];
}

function itemKey(mediaType: string, mediaId: string): string {
	return `${mediaType}:${mediaId}`;
}

function getYear(result: UnifiedSearchResultDto): string | undefined {
	const date = result.release_date || result.first_air_date;
	return date ? date.slice(0, 4) : undefined;
}

export default function AddListItemsDialog({
	open,
	onOpenChange,
	userDid,
	slug,
	existingItems,
}: AddListItemsDialogProps) {
	const queryClient = useQueryClient();
	const [query, setQuery] = useState("");
	const debouncedQuery = useDebounce(query, 400);

	const { data: searchData, isFetching } = useQuery({
		...searchControllerSearchAllOptions({
			query: { query: debouncedQuery, page: 1 },
		}),
		enabled: open && debouncedQuery.trim().length > 0,
	});

	// Movies + shows only in v1.
	const results = useMemo(() => {
		const seen = new Set<string>();
		return (searchData?.results ?? []).filter((r: UnifiedSearchResultDto) => {
			if (r.media_type !== "movie" && r.media_type !== "tv") return false;
			const k = `${r.media_type}-${r.id}`;
			if (seen.has(k)) return false;
			seen.add(k);
			return true;
		});
	}, [searchData]);

	// Whole-title membership (ignore season/episode rows — v1 adds movies/shows).
	const existingKeys = useMemo(() => {
		const set = new Set<string>();
		for (const item of existingItems) {
			if (item.seasonNumber == null && item.episodeNumber == null) {
				set.add(itemKey(item.mediaType, item.mediaId));
			}
		}
		return set;
	}, [existingItems]);

	// Optimistic membership overlay for changes made inside this dialog, so a row
	// flips to "added" immediately without waiting for the list query to refetch.
	const [pendingAdds, setPendingAdds] = useState<Set<string>>(new Set());
	const [pendingRemoves, setPendingRemoves] = useState<Set<string>>(new Set());

	const invalidate = () => {
		queryClient.invalidateQueries({
			queryKey: listsControllerGetPublicUserListQueryKey({
				path: { userDid, slug },
			}),
		});
		queryClient.invalidateQueries({
			queryKey: listsControllerGetPublicUserListsQueryKey({
				path: { userDid },
			}),
		});
	};

	const addMutation = useMutation({
		mutationKey: ["lists", slug, "addItem"],
		...listsControllerAddItemToListMutation(),
		onSuccess: () => {
			toast.success("Added to list");
			invalidate();
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to add to list",
			);
		},
	});

	const removeMutation = useMutation({
		mutationKey: ["lists", slug, "removeItem"],
		...listsControllerRemoveItemFromListMutation(),
		onSuccess: () => {
			toast.success("Removed from list");
			invalidate();
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to remove from list",
			);
		},
	});

	const isAdded = (key: string) =>
		pendingAdds.has(key) || (existingKeys.has(key) && !pendingRemoves.has(key));

	const handleToggle = (result: UnifiedSearchResultDto) => {
		const mediaType = result.media_type === "movie" ? "movie" : "show";
		const mediaId = String(result.id);
		const key = itemKey(mediaType, mediaId);

		if (isAdded(key)) {
			setPendingRemoves((prev) => new Set(prev).add(key));
			setPendingAdds((prev) => {
				const next = new Set(prev);
				next.delete(key);
				return next;
			});
			removeMutation.mutate({ path: { slug, mediaType, mediaId } });
		} else {
			setPendingAdds((prev) => new Set(prev).add(key));
			setPendingRemoves((prev) => {
				const next = new Set(prev);
				next.delete(key);
				return next;
			});
			addMutation.mutate({ path: { slug }, body: { mediaType, mediaId } });
		}
	};

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setQuery("");
			setPendingAdds(new Set());
			setPendingRemoves(new Set());
		}
		onOpenChange(next);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Add items</DialogTitle>
					<DialogDescription>
						Search for movies and shows to add to this list.
					</DialogDescription>
				</DialogHeader>

				<div className="relative">
					<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--foreground-muted)" />
					<input
						type="text"
						placeholder="Search movies and shows..."
						className="input h-10 pl-9! text-sm"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						autoFocus
					/>
					{isFetching && (
						<Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-(--foreground-muted)" />
					)}
				</div>

				<div className="h-[24rem] space-y-1 overflow-y-auto">
					{debouncedQuery.trim().length === 0 ? (
						<div className="flex h-full items-center justify-center">
							<p className="text-center text-(--foreground-muted) text-sm">
								Start typing to search.
							</p>
						</div>
					) : !isFetching && results.length === 0 ? (
						<div className="flex h-full items-center justify-center">
							<p className="text-center text-(--foreground-muted) text-sm">
								No results for &quot;{debouncedQuery}&quot;
							</p>
						</div>
					) : (
						results.map((result) => {
							const mediaType =
								result.media_type === "movie" ? "movie" : "show";
							const mediaId = String(result.id);
							const key = itemKey(mediaType, mediaId);
							const added = isAdded(key);
							const title = result.title || result.name || "Unknown";
							const year = getYear(result);
							const poster = result.poster_path
								? `https://image.tmdb.org/t/p/w185${result.poster_path}`
								: "";
							return (
								<div
									key={key}
									className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-(--background-subtle)"
								>
									<div className="h-14 w-10 shrink-0 overflow-hidden rounded bg-(--background-subtle)">
										{poster ? (
											<img
												src={poster}
												alt={title}
												className="h-full w-full object-cover"
												loading="lazy"
											/>
										) : (
											<div className="flex h-full w-full items-center justify-center text-(--foreground-subtle)">
												{mediaType === "movie" ? (
													<Film className="size-4" />
												) : (
													<Tv className="size-4" />
												)}
											</div>
										)}
									</div>
									<div className="min-w-0 flex-1">
										<p className="truncate font-medium text-sm">{title}</p>
										<p className="text-(--foreground-muted) text-xs">
											{mediaType === "movie" ? "Movie" : "Show"}
											{year ? ` · ${year}` : ""}
										</p>
									</div>
									<button
										type="button"
										onClick={() => handleToggle(result)}
										className={`btn btn-sm h-8 shrink-0 gap-1 px-3 text-xs ${
											added ? "btn-secondary" : "btn-primary"
										}`}
									>
										{added ? (
											<>
												<Check className="size-3.5" />
												Added
											</>
										) : (
											<>
												<Plus className="size-3.5" />
												Add
											</>
										)}
									</button>
								</div>
							);
						})
					)}
				</div>

				<div className="mt-2 flex justify-end border-(--border) border-t pt-2">
					<button
						type="button"
						onClick={() => handleOpenChange(false)}
						className="btn btn-secondary btn-sm gap-1.5"
					>
						<X className="size-3.5" />
						Done
					</button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
