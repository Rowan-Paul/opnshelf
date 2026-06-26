import {
	socialControllerAddCircleMemberMutation,
	socialControllerCreateCircleMutation,
	socialControllerDeleteCircleMutation,
	socialControllerListCirclesOptions,
	socialControllerListCirclesQueryKey,
	socialControllerRemoveCircleMemberMutation,
	socialControllerRenameCircleMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";

function errorMessage(error: unknown, fallback: string) {
	return error instanceof Error ? error.message : fallback;
}

// Membership and feed-filter changes touch the circles list, the following list
// (which carries each user's circleIds), and the feed (its circle filter).
const CIRCLE_QUERY_IDS = [
	"socialControllerListCircles",
	"socialControllerGetFollowing",
	"socialControllerGetFeed",
];

function useInvalidateCircles() {
	const queryClient = useQueryClient();
	return () =>
		queryClient.invalidateQueries({
			predicate: (q) => {
				const key = q.queryKey[0] as { _id?: string } | undefined;
				return !!key?._id && CIRCLE_QUERY_IDS.includes(key._id);
			},
		});
}

/** All of the current user's circles. */
export function useCircles() {
	const { isAuthenticated } = useAuth();
	return useQuery({
		...socialControllerListCirclesOptions(),
		enabled: isAuthenticated,
	});
}

export function useCreateCircle() {
	const queryClient = useQueryClient();
	const toast = useToast();
	return useMutation({
		mutationKey: ["circles", "create"],
		...socialControllerCreateCircleMutation(),
		onSuccess: () => {
			toast.success("Circle created");
			queryClient.invalidateQueries({
				queryKey: socialControllerListCirclesQueryKey(),
			});
		},
		onError: (error) =>
			toast.error(errorMessage(error, "Failed to create circle")),
	});
}

export function useRenameCircle() {
	const queryClient = useQueryClient();
	const toast = useToast();
	return useMutation({
		mutationKey: ["circles", "rename"],
		...socialControllerRenameCircleMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: socialControllerListCirclesQueryKey(),
			});
		},
		onError: (error) =>
			toast.error(errorMessage(error, "Failed to rename circle")),
	});
}

export function useDeleteCircle() {
	const invalidate = useInvalidateCircles();
	const toast = useToast();
	return useMutation({
		mutationKey: ["circles", "delete"],
		...socialControllerDeleteCircleMutation(),
		onSuccess: () => {
			toast.success("Circle deleted");
			invalidate();
		},
		onError: (error) =>
			toast.error(errorMessage(error, "Failed to delete circle")),
	});
}

export function useAddCircleMember() {
	const invalidate = useInvalidateCircles();
	const toast = useToast();
	return useMutation({
		mutationKey: ["circles", "addMember"],
		...socialControllerAddCircleMemberMutation(),
		onSettled: invalidate,
		onError: (error) =>
			toast.error(errorMessage(error, "Failed to add to circle")),
	});
}

export function useRemoveCircleMember() {
	const invalidate = useInvalidateCircles();
	const toast = useToast();
	return useMutation({
		mutationKey: ["circles", "removeMember"],
		...socialControllerRemoveCircleMemberMutation(),
		onSettled: invalidate,
		onError: (error) =>
			toast.error(errorMessage(error, "Failed to remove from circle")),
	});
}
