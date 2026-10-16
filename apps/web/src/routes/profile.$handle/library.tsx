import { usersControllerGetPublicProfileOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ProfileLibraryPage } from "#/components/profile/ProfileLibraryPage";
import { useAuth } from "#/lib/auth-context";

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
	head: ({ loaderData }) => {
		const name =
			loaderData?.profile?.displayName || loaderData?.profile?.handle || "User";
		return {
			meta: [{ title: `${name}'s Library | Opnshelf` }],
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
		return (
			<p className="py-8 text-(--foreground-muted)">This Library is Private.</p>
		);
	return <ProfileLibraryPage userDid={profile?.did || ""} />;
}
