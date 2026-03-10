import { authControllerMeOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import {
	redirect,
	createFileRoute,
	Link,
	Outlet,
	useMatchRoute,
} from "@tanstack/react-router";
import { BookOpen, List, Settings, Tv } from "lucide-react";
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
import { usePublicProfile } from "@/hooks/usePublicProfile";

export const Route = createFileRoute("/u/$handle")({
	beforeLoad: ({ location, params }) => {
		if (location.pathname === `/u/${params.handle}`) {
			throw redirect({
				to: "/u/$handle/shelf",
				params,
				search: { page: 1 },
			});
		}
	},
	head: ({ params }) => ({
		meta: [{ title: `@${params.handle.replace(/^@/, "")} | OpnShelf` }],
	}),
	component: PublicProfileLayout,
});

function PublicProfileLayout() {
	const { handle } = Route.useParams();
	const { data: profile, isLoading } = usePublicProfile(handle);
	const { data: currentUser } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});
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
	const isOwner = currentUser?.did === profile.did;

	return (
		<div
			className="min-h-screen"
			style={{
				backgroundColor: "var(--md-sys-color-background)",
				color: "var(--md-sys-color-on-background)",
			}}
		>
			<div className="container mx-auto px-4 py-4 max-w-7xl">
				<div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
					<div className="flex items-center gap-4">
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

					{isOwner ? (
						<M3Button variant="outlined" asChild>
							<Link to="/profile/shelf" search={{ page: 1 }}>
								<Settings className="mr-2 h-4 w-4" />
								Manage profile
							</Link>
						</M3Button>
					) : null}
				</div>

				<div
					className="mb-8 flex flex-col gap-2 border-b pb-4 sm:flex-row sm:gap-4"
					style={{
						borderBottom: "1px solid var(--md-sys-color-outline-variant)",
					}}
				>
					<PublicNavLink
						handle={profile.handle}
						icon={BookOpen}
						label="Shelf"
						to="/u/$handle/shelf"
					/>
					<PublicNavLink
						handle={profile.handle}
						icon={Tv}
						label="Up Next"
						to="/u/$handle/up-next"
					/>
					<PublicNavLink
						handle={profile.handle}
						icon={List}
						label="Lists"
						to="/u/$handle/lists"
					/>
				</div>

				<Outlet />
			</div>
		</div>
	);
}

function PublicNavLink({
	handle,
	icon: Icon,
	label,
	to,
}: {
	handle: string;
	icon: ComponentType<{ className?: string }>;
	label: string;
	to: "/u/$handle/shelf" | "/u/$handle/up-next" | "/u/$handle/lists";
}) {
	const { seedColor } = useTheme();
	const matchRoute = useMatchRoute();
	const isActive = Boolean(
		matchRoute({
			to,
			params: { handle },
			fuzzy: false,
		}),
	);

	return (
		<Link
			to={to}
			params={{ handle }}
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
