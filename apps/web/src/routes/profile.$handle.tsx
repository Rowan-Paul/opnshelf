import { socialControllerGetRelationshipOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
	useLocation,
	useMatchRoute,
} from "@tanstack/react-router";
import {
	BookOpen,
	Calendar,
	List,
	Settings,
	Star,
	Tv,
	Users,
} from "lucide-react";
import type { ComponentType } from "react";
import { AuthLoadingState } from "@/components/AuthLoadingState";
import {
	canClickRelationshipCounts,
	shouldShowFollowButton,
} from "@/components/profile/profile-header-state";
import { SocialFollowButton } from "@/components/social/SocialFollowButton";
import { getSocialDisplayName } from "@/components/social/social-display";
import { useTheme } from "@/components/theme-provider";
import { M3Button } from "@/components/ui/m3-button";
import {
	M3Card,
	M3CardContent,
	M3CardDescription,
	M3CardHeader,
	M3CardTitle,
} from "@/components/ui/m3-card";
import { useProfileRouteState } from "@/hooks/useProfileRouteState";
import {
	getProfilePeopleRoute,
	getProfileRoute,
	normalizeProfileHandle,
	type ProfileSection,
} from "@/lib/profile-routes";

export const Route = createFileRoute("/profile/$handle")({
	beforeLoad: ({ location, params }) => {
		if (
			location.pathname === `/profile/${params.handle}` ||
			location.pathname === `/profile/${params.handle}/`
		) {
			throw redirect({
				...getProfileRoute(params.handle, "shelf", { page: 1 }),
			});
		}
	},
	head: ({ params }) => ({
		meta: [{ title: `@${params.handle.replace(/^@/, "")} | OpnShelf` }],
	}),
	component: ProfileLayout,
});

function ProfileLayout() {
	const { handle } = Route.useParams();
	const { currentUser, profile, isOwner, isLoading } =
		useProfileRouteState(handle);
	const { seedColor } = useTheme();
	const relationshipQuery = useQuery({
		...socialControllerGetRelationshipOptions({
			path: { targetDid: profile?.did ?? "" },
		}),
		enabled: Boolean(currentUser?.did && profile?.did && !isOwner),
		retry: false,
	});
	const isSignedIn = Boolean(currentUser?.did);

	if (isLoading) {
		return <AuthLoadingState className="max-w-7xl py-4" />;
	}

	if (!profile) {
		return (
			<div
				className="min-h-screen"
				style={{
					backgroundColor: "var(--md-sys-color-background)",
					color: "var(--md-sys-color-on-background)",
				}}
			>
				<div className="container mx-auto max-w-3xl px-4 py-8">
					<M3Card variant="elevated" className="text-center">
						<M3CardHeader>
							<M3CardTitle className="md-headline-small">
								Profile not found
							</M3CardTitle>
							<M3CardDescription>
								There isn&apos;t a public OpnShelf profile for @{handle}.
							</M3CardDescription>
						</M3CardHeader>
						<M3CardContent>
							<M3Button variant="filled" asChild>
								<Link to="/">Go home</Link>
							</M3Button>
						</M3CardContent>
					</M3Card>
				</div>
			</div>
		);
	}

	const displayName = getSocialDisplayName(profile.displayName, profile.handle);
	const relationship = relationshipQuery.data;
	const countsAreClickable = canClickRelationshipCounts(isSignedIn);
	const followButtonVisible = shouldShowFollowButton({
		isSignedIn,
		isOwner,
	});

	return (
		<div
			className="min-h-screen"
			style={{
				backgroundColor: "var(--md-sys-color-background)",
				color: "var(--md-sys-color-on-background)",
			}}
		>
			<div className="container mx-auto px-4 py-4 max-w-7xl">
				<div className="mb-8 flex items-center gap-4">
					{profile.avatar ? (
						<img
							src={String(profile.avatar)}
							alt={displayName}
							className="h-16 w-16 rounded-full object-cover"
						/>
					) : (
						<div
							className="flex h-16 w-16 items-center justify-center rounded-full"
							style={{
								backgroundColor: seedColor,
								color: "var(--md-sys-color-on-primary)",
							}}
						>
							<span className="text-2xl font-bold">
								{displayName[0] || "?"}
							</span>
						</div>
					)}
					<div className="min-w-0 flex-1">
						<h1 className="md-headline-medium [overflow-wrap:anywhere]">
							{displayName}
						</h1>
						<p
							className="[overflow-wrap:anywhere]"
							style={{ color: "var(--md-sys-color-on-surface-variant)" }}
						>
							@{profile.handle}
						</p>
						<div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
							<ProfileCountLink
								isInteractive={countsAreClickable}
								label="Following"
								value={profile.followingCount}
								route={
									isOwner
										? getProfilePeopleRoute(profile.handle, {
												tab: "following",
											})
										: getProfileRoute(profile.handle, "following", {
												page: 1,
											})
								}
							/>
							<span
								style={{ color: "var(--md-sys-color-outline)" }}
								aria-hidden="true"
							>
								•
							</span>
							<ProfileCountLink
								isInteractive={countsAreClickable}
								label="Followers"
								value={profile.followersCount}
								route={
									isOwner
										? getProfilePeopleRoute(profile.handle, {
												tab: "followers",
											})
										: getProfileRoute(profile.handle, "followers", {
												page: 1,
											})
								}
							/>
						</div>
					</div>
					{followButtonVisible ? (
						<SocialFollowButton
							targetDid={profile.did}
							targetHandle={profile.handle}
							viewerHandle={currentUser?.handle}
							isFollowing={relationship?.isFollowing ?? false}
							isFollowedBy={relationship?.isFollowedBy ?? false}
							disabled={relationshipQuery.isLoading}
							className="rounded-full px-6"
						/>
					) : null}
				</div>

				<div
					className="mb-8 flex flex-col gap-2 border-b pb-4 sm:flex-row sm:gap-4"
					style={{
						borderBottom: "1px solid var(--md-sys-color-outline-variant)",
					}}
				>
					<ProfileNavLink
						handle={profile.handle}
						icon={BookOpen}
						label="Shelf"
						section="shelf"
					/>
					<ProfileNavLink
						handle={profile.handle}
						icon={Tv}
						label="Up Next"
						section="up-next"
					/>
					<ProfileNavLink
						handle={profile.handle}
						icon={List}
						label="Lists"
						section="lists"
					/>
					{isSignedIn ? (
						isOwner ? (
							<ProfileNavLink
								handle={profile.handle}
								icon={Users}
								label="Friends"
								section="people"
							/>
						) : (
							<>
								<ProfileNavLink
									handle={profile.handle}
									icon={Users}
									label="Followers"
									section="followers"
								/>
								<ProfileNavLink
									handle={profile.handle}
									icon={Star}
									label="Following"
									section="following"
								/>
							</>
						)
					) : null}
					{isOwner ? (
						<>
							<ProfileNavLink
								handle={profile.handle}
								icon={Calendar}
								label="Calendar"
								section="calendar"
							/>
							<ProfileNavLink
								handle={profile.handle}
								icon={Settings}
								label="Settings"
								section="settings"
							/>
						</>
					) : null}
				</div>

				<Outlet />
			</div>
		</div>
	);
}

