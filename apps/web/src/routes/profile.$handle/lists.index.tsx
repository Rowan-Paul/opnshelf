import { usersControllerGetPublicProfileOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ProfileListsPage } from "#/components/profile/ProfileListsPage";
import { useAuth } from "#/lib/auth-context";

export const Route = createFileRoute("/profile/$handle/lists/")({
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
