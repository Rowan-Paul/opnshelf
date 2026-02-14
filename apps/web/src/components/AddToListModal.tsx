import {
	listsControllerAddToListMutation,
	listsControllerGetListQueryKey,
	listsControllerGetListsForMovieOptions,
	listsControllerGetListsForMovieQueryKey,
	listsControllerRemoveFromListMutation,
	type UserDto,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AddToListModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	movieId: string;
	movieTitle: string;
	user: UserDto;
}

export function AddToListModal({
	open,
	onOpenChange,
	movieId,
	movieTitle,
	user,
}: AddToListModalProps) {
	const queryClient = useQueryClient();

	const { data: listsForMovie, isLoading } = useQuery({
		...listsControllerGetListsForMovieOptions({
			path: { movieId },
		}),
		enabled: open && !!user?.did,
	});

	const addMutation = useMutation({
		...listsControllerAddToListMutation(),
		onSuccess: (_, variables) => {
			const slug = variables.path.slug;
			queryClient.invalidateQueries({
				queryKey: listsControllerGetListsForMovieQueryKey({
					path: { movieId },
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
		...listsControllerRemoveFromListMutation(),
		onSuccess: (_, variables) => {
			const slug = variables.path.slug;
			queryClient.invalidateQueries({
				queryKey: listsControllerGetListsForMovieQueryKey({
					path: { movieId },
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
				path: { slug, movieId },
			});
		} else {
			addMutation.mutate({
				path: { slug },
				body: { movieId },
			});
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="bg-gray-900 border-gray-800 text-gray-50 max-w-md">
				<DialogHeader>
					<DialogTitle>Manage Lists</DialogTitle>
					<DialogDescription className="text-gray-400">
						Add or remove &quot;{movieTitle}&quot; from your lists
					</DialogDescription>
				</DialogHeader>
				<ScrollArea className="max-h-[300px]">
					{isLoading && (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="w-6 h-6 animate-spin text-purple-500" />
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
									<Button
										key={list.listId}
										variant="outline"
										className={`w-full justify-between py-6 md:py-4 ${
											isInList
												? "bg-purple-600/20 border-purple-600 text-purple-300 hover:bg-purple-600/30"
												: "bg-gray-800 border-gray-700 hover:bg-gray-700"
										}`}
										onClick={() => handleToggleList(list.listSlug, isInList)}
										disabled={isPending}
									>
										<span className="flex items-center gap-2">
											<span>{list.listName}</span>
											{list.isDefault && (
												<span className="text-xs text-purple-400">Default</span>
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
									</Button>
								);
							})}
						</div>
					)}
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}
