import { authControllerMeOptions } from "@opnshelf/api";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { parsePageNumber } from "@/lib/pagination";
import { getProfilePeopleRoute } from "@/lib/profile-routes";
import { getSsrAuthHeaders } from "@/lib/ssr-auth-headers";

export const Route = createFileRoute("/people")({
	validateSearch: (search: Record<string, unknown>) => ({
		q: typeof search.q === "string" ? search.q : "",
		page: parsePageNumber(search.page),
	}),
	beforeLoad: async ({ context, search }) => {
		const authHeaders = await getSsrAuthHeaders();
		const user = await context.queryClient
			.ensureQueryData({
				...authControllerMeOptions(authHeaders),
				staleTime: 5 * 60 * 1000,
				retry: false,
			})
			.catch(() => null);

		if (!user) {
			throw redirect({ to: "/login" });
		}

		throw redirect({
			...getProfilePeopleRoute(user.handle, {
				tab: "following",
				q: search.q.trim(),
				discoverPage: search.page,
			}),
		});
	},
	component: () => null,
});
