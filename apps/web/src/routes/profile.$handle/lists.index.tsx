import {
	listsControllerGetPublicUserListsOptions,
	listsControllerGetPublicUserListsQueryKey,
	usersControllerGetPublicProfileOptions,
} from "@opnshelf/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { ListCardSkeleton } from "#/components/profile/list-skeletons";
import { ProfileListsOverview } from "#/components/profile/ProfileListsOverview";
import { ssrAuthOptions } from "#/lib/api";
import { useAuth } from "#/lib/auth-context";
import { getPageMeta, getSharingImageUrl } from "#/lib/media-meta";
import {
	SIGNED_IN_HINT_QUERY_KEY,
	ssrCannotIdentifyViewer,
} from "#/lib/session-hint";

export const Route = createFileRoute("/profile/$handle/lists/")({
	loader: async ({ context, params }) => {
		try {
			const profile = await context.queryClient.ensureQueryData(
				usersControllerGetPublicProfileOptions({
					path: { handle: params.handle },
				}),
			);
			// The overview is a real page now, not a redirect, so its cards should
			// be server-rendered rather than popping in after hydration. The
			// answer depends on the viewer: the owner also gets their Private
			// Lists. So the fetch carries the session when SSR has one, and is
			// left to the browser when SSR cannot tell who is asking; a signed-out
			// answer hydrated as fresh showed the owner "No lists yet." (#753).
			if (profile && !ssrCannotIdentifyViewer()) {
				await context.queryClient
					.ensureQueryData(
						listsControllerGetPublicUserListsOptions({
							path: { userDid: profile.did },
							...ssrAuthOptions(),
						}),
					)
					.catch(() => null);
			}
			return { profile };
		} catch {
			return { profile: null };
		}
	},
	head: ({ loaderData, match }) => {
		const name =
			loaderData?.profile?.displayName || loaderData?.profile?.handle || "User";
		return {
			meta: getPageMeta(
				{
					title: `${name}'s Lists | Opnshelf`,
					description: `View ${name}'s lists on Opnshelf.`,
					imageUrl: loaderData?.profile
						? getSharingImageUrl({
								handle: loaderData.profile.handle,
								view: "profile",
							})
						: undefined,
				},
				match.pathname,
			),
		};
	},
	component: ListsIndexPage,
	// The loader awaits the lists, so navigation would otherwise hold the
	// previous page with no sign anything is happening.
	pendingComponent: () => (
		<div className="space-y-6">
			<div className="h-9 w-32 animate-pulse rounded bg-(--background-subtle)" />
			<ListCardSkeleton />
		</div>
	),
});

function ListsIndexPage() {
	const { handle } = Route.useParams();
	const { user } = useAuth();

	const { data: profile } = useQuery({
		...usersControllerGetPublicProfileOptions({ path: { handle } }),
	});

	const userDid = profile?.did || "";
	const isOwner = user?.did === userDid;

	// The signed-in hint can be missing while the session is still valid: it
	// is a script-set cookie, which Safari drops after a week. SSR then
	// rendered for a signed-out visitor, and the Lists it hydrated leave out
	// the owner's Private ones, so ask again once the owner is known.
	const queryClient = useQueryClient();
	useEffect(() => {
		if (!isOwner) return;
		if (queryClient.getQueryData(SIGNED_IN_HINT_QUERY_KEY) !== false) return;
		queryClient.invalidateQueries({
			queryKey: listsControllerGetPublicUserListsQueryKey({
				path: { userDid },
			}),
		});
	}, [isOwner, queryClient, userDid]);

	return (
		<ProfileListsOverview userDid={userDid} handle={handle} isOwner={isOwner} />
	);
}
