import { usersControllerGetPublicProfileOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ProfileLibraryPage } from "#/components/profile/ProfileLibraryPage";

export const Route = createFileRoute("/profile/$handle/library")({
	component: LibraryPage,
});

function LibraryPage() {
	const { handle } = Route.useParams();

	const { data: profile } = useQuery({
		...usersControllerGetPublicProfileOptions({ path: { handle } }),
	});

	return <ProfileLibraryPage userDid={profile?.did || ""} />;
}
