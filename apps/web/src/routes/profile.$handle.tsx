import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
	useLocation,
	useMatchRoute,
} from "@tanstack/react-router";
import { BookOpen, Calendar, List, Settings, Tv } from "lucide-react";
import type { ComponentType } from "react";
import { AuthLoadingState } from "@/components/AuthLoadingState";
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
	const { profile, isOwner, isLoading } = useProfileRouteState(handle);
	const { seedColor } = useTheme();

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

	const displayName = String(profile.displayName || profile.handle);

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
					</div>
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
