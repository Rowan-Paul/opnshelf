import {
	authControllerMeOptions,
	showsControllerGetUserUpNextOptions,
	usersControllerGetPublicProfileOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { AuthLoadingState } from "@/components/AuthLoadingState";
import { PaginationControls } from "@/components/PaginationControls";
import { UpNextShowCollection } from "@/components/up-next/UpNextShowCollection";
import { useProfileRouteState } from "@/hooks/useProfileRouteState";
import { getVisiblePages, parsePageNumber } from "@/lib/pagination";
import { getProfileRoute, isOwnerProfile } from "@/lib/profile-routes";
import { getSsrAuthHeaders } from "@/lib/ssr-auth-headers";

const PAGE_SIZE = 8;

export const Route = createFileRoute("/profile/$handle/up-next")({
	beforeLoad: async ({ context, params }) => {
		const handle = params.handle.trim().replace(/^@/, "").toLowerCase();
		const authHeaders = await getSsrAuthHeaders();
		const [currentUser, profile] = await Promise.all([
			context.queryClient
				.ensureQueryData({
					...authControllerMeOptions(authHeaders),
					staleTime: 5 * 60 * 1000,
					retry: false,
				})
				.catch(() => null),
			context.queryClient
				.ensureQueryData({
					...usersControllerGetPublicProfileOptions({
						path: { handle },
					}),
					retry: false,
				})
				.catch(() => null),
		]);

		if (!profile || !isOwnerProfile(currentUser?.did, profile.did)) {
			throw redirect({
				...getProfileRoute(handle, "shelf", { page: 1 }),
			});
		}
	},
	validateSearch: (search: Record<string, unknown>) => ({
		page: parsePageNumber(search.page),
	}),
	head: ({ params }) => ({
		meta: [{ title: `@${params.handle.replace(/^@/, "")} Up Next | OpnShelf` }],
	}),
	component: ProfileUpNextPage,
});

function ProfileUpNextPage() {
	const { handle } = Route.useParams();
	const { page } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const { profile, isAuthLoading, isOwner, isProfileLoading } =
		useProfileRouteState(handle);
	const userDid = profile?.did ?? "";

	const upNextQuery = useQuery({
		...showsControllerGetUserUpNextOptions({
			path: { userDid },
			query: { page, pageSize: PAGE_SIZE },
		}),
		enabled: !!userDid && isOwner,
	});
	const items = upNextQuery.data?.items ?? [];
	const currentPage = upNextQuery.data?.page ?? page;
	const totalPages = upNextQuery.data?.totalPages ?? 0;
	const pageNumbers = useMemo(
		() => getVisiblePages(currentPage, totalPages),
		[currentPage, totalPages],
	);

	useEffect(() => {
		if (!upNextQuery.data) {
			return;
		}

		if (upNextQuery.data.page !== page) {
			navigate({
				search: { page: upNextQuery.data.page },
				replace: true,
				resetScroll: false,
			});
		}
	}, [navigate, page, upNextQuery.data]);

	if (isAuthLoading || isProfileLoading) {
		return <AuthLoadingState className="max-w-6xl py-8" />;
	}

	if (!profile || !isOwner) {
		return null;
	}

	return (
		<div className="space-y-6">
			<PaginationControls
				currentPage={currentPage}
				totalPages={totalPages}
				pageNumbers={pageNumbers}
				isFetching={upNextQuery.isFetching}
				onPageChange={(nextPage) => {
					navigate({ search: { page: nextPage } });
				}}
			/>

			<UpNextShowCollection
				isLoading={upNextQuery.isLoading}
				upNext={items}
				userDid={userDid}
				profileHandle={profile.handle}
				readOnly={!isOwner}
				showHeader={false}
				variant="profile"
			/>

			<PaginationControls
				currentPage={currentPage}
				totalPages={totalPages}
				pageNumbers={pageNumbers}
				isFetching={upNextQuery.isFetching}
				onPageChange={(nextPage) => {
					navigate({ search: { page: nextPage } });
				}}
			/>
		</div>
	);
}
