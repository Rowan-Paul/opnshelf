import { authControllerMeOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	Outlet,
	useMatchRoute,
} from "@tanstack/react-router";
import { BookOpen, Calendar, List, Settings, Tv } from "lucide-react";
import { AuthLoadingState } from "@/components/AuthLoadingState";
import { useTheme } from "@/components/theme-provider";
import { UnauthenticatedState } from "@/components/UnauthenticatedState";

export const Route = createFileRoute("/profile")({
	head: () => ({
		meta: [{ title: "Profile | OpnShelf" }],
	}),
	component: ProfileLayout,
});

function ProfileLayout() {
	const { data: user, isLoading: isAuthLoading } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});
	const { seedColor } = useTheme();

	if (isAuthLoading) {
		return <AuthLoadingState className="max-w-7xl py-4" />;
	}

	if (!user) {
		return (
			<UnauthenticatedState
				title="Profile"
				description="Sign in to manage your shelf and lists"
			/>
		);
	}

	return (
		<div
			className="min-h-screen"
			style={{
				backgroundColor: "var(--md-sys-color-background)",
				color: "var(--md-sys-color-on-background)",
			}}
		>
			<div className="container mx-auto px-4 py-4 max-w-7xl">
				{/* Profile Header */}
				<div className="flex items-center gap-4 mb-8">
					{user.avatar ? (
						<img
							src={String(user.avatar)}
							alt={String(user.displayName || user.handle)}
							className="w-16 h-16 rounded-full object-cover"
						/>
					) : (
						<div
							className="w-16 h-16 rounded-full flex items-center justify-center"
							style={{
								backgroundColor: seedColor,
								color: "var(--md-sys-color-on-primary)",
							}}
						>
							<span className="text-2xl font-bold">
								{String(user.displayName)?.[0] || user.handle[0]}
							</span>
						</div>
					)}
					<div className="min-w-0 flex-1">
						<h1 className="md-headline-medium [overflow-wrap:anywhere]">
							{String(user.displayName || user.handle)}
						</h1>
						{user.displayName && (
							<p
								className="[overflow-wrap:anywhere]"
								style={{ color: "var(--md-sys-color-on-surface-variant)" }}
							>
								<Link
									to="/u/$handle/shelf"
									params={{ handle: user.handle }}
									search={{ page: 1 }}
								>
									@{user.handle}
								</Link>
							</p>
						)}
					</div>
				</div>

				{/* Navigation Tabs */}
				<div
					className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-8 pb-4"
					style={{
						borderBottom: "1px solid var(--md-sys-color-outline-variant)",
					}}
				>
					<NavLink to="/profile/shelf" icon={BookOpen} label="My Shelf" />
					<NavLink to="/profile/up-next" icon={Tv} label="Up Next" />
					<NavLink to="/profile/calendar" icon={Calendar} label="Calendar" />
					<NavLink to="/profile/lists" icon={List} label="My Lists" />
					<NavLink to="/profile/settings" icon={Settings} label="Settings" />
				</div>

				{/* Nested Routes */}
				<Outlet />
			</div>
		</div>
	);
}

function NavLink({
	to,
	icon: Icon,
	label,
}: {
	to: string;
	icon: React.ComponentType<{ className?: string }>;
	label: string;
}) {
	const { seedColor } = useTheme();
	const matchRoute = useMatchRoute();
	const isActive = Boolean(
		matchRoute({
			to,
			fuzzy: false,
		}),
	);

	return (
		<Link
			to={to}
			className={`flex items-center gap-2 px-4 py-2 rounded-[var(--md-sys-shape-corner-large)] transition-colors md-label-large ${
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
			<Icon className="w-5 h-5" />
			<span>{label}</span>
		</Link>
	);
}
