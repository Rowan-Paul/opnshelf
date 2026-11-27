import {
	checkInsControllerCancelMutation,
	checkInsControllerFinishMutation,
	checkInsControllerFollowingQueryKey,
	checkInsControllerOwn,
	checkInsControllerOwnQueryKey,
	checkInsControllerProfileQueryKey,
	checkInsControllerStartMutation,
	getCheckInSuggestion,
	invalidateWatchActivityQueries,
	type StartCheckInDto,
	showsControllerGetShowWatchHistory,
	type WatchingCheckInDto,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "#/lib/auth-context";
import {
	cachedCompletionProgress,
	celebrateWatchCompletion,
} from "#/lib/watch-completion";

export function useWatchingCheckIn(poll = false, enabled = true) {
	const { user } = useAuth();

	const client = useQueryClient();
	const queryKey = [...checkInsControllerOwnQueryKey(), user?.did] as const;
	const completedKey = ["completed-check-in", user?.did] as const;

	const clearSuggestion = () => client.setQueryData(completedKey, null);
	const updateWatches = (item: WatchingCheckInDto) => {
		const { seasonNumber, episodeNumber, mediaId, startedAt, userDid } = item;
		const before = cachedCompletionProgress(client, mediaId, userDid);
		void invalidateWatchActivityQueries(client);
		if (seasonNumber == null || episodeNumber == null || !before) return;
		void showsControllerGetShowWatchHistory({
			path: { userDid, showId: mediaId },
		})
			.then(({ data }) => {
				if (
					data?.some(
						(entry) =>
							entry.seasonNumber === seasonNumber &&
							entry.episodeNumber === episodeNumber &&
							entry.watchedDate === startedAt,
					)
				) {
					return celebrateWatchCompletion(before, seasonNumber);
				}
			})
			.catch(() => {});
	};
	const refresh = () => {
		void client.invalidateQueries({ queryKey });
		void client.invalidateQueries({
			queryKey: checkInsControllerFollowingQueryKey(),
		});
		void client.invalidateQueries({
			queryKey: checkInsControllerProfileQueryKey({
				path: { did: user?.did ?? "" },
			}),
		});
	};
	const query = useQuery({
		queryKey,
		enabled: !!user && enabled,
		refetchInterval: poll ? 10_000 : false,
		retry: false,
		staleTime: 5_000,
		queryFn: async ({ signal }) => {
			const previous = client.getQueryData<{ items: WatchingCheckInDto[] }>(
				queryKey,
			)?.items[0];
			const { data: result } = await checkInsControllerOwn({
				signal,
				throwOnError: true,
			});
			if (
				previous &&
				!result.items.some((item) => item.rkey === previous.rkey)
			) {
				updateWatches(previous);
			}
			return result;
		},
	});
	const start = useMutation({
		...checkInsControllerStartMutation(),
		mutationKey: ["check-in", "start"],
		onSuccess: (item) => {
			clearSuggestion();
			client.setQueryData(queryKey, { items: [item] });
			refresh();
		},
		onError: () => {
			refresh();
			toast.error(
				"Couldn’t start watching. Check your current check-in and try again.",
			);
		},
	});
	const finish = useMutation({
		...checkInsControllerFinishMutation(),
		mutationKey: ["check-in", "finish"],
		onMutate: ({ path }) =>
			client
				.getQueryData<{ items: WatchingCheckInDto[] }>(queryKey)
				?.items.find((item) => item.rkey === path.rkey),
		onSuccess: (result, _, previous) => {
			if (previous && !result.items.length) {
				client.setQueryData(completedKey, previous);
			}
			client.setQueryData(queryKey, result);
			if (
				previous &&
				!result.items.some((item) => item.rkey === previous.rkey)
			) {
				updateWatches(previous);
			}
		},
		onError: () => toast.error("Couldn’t log this Watch yet. Try again."),
		onSettled: refresh,
	});
	const cancel = useMutation({
		...checkInsControllerCancelMutation(),
		mutationKey: ["check-in", "cancel"],
		onSuccess: (result) => client.setQueryData(queryKey, result),
		onError: () => toast.error("Couldn’t cancel the check-in. Try again."),
		onSettled: refresh,
	});

	const active = user ? query.data?.items[0] : undefined;

	return {
		active,
		pending: start.isPending || finish.isPending || cancel.isPending,
		start: (body: StartCheckInDto) => start.mutate({ body }),
		finish: () => active && finish.mutate({ path: { rkey: active.rkey } }),
		cancel: () => active && cancel.mutate({ path: { rkey: active.rkey } }),
	};
}

export function useCheckInSuggestion(hasActiveCheckIn: boolean) {
	const { user } = useAuth();
	const client = useQueryClient();
	const completedKey = ["completed-check-in", user?.did] as const;
	const { data: completed } = useQuery<WatchingCheckInDto | null>({
		queryKey: completedKey,
		queryFn: () => null,
		enabled: false,
	});
	const { data: suggestion, isPending } = useQuery({
		queryKey: ["check-in-suggestion", user?.did, completed?.rkey],
		queryFn: () => (completed ? getCheckInSuggestion(client, completed) : null),
		enabled: !!user && !!completed && !hasActiveCheckIn,
		retry: false,
		staleTime: Infinity,
	});
	return {
		completed,
		lookingUp: !!user && !!completed && !hasActiveCheckIn && isPending,
		suggestion: user && completed && !hasActiveCheckIn ? suggestion : undefined,
		clearSuggestion: () => client.setQueryData(completedKey, null),
	};
}
