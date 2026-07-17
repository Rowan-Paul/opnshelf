import { usersControllerGetPublicProfileOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ProfileListsPage } from "#/components/profile/ProfileListsPage";
import { useAuth } from "#/lib/auth-context";

export const Route = createFileRoute("/profile/$handle/lists/")({
	loader: async ({ context, params }) => {
		try {
			const profile = await context.queryClient.ensureQueryData(
				usersControllerGetPublicProfileOptions({
					path: { handle: params.handle },
				}),
			);
			return { profile };
		} catch {
			return { profile: null };
		}
	},
	head: ({ loaderData }) => {
		const name =
			loaderData?.profile?.displayName || loaderData?.profile?.handle || "User";
		return {
			meta: [{ title: `${name}'s Lists | Opnshelf` }],
		};
	},
	component: ListsIndexPage,
});

function ListsIndexPage() {
	const { handle } = Route.useParams();
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
			selectedListSlug={null}
			isOwner={isOwner}
		/>
	);
}
