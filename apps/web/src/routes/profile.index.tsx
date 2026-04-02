import { authControllerMeOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { AuthLoadingState } from "@/components/AuthLoadingState";
import { UnauthenticatedState } from "@/components/UnauthenticatedState";
import { getSsrAuthHeaders } from "@/lib/ssr-auth-headers";

export const Route = createFileRoute("/profile/")({
	beforeLoad: async ({ context }) => {
		const authHeaders = await getSsrAuthHeaders();
		const user = await context.queryClient
			.ensureQueryData({
				...authControllerMeOptions(authHeaders),
				staleTime: 5 * 60 * 1000,
				retry: false,
			})
			.catch(() => null);

		if (user) {
			throw redirect({
				to: "/",
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
