import { usersControllerGetPublicProfileOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ProfileListsPage } from "#/components/profile/ProfileListsPage";
import { useAuth } from "#/lib/auth-context";

export const Route = createFileRoute("/profile/$handle/lists/$listSlug")({
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
