import {
	authControllerMeOptions,
	showsControllerGetUserUpNextOptions,
	usersControllerGetPublicProfileOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { ArrowDownAZ, ArrowUpDown, Clock, TrendingUp } from "lucide-react";
import { useEffect, useMemo } from "react";
import { AuthLoadingState } from "@/components/AuthLoadingState";
import { PaginationControls } from "@/components/PaginationControls";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { UpNextShowCollection } from "@/components/up-next/UpNextShowCollection";
import { useProfileRouteState } from "@/hooks/useProfileRouteState";
import { getVisiblePages, parsePageNumber } from "@/lib/pagination";
import { getProfileRoute, isOwnerProfile } from "@/lib/profile-routes";
import { getSsrAuthHeaders } from "@/lib/ssr-auth-headers";

const PAGE_SIZE = 8;

type SortBy = "lastWatched" | "title" | "progress";
type SortOrder = "asc" | "desc";

const SORT_OPTIONS: Array<{
	value: `${SortBy}-${SortOrder}`;
	label: string;
	icon: typeof Clock;
}> = [
	{ value: "lastWatched-desc", label: "Recently watched", icon: Clock },
	{ value: "lastWatched-asc", label: "Oldest watched", icon: Clock },
	{ value: "title-asc", label: "Title A-Z", icon: ArrowDownAZ },
	{ value: "title-desc", label: "Title Z-A", icon: ArrowDownAZ },
	{ value: "progress-desc", label: "Most progress", icon: TrendingUp },
	{ value: "progress-asc", label: "Least progress", icon: TrendingUp },
];

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
		sortBy: (["lastWatched", "title", "progress"].includes(
			search.sortBy as string,
		)
			? search.sortBy
			: "lastWatched") as SortBy,
		sortOrder: (["asc", "desc"].includes(search.sortOrder as string)
			? search.sortOrder
			: "desc") as SortOrder,
	}),
	head: ({ params }) => ({
		meta: [{ title: `@${params.handle.replace(/^@/, "")} Up Next | OpnShelf` }],
	}),
	component: ProfileUpNextPage,
});

function ProfileUpNextPage() {
	const { handle } = Route.useParams();
	const { page, sortBy, sortOrder } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const { profile, isAuthLoading, isOwner, isProfileLoading } =
		useProfileRouteState(handle);
	const userDid = profile?.did ?? "";

	const sortValue = `${sortBy}-${sortOrder}` as `${SortBy}-${SortOrder}`;

	const upNextQuery = useQuery({
		...showsControllerGetUserUpNextOptions({
			path: { userDid },
			query: { page, pageSize: PAGE_SIZE, sortBy, sortOrder },
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
				search: { page: upNextQuery.data.page, sortBy, sortOrder },
				replace: true,
				resetScroll: false,
			});
		}
	}, [navigate, page, sortBy, sortOrder, upNextQuery.data]);

	if (isAuthLoading || isProfileLoading) {
		return <AuthLoadingState className="max-w-7xl py-8" />;
	}

	if (!profile || !isOwner) {
		return null;
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<PaginationControls
					currentPage={currentPage}
					totalPages={totalPages}
					pageNumbers={pageNumbers}
					isFetching={upNextQuery.isFetching}
					onPageChange={(nextPage) => {
						navigate({
							search: { page: nextPage, sortBy, sortOrder },
						});
					}}
				/>
				<Select
					value={sortValue}
					onValueChange={(value) => {
						const [newSortBy, newSortOrder] = value.split("-") as [
							SortBy,
							SortOrder,
						];
						navigate({
							search: {
								page: 1,
								sortBy: newSortBy,
								sortOrder: newSortOrder,
							},
						});
					}}
				>
					<SelectTrigger className="w-full bg-popover sm:w-56">
						<ArrowUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{SORT_OPTIONS.map((opt) => (
							<SelectItem key={opt.value} value={opt.value}>
								{opt.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<UpNextShowCollection
				isFetching={upNextQuery.isFetching}
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
					navigate({
						search: { page: nextPage, sortBy, sortOrder },
					});
				}}
			/>
		</div>
	);
}
