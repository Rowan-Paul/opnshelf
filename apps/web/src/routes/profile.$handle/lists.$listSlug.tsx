import {
	listsControllerGetPublicUserListOptions,
	usersControllerGetPublicProfileOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ListDetailSkeleton } from "#/components/profile/list-skeletons";
import { ProfileListsPage } from "#/components/profile/ProfileListsPage";
import { useAuth } from "#/lib/auth-context";
import { getListImageUrl, getPageMeta } from "#/lib/media-meta";

export const Route = createFileRoute("/profile/$handle/lists/$listSlug")({
	loader: async ({ context, params }) => {
		let profile = null;
		try {
			profile = await context.queryClient.ensureQueryData(
				usersControllerGetPublicProfileOptions({
					path: { handle: params.handle },
				}),
			);
		} catch {
			return { profile: null, list: null };
		}

		if (!profile) return { profile: null, list: null };

		try {
			const list = await context.queryClient.ensureQueryData(
				listsControllerGetPublicUserListOptions({
					path: { userDid: profile.did, slug: params.listSlug },
					query: { sort: "position" },
				}),
			);
			return { profile, list };
		} catch {
			return { profile, list: null };
		}
	},
	head: ({ loaderData, match }) => {
		const listName = loaderData?.list?.name || "List";
		return {
			meta: getPageMeta(
				{
					title: `${listName} | ${loaderData?.profile?.displayName || loaderData?.profile?.handle || "Opnshelf"}`,
					description:
						loaderData?.list?.description?.trim() ||
						`Browse ${listName} on Opnshelf.`,
					imageUrl:
						loaderData?.list && loaderData.profile
							? getListImageUrl(loaderData.profile.handle, loaderData.list.slug)
							: undefined,
				},
				match.pathname,
			),
		};
	},
	component: ListDetailPage,
	// Same reason as the lists index: the loader awaits the list itself.
	pendingComponent: ListDetailSkeleton,
});

function ListDetailPage() {
	const { handle, listSlug } = Route.useParams();
	const { user } = useAuth();

	const { data: profile } = useQuery({
		...usersControllerGetPublicProfileOptions({ path: { handle } }),
	});

	const userDid = profile?.did || "";
	const isOwner = user?.did === userDid;

	return (
		<ProfileListsPage
			userDid={userDid}
			handle={handle}
			selectedListSlug={listSlug}
			isOwner={isOwner}
		/>
	);
}
