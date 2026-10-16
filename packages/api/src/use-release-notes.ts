import {
	type UseQueryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { releaseNotesControllerMarkReadMutation } from "./generated/@tanstack/react-query.gen";
import { releaseNotesControllerGetReadState } from "./generated/sdk.gen";
import type { ReleaseNotesReadStateDto } from "./generated/types.gen";
import type { ReleaseNote } from "./release-notes";

export type ReleaseNotesOptions = { history?: boolean; enabled?: boolean };

/** Shared account acknowledgement behavior; clients supply their feed transport. */
export function useReleaseNotesState(
	userDid: string | undefined,
	feedOptions: UseQueryOptions<ReleaseNote[], Error, ReleaseNote[], string[]>,
	{ history = false, enabled = true }: ReleaseNotesOptions = {},
) {
	const client = useQueryClient();
	const feed = useQuery({ ...feedOptions, enabled });
	const readKey = ["release-notes-read", userDid];
	const read = useQuery({
		queryFn: async ({ signal }) => {
			const { data } = await releaseNotesControllerGetReadState({
				signal,
				throwOnError: true,
			});
			return data;
		},
		queryKey: readKey,
		enabled: Boolean(userDid),
		staleTime: 0,
		refetchInterval: 60_000,
	});
	const newest = feed.data?.[0]?.publishedAt;
	const unread = Boolean(
		userDid && newest && read.data && newest > read.data.readThrough,
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
		const key = `${userDid}:${newest}`;
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
	}, [history, unread, newest, feed.isSuccess, userDid, mutate]);
	return {
		...feed,
		unread,
		markError: mark.isError,
		retryMark: () => {
			if (newest) mutate({ body: { readThrough: newest } });
		},
	};
}
