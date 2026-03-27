import { socialControllerGetFollowingOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { useEffect } from "react";
import { AuthLoadingState } from "@/components/AuthLoadingState";
import { PaginationControls } from "@/components/PaginationControls";
import { SocialUserCard } from "@/components/social/SocialUserCard";
import { M3Button } from "@/components/ui/m3-button";
import {
	M3Card,
	M3CardDescription,
	M3CardHeader,
	M3CardTitle,
} from "@/components/ui/m3-card";
import { useProfileRouteState } from "@/hooks/useProfileRouteState";
import { getVisiblePages, parsePageNumber } from "@/lib/pagination";
import { getProfilePeopleRoute } from "@/lib/profile-routes";

const PAGE_SIZE = 20;

export const Route = createFileRoute("/profile/$handle/following")({
	validateSearch: (search: Record<string, unknown>) => ({
		page: parsePageNumber(search.page),
	}),
	head: ({ params }) => ({
		meta: [
			{ title: `@${params.handle.replace(/^@/, "")} Following | OpnShelf` },
		],
	}),
	component: FollowingPage,
});

function FollowingPage() {
	const { handle } = Route.useParams();
	const { page } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const { currentUser, isOwner, profile } = useProfileRouteState(handle);
	const followingQuery = useQuery({
		...socialControllerGetFollowingOptions({
			path: { handle },
			query: { page, pageSize: PAGE_SIZE },
		}),
		enabled: Boolean(currentUser?.did && profile?.did),
		retry: false,
	});

	useEffect(() => {
		if (!followingQuery.data) {
			return;
		}

		if (followingQuery.data.page !== page) {
			navigate({
				search: { page: followingQuery.data.page },
				replace: true,
				resetScroll: false,
			});
		}
	}, [followingQuery.data, navigate, page]);

	useEffect(() => {
		if (!currentUser || !profile || !isOwner) {
			return;
		}

		navigate({
			...getProfilePeopleRoute(profile.handle, {
				tab: "following",
				followingPage: page,
			}),
			replace: true,
			resetScroll: false,
		});
	}, [currentUser, isOwner, navigate, page, profile]);

	if (!currentUser) {
		return (
			<M3Card
				variant="elevated"
				className="mx-auto max-w-xl rounded-[28px] border"
				style={{ borderColor: "var(--md-sys-color-outline-variant)" }}
			>
				<M3CardHeader>
					<M3CardTitle className="md-headline-small">
						Sign in to view following
					</M3CardTitle>
					<M3CardDescription>
						Following lists are only available to signed-in OpnShelf users.
					</M3CardDescription>
					<div>
						<M3Button variant="filled" asChild className="rounded-full px-6">
							<Link to="/login">Sign in</Link>
						</M3Button>
					</div>
				</M3CardHeader>
			</M3Card>
		);
	}

	if (!profile || followingQuery.isLoading) {
		return <AuthLoadingState className="max-w-7xl py-8" />;
	}

	if (isOwner) {
		return <AuthLoadingState className="max-w-7xl py-8" />;
	}

	const currentPage = followingQuery.data?.page ?? page;
	const totalPages = followingQuery.data?.totalPages ?? 0;
	const pageNumbers = getVisiblePages(currentPage, totalPages);
	const users = followingQuery.data?.items ?? [];

	return (
		<div className="space-y-6">
			<PaginationControls
				currentPage={currentPage}
				totalPages={totalPages}
				pageNumbers={pageNumbers}
				isFetching={followingQuery.isFetching}
				onPageChange={(nextPage) => navigate({ search: { page: nextPage } })}
			/>

			{users.length === 0 ? (
				<M3Card
					variant="elevated"
					className="rounded-[28px] border"
					style={{ borderColor: "var(--md-sys-color-outline-variant)" }}
				>
					<M3CardHeader>
						<Users className="mb-4 size-12" />
						<M3CardTitle className="md-headline-small">
							Not following anyone yet
						</M3CardTitle>
						<M3CardDescription>
							@{profile.handle} is not following anyone on OpnShelf yet.
						</M3CardDescription>
					</M3CardHeader>
				</M3Card>
			) : (
				<div className="space-y-4">
					{users.map((user) => (
						<SocialUserCard
							key={user.did}
							user={user}
							viewerHandle={currentUser.handle}
						/>
					))}
				</div>
			)}
		</div>
	);
}
