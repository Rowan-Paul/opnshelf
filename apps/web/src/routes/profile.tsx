import { authControllerMeOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { BookOpen, List } from "lucide-react";
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

	if (isAuthLoading) {
		return (
			<div className="min-h-screen bg-gray-950 text-gray-50">
				<div className="container mx-auto px-4 py-4 max-w-7xl">
					<div className="animate-pulse space-y-8">
						<div className="flex items-center gap-4">
							<div className="w-16 h-16 bg-gray-800 rounded-full" />
							<div className="space-y-2">
								<div className="h-6 w-32 bg-gray-800 rounded" />
								<div className="h-4 w-48 bg-gray-800 rounded" />
							</div>
						</div>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div className="h-24 bg-gray-800 rounded-lg" />
							<div className="h-24 bg-gray-800 rounded-lg" />
						</div>
					</div>
				</div>
			</div>
		);
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
		<div className="min-h-screen bg-gray-950 text-gray-50">
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
						<div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center">
							<span className="text-2xl font-bold">
								{String(user.displayName)?.[0] || user.handle[0]}
							</span>
						</div>
					)}
					<div>
						<h1 className="text-2xl font-bold">
							{String(user.displayName || user.handle)}
						</h1>
						{user.displayName && (
							<p className="text-gray-400">@{user.handle}</p>
						)}
					</div>
				</div>

				{/* Navigation Tabs */}
				<div className="flex gap-2 mb-8 border-b border-gray-800 pb-4">
					<NavLink to="/profile/shelf" icon={BookOpen} label="My Shelf" />
					<NavLink to="/profile/lists" icon={List} label="My Lists" />
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
	return (
		<Link
			to={to}
			className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-400 hover:text-gray-50 hover:bg-gray-800 transition-colors [&.active]:text-purple-500 [&.active]:bg-purple-500/10"
		>
			<Icon className="w-5 h-5" />
			<span>{label}</span>
		</Link>
	);
}
