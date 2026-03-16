import {
	socialControllerFollowMutation,
	socialControllerUnfollowMutation,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invalidateSocialQueries } from "@/lib/invalidate-social";

export function useSocialFollowActions(args: {
	targetDid: string;
	targetHandle: string;
	viewerHandle?: string | null;
}) {
	const queryClient = useQueryClient();

	const followMutation = useMutation({
		mutationKey: ["social", "follow", "create"],
		...socialControllerFollowMutation(),
		onSuccess: async () => {
			await invalidateSocialQueries(queryClient, args);
		},
		onError: () => {
			toast.error("Could not follow this person right now.");
		},
	});

	const unfollowMutation = useMutation({
		mutationKey: ["social", "follow", "delete"],
		...socialControllerUnfollowMutation(),
		onSuccess: async () => {
			await invalidateSocialQueries(queryClient, args);
		},
		onError: () => {
			toast.error("Could not unfollow this person right now.");
		},
	});

	return {
		isPending: followMutation.isPending || unfollowMutation.isPending,
		follow: () =>
			followMutation.mutate({ path: { targetDid: args.targetDid } }),
		unfollow: () =>
			unfollowMutation.mutate({ path: { targetDid: args.targetDid } }),
	};
}
