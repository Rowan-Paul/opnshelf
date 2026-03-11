import {
	authControllerMeOptions,
	usersControllerGetPublicProfileOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import {
	isOwnerProfile,
	normalizeProfileHandle,
} from "@/lib/profile-routes";

export function useProfileRouteState(handleInput: string) {
	const handle = normalizeProfileHandle(handleInput);

	const currentUserQuery = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});
	const profileQuery = useQuery({
		...usersControllerGetPublicProfileOptions({
			path: { handle },
		}),
		enabled: !!handle,
		retry: false,
	});

	const currentUser = currentUserQuery.data ?? null;
	const profile = profileQuery.data ?? null;

	return {
		handle,
		currentUser,
		profile,
		isOwner: isOwnerProfile(currentUser?.did, profile?.did),
		isLoading: profileQuery.isLoading,
		isAuthLoading: currentUserQuery.isLoading,
		isProfileLoading: profileQuery.isLoading,
	};
}
