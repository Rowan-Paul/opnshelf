import {
	type SocialUserCardDto,
	socialControllerGetFollowersOptions,
	socialControllerGetFollowingOptions,
	socialControllerSearchPeopleOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Search, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AuthLoadingState } from "@/components/AuthLoadingState";
import { PaginationControls } from "@/components/PaginationControls";
import { SocialUserCard } from "@/components/social/SocialUserCard";
import { M3Button } from "@/components/ui/m3-button";
import {
	M3Card,
	M3CardContent,
	M3CardDescription,
	M3CardHeader,
	M3CardTitle,
} from "@/components/ui/m3-card";
import { M3TextField } from "@/components/ui/m3-text-field";
import { useProfileRouteState } from "@/hooks/useProfileRouteState";
import { getVisiblePages, parsePageNumber } from "@/lib/pagination";
import {
	getProfilePeopleRoute,
	getProfileRoute,
	type ProfilePeopleTab,
} from "@/lib/profile-routes";

const DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;
const PEOPLE_TABS: readonly ProfilePeopleTab[] = ["following", "followers"];

export const Route = createFileRoute("/profile/$handle/people")({
	validateSearch: (search: Record<string, unknown>) => ({
		tab: isProfilePeopleTab(search.tab) ? search.tab : "following",
		q: typeof search.q === "string" ? search.q : "",
		discoverPage: parsePageNumber(search.discoverPage),
		followingPage: parsePageNumber(search.followingPage),
		followersPage: parsePageNumber(search.followersPage),
	}),
	head: ({ params }) => ({
		meta: [{ title: `@${params.handle.replace(/^@/, "")} Friends | OpnShelf` }],
	}),
	component: ProfilePeoplePage,
});

