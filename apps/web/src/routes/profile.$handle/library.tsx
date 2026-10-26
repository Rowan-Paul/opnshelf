import { usersControllerGetPublicProfileOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PrivateNotice } from "#/components/profile/PrivateNotice";
import { ProfileLibraryPage } from "#/components/profile/ProfileLibraryPage";
import { useAuth } from "#/lib/auth-context";
import { getPageMeta, getSharingImageUrl } from "#/lib/media-meta";

export const Route = createFileRoute("/profile/$handle/library")({
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
	head: ({ loaderData, match }) => {
		const name =
			loaderData?.profile?.displayName || loaderData?.profile?.handle || "User";
		return {
			meta: getPageMeta(
				{
					title: `${name}'s Library | Opnshelf`,
					description: `View ${name}'s library on Opnshelf.`,
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
	component: LibraryPage,
});

function LibraryPage() {
	const { handle } = Route.useParams();
	const { user } = useAuth();

	const { data: profile } = useQuery({
		...usersControllerGetPublicProfileOptions({ path: { handle } }),
	});

	if (profile?.libraryPublic === false && user?.did !== profile.did)
		return <PrivateNotice message="This Library is private." />;
	return <ProfileLibraryPage userDid={profile?.did || ""} />;
}
