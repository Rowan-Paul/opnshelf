import { socialControllerGetFollowersOptions } from "@opnshelf/api";
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

export const Route = createFileRoute("/profile/$handle/followers")({
	validateSearch: (search: Record<string, unknown>) => ({
		page: parsePageNumber(search.page),
	}),
	head: ({ params }) => ({
		meta: [
			{ title: `@${params.handle.replace(/^@/, "")} Followers | OpnShelf` },
		],
	}),
	component: FollowersPage,
});

function FollowersPage() {
	const { handle } = Route.useParams();
	const { page } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const { currentUser, isOwner, profile } = useProfileRouteState(handle);
	const followersQuery = useQuery({
		...socialControllerGetFollowersOptions({
			path: { handle },
			query: { page, pageSize: PAGE_SIZE },
		}),
		enabled: Boolean(currentUser?.did && profile?.did),
		retry: false,
	});

	useEffect(() => {
		if (!followersQuery.data) {
			return;
		}

		if (followersQuery.data.page !== page) {
			navigate({
				search: { page: followersQuery.data.page },
				replace: true,
				resetScroll: false,
			});
		}
	}, [followersQuery.data, navigate, page]);

	useEffect(() => {
		if (!currentUser || !profile || !isOwner) {
			return;
		}

		navigate({
			...getProfilePeopleRoute(profile.handle, {
				tab: "followers",
				followersPage: page,
			}),
			replace: true,
			resetScroll: false,
		});
	}, [currentUser, isOwner, navigate, page, profile]);

	if (!currentUser) {
		return (
			<M3Card
				variant="elevated"
				className="mx-auto max-w-xl rounded-xl border"
				style={{ borderColor: "var(--md-sys-color-outline-variant)" }}
			>
				<M3CardHeader>
					<M3CardTitle className="md-headline-small">
						Sign in to view followers
					</M3CardTitle>
					<M3CardDescription>
						Follower lists are only available to signed-in OpnShelf users.
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

	if (!profile || followersQuery.isLoading) {
		return <AuthLoadingState className="max-w-7xl py-8" />;
	}

	if (isOwner) {
		return <AuthLoadingState className="max-w-7xl py-8" />;
	}

	const currentPage = followersQuery.data?.page ?? page;
	const totalPages = followersQuery.data?.totalPages ?? 0;
	const pageNumbers = getVisiblePages(currentPage, totalPages);
	const users = followersQuery.data?.items ?? [];

	return (
		<div className="space-y-6">
			<PaginationControls
				currentPage={currentPage}
				totalPages={totalPages}
				pageNumbers={pageNumbers}
				isFetching={followersQuery.isFetching}
				onPageChange={(nextPage) => navigate({ search: { page: nextPage } })}
			/>

			{users.length === 0 ? (
				<M3Card
					variant="elevated"
					className="rounded-xl border"
					style={{ borderColor: "var(--md-sys-color-outline-variant)" }}
				>
					<M3CardHeader>
						<Users className="mb-4 size-12" />
						<M3CardTitle className="md-headline-small">
							No followers yet
						</M3CardTitle>
						<M3CardDescription>
							No one is following @{profile.handle} on OpnShelf yet.
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