function ProfilePeoplePage() {
	const { handle } = Route.useParams();
	const { tab, q, discoverPage, followersPage, followingPage } =
		Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const { currentUser, profile, isAuthLoading, isLoading, isOwner } =
		useProfileRouteState(handle);
	const [query, setQuery] = useState(q);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const trimmedQuery = q.trim();
	const hasActiveQuery = trimmedQuery.length >= 2;

	const discoverQuery = useQuery({
		...socialControllerSearchPeopleOptions({
			query: {
				q: trimmedQuery,
				page: discoverPage,
				pageSize: PAGE_SIZE,
			},
		}),
		enabled: Boolean(
			currentUser?.did && profile?.did && isOwner && hasActiveQuery,
		),
	});
	const followingQuery = useQuery({
		...socialControllerGetFollowingOptions({
			path: { handle },
			query: { page: followingPage, pageSize: PAGE_SIZE },
		}),
		enabled: Boolean(
			currentUser?.did && profile?.did && isOwner && tab === "following",
		),
		retry: false,
	});
	const followersQuery = useQuery({
		...socialControllerGetFollowersOptions({
			path: { handle },
			query: { page: followersPage, pageSize: PAGE_SIZE },
		}),
		enabled: Boolean(
			currentUser?.did && profile?.did && isOwner && tab === "followers",
		),
		retry: false,
	});

	useEffect(() => {
		setQuery(q);
	}, [q]);

	useEffect(() => {
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}

		const nextQuery = query.trim();
		if (nextQuery === q) {
			return;
		}

		debounceRef.current = setTimeout(() => {
			navigate({
				search: {
					tab,
					q: nextQuery,
					discoverPage: 1,
					followingPage,
					followersPage,
				},
				replace: true,
				resetScroll: false,
			});
		}, DEBOUNCE_MS);

		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, [followersPage, followingPage, navigate, q, query, tab]);

	useEffect(() => {
		if (!discoverQuery.data) {
			return;
		}

		if (discoverQuery.data.page !== discoverPage) {
			navigate({
				search: {
					tab,
					q: trimmedQuery,
					discoverPage: discoverQuery.data.page,
					followingPage,
					followersPage,
				},
				replace: true,
				resetScroll: false,
			});
		}
	}, [
		discoverPage,
		discoverQuery.data,
		followersPage,
		followingPage,
		navigate,
		tab,
		trimmedQuery,
	]);

	useEffect(() => {
		if (!followingQuery.data || tab !== "following") {
			return;
		}

		if (followingQuery.data.page !== followingPage) {
			navigate({
				search: {
					tab,
					q,
					discoverPage,
					followingPage: followingQuery.data.page,
					followersPage,
				},
				replace: true,
				resetScroll: false,
			});
		}
	}, [
		discoverPage,
		followersPage,
		followingPage,
		followingQuery.data,
		navigate,
		q,
		tab,
	]);

	useEffect(() => {
		if (!followersQuery.data || tab !== "followers") {
			return;
		}

		if (followersQuery.data.page !== followersPage) {
			navigate({
				search: {
					tab,
					q,
					discoverPage,
					followingPage,
					followersPage: followersQuery.data.page,
				},
				replace: true,
				resetScroll: false,
			});
		}
	}, [
		discoverPage,
		followersPage,
		followersQuery.data,
		followingPage,
		navigate,
		q,
		tab,
	]);

	if (isAuthLoading || isLoading) {
		return <AuthLoadingState className="max-w-7xl py-8" />;
	}

	if (!currentUser) {
		return (
			<M3Card
				variant="elevated"
				className="mx-auto max-w-xl rounded-xl border"
				style={{ borderColor: "var(--md-sys-color-outline-variant)" }}
			>
				<M3CardHeader>
					<M3CardTitle className="md-headline-small">
						Sign in to manage your friends
					</M3CardTitle>
					<M3CardDescription>
						Your friends page is only available to signed-in OpnShelf users.
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

	if (!profile) {
		return null;
	}

	if (!isOwner) {
		return (
			<M3Card
				variant="elevated"
				className="rounded-xl border"
				style={{ borderColor: "var(--md-sys-color-outline-variant)" }}
			>
				<M3CardHeader>
					<M3CardTitle className="md-headline-small">
						Friends search lives on your profile
					</M3CardTitle>
					<M3CardDescription>
						Use your own Friends page to search OpnShelf users and manage who
						you follow.
					</M3CardDescription>
				</M3CardHeader>
				<M3CardContent className="flex flex-wrap gap-3">
					<M3Button variant="outlined" asChild className="rounded-full px-4">
						<Link
							{...getProfileRoute(profile.handle, "following", { page: 1 })}
						>
							View following
						</Link>
					</M3Button>
					<M3Button variant="outlined" asChild className="rounded-full px-4">
						<Link
							{...getProfileRoute(profile.handle, "followers", { page: 1 })}
						>
							View followers
						</Link>
					</M3Button>
					<M3Button variant="filled" asChild className="rounded-full px-4">
						<Link {...getProfilePeopleRoute(currentUser.handle)}>
							Go to your Friends page
						</Link>
					</M3Button>
				</M3CardContent>
			</M3Card>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
				<div>
					<h2 className="md-headline-small">Friends</h2>
					<p
						className="md-body-large"
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						Search OpnShelf friends, keep tabs on who follows you, and manage
						who you follow.
					</p>
				</div>
			</div>

			<div className="max-w-2xl">
				<div className="relative">
					<M3TextField
						label="Search OpnShelf friends"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Try a handle or display name"
						leadingIcon={<Search className="size-5" />}
					/>
					{query ? (
						<button
							type="button"
							onClick={() => {
								setQuery("");
								navigate({
									search: {
										tab,
										q: "",
										discoverPage: 1,
										followingPage,
										followersPage,
									},
									replace: true,
									resetScroll: false,
								});
							}}
							className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-(--md-sys-color-on-surface)/10"
							style={{
								color: "var(--md-sys-color-on-surface-variant)",
							}}
						>
							<X className="size-4" />
						</button>
					) : null}
				</div>
			</div>

			{hasActiveQuery ? (
				<SearchResultsSection
					currentPage={discoverQuery.data?.page ?? discoverPage}
					isFetching={discoverQuery.isFetching}
					pageNumbers={getVisiblePages(
						discoverQuery.data?.page ?? discoverPage,
						discoverQuery.data?.totalPages ?? 0,
					)}
					query={trimmedQuery}
					results={discoverQuery.data?.items ?? []}
					totalPages={discoverQuery.data?.totalPages ?? 0}
					viewerHandle={currentUser.handle}
					onPageChange={(nextPage) =>
						navigate({
							search: {
								tab,
								q: trimmedQuery,
								discoverPage: nextPage,
								followingPage,
								followersPage,
							},
						})
					}
				/>
			) : null}

			<div
				className="inline-flex w-full flex-wrap gap-2 rounded-full border p-1"
				style={{
					backgroundColor: "var(--md-sys-color-surface-container)",
					borderColor: "var(--md-sys-color-outline-variant)",
				}}
			>
				<PeopleTabButton
					isActive={tab === "following"}
					label={`Following (${profile.followingCount})`}
					onClick={() =>
						navigate({
							search: {
								tab: "following",
								q,
								discoverPage,
								followingPage,
								followersPage,
							},
							resetScroll: false,
						})
					}
				/>
				<PeopleTabButton
					isActive={tab === "followers"}
					label={`Followers (${profile.followersCount})`}
					onClick={() =>
						navigate({
							search: {
								tab: "followers",
								q,
								discoverPage,
								followingPage,
								followersPage,
							},
							resetScroll: false,
						})
					}
				/>
			</div>

			{tab === "following" ? (
				<ConnectionsSection
					emptyDescription="You are not following anyone on OpnShelf yet."
					emptyTitle="Not following anyone yet"
					isFetching={followingQuery.isFetching}
					isLoading={followingQuery.isLoading}
					items={followingQuery.data?.items ?? []}
					currentPage={followingQuery.data?.page ?? followingPage}
					pageNumbers={getVisiblePages(
						followingQuery.data?.page ?? followingPage,
						followingQuery.data?.totalPages ?? 0,
					)}
					totalPages={followingQuery.data?.totalPages ?? 0}
					viewerHandle={currentUser.handle}
					onPageChange={(nextPage) =>
						navigate({
							search: {
								tab: "following",
								q,
								discoverPage,
								followingPage: nextPage,
								followersPage,
							},
						})
					}
				/>
			) : (
				<ConnectionsSection
					emptyDescription="Nobody is following you on OpnShelf yet."
					emptyTitle="No followers yet"
					isFetching={followersQuery.isFetching}
					isLoading={followersQuery.isLoading}
					items={followersQuery.data?.items ?? []}
					currentPage={followersQuery.data?.page ?? followersPage}
					pageNumbers={getVisiblePages(
						followersQuery.data?.page ?? followersPage,
						followersQuery.data?.totalPages ?? 0,
					)}
					totalPages={followersQuery.data?.totalPages ?? 0}
					viewerHandle={currentUser.handle}
					onPageChange={(nextPage) =>
						navigate({
							search: {
								tab: "followers",
								q,
								discoverPage,
								followingPage,
								followersPage: nextPage,
							},
						})
					}
				/>
			)}
		</div>
	);
}

function PeopleTabButton({
	isActive,
	label,
	onClick,
}: {
	isActive: boolean;
	label: string;
	onClick: () => void;
}) {
	return (
		<M3Button
			size="sm"
			variant={isActive ? "filled-tonal" : "text"}
			className="min-w-24 flex-1 rounded-full"
			onClick={onClick}
		>
			{label}
		</M3Button>
	);
}

function SearchResultsSection({
	currentPage,
	isFetching,
	pageNumbers,
	query,
	results,
	totalPages,
	viewerHandle,
	onPageChange,
}: {
	currentPage: number;
	isFetching: boolean;
	pageNumbers: Array<number | "ellipsis">;
	query: string;
	results: SocialUserCardDto[];
	totalPages: number;
	viewerHandle: string;
	onPageChange: (page: number) => void;
}) {
	if (results.length === 0) {
		return (
			<M3Card
				variant="elevated"
				className="rounded-xl border"
				style={{ borderColor: "var(--md-sys-color-outline-variant)" }}
			>
				<M3CardHeader>
					<M3CardTitle className="md-headline-small">No results</M3CardTitle>
					<M3CardDescription>
						No OpnShelf profiles matched "{query}".
					</M3CardDescription>
				</M3CardHeader>
			</M3Card>
		);
	}

	return (
		<div
			className="space-y-6 transition-opacity duration-200"
			style={{
				opacity: isFetching && results.length > 0 ? 0.58 : 1,
			}}
		>
			<PaginationControls
				currentPage={currentPage}
				totalPages={totalPages}
				pageNumbers={pageNumbers}
				isFetching={isFetching}
				onPageChange={onPageChange}
			/>
			<div className="space-y-4">
				{results.map((user) => (
					<SocialUserCard
						key={user.did}
						user={user}
						viewerHandle={viewerHandle}
					/>
				))}
			</div>
		</div>
	);
}

function ConnectionsSection({
	currentPage,
	emptyDescription,
	emptyTitle,
	isFetching,
	isLoading,
	items,
	pageNumbers,
	totalPages,
	viewerHandle,
	onPageChange,
}: {
	currentPage: number;
	emptyDescription: string;
	emptyTitle: string;
	isFetching: boolean;
	isLoading: boolean;
	items: SocialUserCardDto[];
	pageNumbers: Array<number | "ellipsis">;
	totalPages: number;
	viewerHandle: string;
	onPageChange: (page: number) => void;
}) {
	if (isLoading) {
		return <AuthLoadingState className="max-w-7xl py-8" />;
	}

	if (items.length === 0) {
		return (
			<M3Card
				variant="elevated"
				className="rounded-xl border"
				style={{ borderColor: "var(--md-sys-color-outline-variant)" }}
			>
				<M3CardHeader>
					<Users
						className="mb-4 size-12"
						style={{ color: "var(--md-sys-color-primary)" }}
					/>
					<M3CardTitle className="md-headline-small">{emptyTitle}</M3CardTitle>
					<M3CardDescription>{emptyDescription}</M3CardDescription>
				</M3CardHeader>
			</M3Card>
		);
	}

	return (
		<div className="space-y-6">
			<PaginationControls
				currentPage={currentPage}
				totalPages={totalPages}
				pageNumbers={pageNumbers}
				isFetching={isFetching}
				onPageChange={onPageChange}
			/>
			<div className="space-y-4">
				{items.map((user) => (
					<SocialUserCard
						key={user.did}
						user={user}
						viewerHandle={viewerHandle}
					/>
				))}
			</div>
		</div>
	);
}

function isProfilePeopleTab(value: unknown): value is ProfilePeopleTab {
	return (
		typeof value === "string" && PEOPLE_TABS.includes(value as ProfilePeopleTab)
	);
}
