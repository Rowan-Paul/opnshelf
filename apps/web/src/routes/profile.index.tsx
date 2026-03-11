import { authControllerMeOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { AuthLoadingState } from "@/components/AuthLoadingState";
import { UnauthenticatedState } from "@/components/UnauthenticatedState";
import { getProfileRoute } from "@/lib/profile-routes";

export const Route = createFileRoute("/profile/")({
	beforeLoad: async ({ context }) => {
		const user = await context.queryClient
			.ensureQueryData({
				...authControllerMeOptions(),
				staleTime: 5 * 60 * 1000,
				retry: false,
			})
			.catch(() => null);

		if (user) {
			throw redirect({
				...getProfileRoute(user.handle, "shelf", { page: 1 }),
			});
		}
	},
	head: () => ({
		meta: [{ title: "Profile | OpnShelf" }],
	}),
	component: ProfileIndexPage,
});

function ProfileIndexPage() {
	const { data: user, isLoading } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	if (isLoading) {
		return <AuthLoadingState className="max-w-3xl py-4" />;
	}

	if (!user) {
		return (
			<UnauthenticatedState
				title="Profile"
				description="Sign in to manage your shelf and lists"
			/>
		);
	}

	return null;
}
