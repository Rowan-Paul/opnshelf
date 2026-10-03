import {
	fetchReleaseNotes,
	type ReleaseNotesReadStateDto,
	releaseNotesControllerGetReadState,
	releaseNotesControllerMarkReadMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAuth } from "./auth-context";
import { env } from "./env";

const releaseNotesOptions = () => ({
	queryKey: ["release-notes", env.siteUrl],
	queryFn: ({ signal }: { signal: AbortSignal }) =>
		fetchReleaseNotes(env.siteUrl, signal),
	staleTime: 60_000,
	refetchInterval: 60_000,
});

export function useReleaseNotes({
	history = false,
	enabled = true,
}: {
	history?: boolean;
	enabled?: boolean;
} = {}) {
	const { user } = useAuth();
	const client = useQueryClient();
	const feed = useQuery({ ...releaseNotesOptions(), enabled });
	const readKey = ["release-notes-read", user?.did];
	const read = useQuery({
		queryFn: async ({ signal }) => {
			const { data } = await releaseNotesControllerGetReadState({
				signal,
				throwOnError: true,
			});
			return data;
		},
		queryKey: readKey,
		enabled: Boolean(user),
		staleTime: 0,
		refetchInterval: 60_000,
	});
	const newest = feed.data?.[0]?.publishedAt;
	const unread = Boolean(
		user && newest && read.data && newest > read.data.readThrough,
	);
	const mark = useMutation({
		...releaseNotesControllerMarkReadMutation(),
		mutationKey: ["release-notes", "mark-read"],
		onMutate: () => ({ readKey }),
		onSuccess: (data, _variables, context) => {
			client.setQueryData<ReleaseNotesReadStateDto>(context.readKey, (old) =>
				old && old.readThrough > data.readThrough ? old : data,
			);
		},
	});
	const attempted = useRef<string | null>(null);
	const { mutate } = mark;
	useEffect(() => {
		const key = `${user?.did}:${newest}`;
		if (
			!history ||
			!unread ||
			!newest ||
			!feed.isSuccess ||
			attempted.current === key
		)
			return;
		attempted.current = key;
		mutate({ body: { readThrough: newest } });
	}, [history, unread, newest, feed.isSuccess, user?.did, mutate]);
	return {
		...feed,
		unread,
		markError: mark.isError,
		retryMark: () => {
			if (newest) mutate({ body: { readThrough: newest } });
		},
	};
}
