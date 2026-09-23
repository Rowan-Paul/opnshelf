import {
	listsControllerGetPublicUserListsOptions,
	usersControllerGetPublicProfileOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ListCardSkeleton } from "#/components/profile/list-skeletons";
import { ProfileListsOverview } from "#/components/profile/ProfileListsOverview";
import { useAuth } from "#/lib/auth-context";

export const Route = createFileRoute("/profile/$handle/lists/")({
	loader: async ({ context, params }) => {
		try {
			const profile = await context.queryClient.ensureQueryData(
				usersControllerGetPublicProfileOptions({
					path: { handle: params.handle },
				}),
			);
			// The overview is a real page now, not a redirect, so its cards should
			// be server-rendered rather than popping in after hydration.
			if (profile) {
				await context.queryClient
					.ensureQueryData(
						listsControllerGetPublicUserListsOptions({
							path: { userDid: profile.did },
						}),
					)
					.catch(() => null);
			}
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

	return (
		<ProfileListsOverview userDid={userDid} handle={handle} isOwner={isOwner} />
	);
}
