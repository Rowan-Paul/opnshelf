import {
	listsControllerAddItemToListMutation,
	listsControllerGetListQueryKey,
	listsControllerGetListsForItemOptions,
	listsControllerGetListsForItemQueryKey,
	listsControllerRemoveItemFromListMutation,
	type UserDto,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { M3Button } from "@/components/ui/m3-button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AddToListModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mediaType: "movie" | "show";
	mediaId: string;
	mediaTitle: string;
	user: UserDto;
}

export function AddToListModal({
	open,
	onOpenChange,
	mediaType,
	mediaId,
	mediaTitle,
	user,
}: AddToListModalProps) {
	const queryClient = useQueryClient();

	const { data: listsForMovie, isLoading } = useQuery({
		...listsControllerGetListsForItemOptions({
			path: { mediaType, mediaId },
		}),
		enabled: open && !!user?.did,
	});

	const addMutation = useMutation({
		...listsControllerAddItemToListMutation(),
		onSuccess: (_, variables) => {
			const slug = variables.path.slug;
			queryClient.invalidateQueries({
				queryKey: listsControllerGetListsForItemQueryKey({
					path: { mediaType, mediaId },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: listsControllerGetListQueryKey({ path: { slug } }),
			});
			toast.success("Added to list");
		},
		onError: () => {
			toast.error("Failed to add to list. Please try again.");
		},
	});

	const removeMutation = useMutation({
		...listsControllerRemoveItemFromListMutation(),
		onSuccess: (_, variables) => {
			const slug = variables.path.slug;
			queryClient.invalidateQueries({
				queryKey: listsControllerGetListsForItemQueryKey({
					path: { mediaType, mediaId },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: listsControllerGetListQueryKey({ path: { slug } }),
			});
			toast.success("Removed from list");
		},
		onError: () => {
			toast.error("Failed to remove from list. Please try again.");
		},
	});

	const handleToggleList = (slug: string, isInList: boolean) => {
		if (isInList) {
			removeMutation.mutate({
				path: { slug, mediaType, mediaId },
			});
		} else {
			addMutation.mutate({
				path: { slug },
				body: { mediaType, mediaId },
			});
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="bg-[var(--md-sys-color-surface-container-high)] border-[var(--md-sys-color-outline)] text-[var(--md-sys-color-on-surface)] max-w-md rounded-[1.75rem]">
				<DialogHeader>
					<DialogTitle className="text-[var(--md-sys-color-on-surface)]">
						Manage Lists
					</DialogTitle>
					<DialogDescription className="text-[var(--md-sys-color-on-surface-variant)]">
						Add or remove &quot;{mediaTitle}&quot; from your lists
					</DialogDescription>
				</DialogHeader>
				<ScrollArea className="max-h-[300px]">
					{isLoading && (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="w-6 h-6 animate-spin text-[var(--md-sys-color-primary)]" />
						</div>
					)}
					{listsForMovie && (
						<div className="space-y-2 py-2">
							{listsForMovie.map((list) => {
								const isAddPending =
									addMutation.isPending &&
									addMutation.variables?.path?.slug === list.listSlug;
								const isRemovePending =
									removeMutation.isPending &&
									removeMutation.variables?.path?.slug === list.listSlug;
								const isPending = isAddPending || isRemovePending;
								const isInList = list.isInList;

								return (
									<M3Button
										key={list.listId}
										variant="outlined"
										className={`w-full justify-between py-6 ${
											isInList
												? "bg-[var(--md-sys-color-secondary-container)] border-[var(--md-sys-color-secondary)] text-[var(--md-sys-color-on-secondary-container)] hover:bg-[var(--md-sys-color-secondary-container)]/80"
												: "bg-transparent border-[var(--md-sys-color-outline)] text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)]"
										}`}
										onClick={() => handleToggleList(list.listSlug, isInList)}
										disabled={isPending}
									>
										<span className="flex items-center gap-2">
											<span>{list.listName}</span>
											{list.isDefault && (
												<span className="text-xs text-[var(--md-sys-color-on-secondary-container)]/70">
													Default
												</span>
											)}
										</span>
										{isPending ? (
											<span className="flex items-center gap-2">
												<span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
												Loading
											</span>
										) : isInList ? (
											<Minus className="w-4 h-4" />
										) : (
											<Plus className="w-4 h-4" />
										)}
									</M3Button>
								);
							})}
						</div>
					)}
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}