function ProfileCountLink({
	isInteractive,
	label,
	value,
	route,
}: {
	isInteractive: boolean;
	label: string;
	value: number;
	route:
		| ReturnType<typeof getProfileRoute>
		| ReturnType<typeof getProfilePeopleRoute>;
}) {
	const content = (
		<span className="inline-flex items-center gap-2">
			<span className="font-semibold">{value}</span>
			<span style={{ color: "var(--md-sys-color-on-surface-variant)" }}>
				{label}
			</span>
		</span>
	);

	if (!isInteractive) {
		return content;
	}

	return (
		<Link
			{...route}
			className="rounded-full px-2 py-1 hover:bg-(--md-sys-color-surface-container)"
		>
			{content}
		</Link>
	);
}

function ProfileNavLink({
	handle,
	icon: Icon,
	label,
	section,
}: {
	handle: string;
	icon: ComponentType<{ className?: string }>;
	label: string;
	section: ProfileSection;
}) {
	const { seedColor } = useTheme();
	const matchRoute = useMatchRoute();
	const location = useLocation();
	const route = getProfileRoute(
		handle,
		section,
		section === "shelf" || section === "up-next" ? { page: 1 } : undefined,
	);
	const normalizedHandle = normalizeProfileHandle(handle);
	const isPublicListDetailRoute =
		section === "lists" &&
		location.pathname.startsWith(`/profile/${normalizedHandle}/list/`);
	const isActive =
		isPublicListDetailRoute ||
		Boolean(
			matchRoute({
				to: route.to,
				params: route.params,
				fuzzy: false,
			}),
		);

	return (
		<Link
			{...route}
			className={`flex items-center gap-2 rounded-[var(--md-sys-shape-corner-large)] px-4 py-2 transition-colors md-label-large ${
				isActive
					? ""
					: "hover:bg-[var(--md-sys-color-surface-container)] hover:text-[var(--md-sys-color-on-surface)]"
			}`}
			style={
				isActive
					? {
							backgroundColor: `${seedColor}20`,
							color: seedColor,
						}
					: { color: "var(--md-sys-color-on-surface-variant)" }
			}
		>
			<Icon className="h-5 w-5" />
			<span>{label}</span>
		</Link>
	);
}
