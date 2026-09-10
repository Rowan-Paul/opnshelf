import {
	socialControllerFollowMutation,
	socialControllerUnfollowMutation,
} from "@opnshelf/api";
import {
	type QueryClient,
	type QueryKey,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { posthog } from "#/integrations/posthog/provider";

const SOCIAL_QUERY_IDS = new Set([
	"socialControllerGetFeed",
	"socialControllerGetFollowing",
	"socialControllerGetFollowers",
	"socialControllerGetSuggestions",
	"socialControllerSearchPeople",
	"socialControllerGetRelationship",
	"socialControllerListCircles",
	"socialControllerGetCircleMembers",
	"socialControllerGetWatchers",
	"usersControllerGetPublicFollowing",
	"usersControllerGetPublicFollowers",
	"usersControllerGetPublicProfile",
]);

export function isSocialQuery(queryKey: QueryKey) {
	const id = (queryKey[0] as { _id?: string } | undefined)?._id;
	return !!id && SOCIAL_QUERY_IDS.has(id);
}

export function invalidateSocialQueries(queryClient: QueryClient) {
	return queryClient.invalidateQueries({
		predicate: (query) => isSocialQuery(query.queryKey),
	});
}

export function useSocialFollowActions(source: string) {
	const queryClient = useQueryClient();
	const invalidateSocial = () => invalidateSocialQueries(queryClient);

	const followMutation = useMutation({
		mutationKey: ["social", "follow"],
		...socialControllerFollowMutation(),
		onSuccess: () => {
			posthog.capture("user_followed", { source });
			toast.success("Followed");
		},
		onError: (error) =>
			toast.error(error instanceof Error ? error.message : "Failed to follow"),
		onSettled: invalidateSocial,
	});
	const unfollowMutation = useMutation({
		mutationKey: ["social", "unfollow"],
		...socialControllerUnfollowMutation(),
		onSuccess: () => {
			posthog.capture("user_unfollowed", { source });
			toast.success("Unfollowed");
		},
		onError: (error) =>
			toast.error(
				error instanceof Error ? error.message : "Failed to unfollow",
			),
		onSettled: invalidateSocial,
	});

	return {
		follow: (targetDid: string) =>
			followMutation.mutate({ path: { targetDid } }),
		unfollow: (targetDid: string) =>
			unfollowMutation.mutate({ path: { targetDid } }),
		pendingFollowDid: followMutation.isPending
			? followMutation.variables?.path?.targetDid
			: undefined,
		pendingUnfollowDid: unfollowMutation.isPending
			? unfollowMutation.variables?.path?.targetDid
			: undefined,
	};
}
