import {
	listsControllerGetPublicUserListOptions,
	usersControllerGetPublicProfileOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ProfileListsPage } from "#/components/profile/ProfileListsPage";
import { useAuth } from "#/lib/auth-context";

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
	head: ({ loaderData }) => {
		const listName = loaderData?.list?.name || "List";
		return {
			meta: [{ title: `${listName} | Opnshelf` }],
		};
	},
	component: ListDetailPage,
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
