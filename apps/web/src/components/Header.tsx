import {
	authControllerLogoutMutation,
	authControllerMeOptions,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
	BookOpen,
	Film,
	Home,
	LogIn,
	LogOut,
	Menu,
	Search,
	Settings,
	User,
	X,
} from "lucide-react";
import { useState } from "react";

export default function Header() {
	const [isOpen, setIsOpen] = useState(false);
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	// Fetch auth state using generated TanStack Query hook
	const { data: user, isLoading: isAuthLoading } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000, // 5 minutes
		retry: false,
	});

	// Logout mutation using generated TanStack Query hook
	const logoutMutation = useMutation({
		...authControllerLogoutMutation(),
		onSuccess: () => {
			// Remove auth queries to immediately clear user data
			queryClient.removeQueries(authControllerMeOptions());
			// Navigate to home page after successful logout
			navigate({ to: "/" });
		},
	});

	const handleLogout = async () => {
		await logoutMutation.mutateAsync({});
	};

	const handleLogin = () => {
		navigate({ to: "/login" });
	};

	return (
		<>
			<header className="px-4 py-3 flex items-center justify-between bg-gray-900 text-white border-b border-gray-800">
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={() => setIsOpen(true)}
						className="p-2 hover:bg-gray-800 rounded-lg transition-colors md:hidden"
						aria-label="Open menu"
					>
						<Menu size={24} />
					</button>
					<Link to="/" className="flex items-center gap-2">
						<Film className="w-8 h-8 text-purple-500" />
						<span className="text-xl font-bold">OpnShelf</span>
					</Link>
				</div>

				{/* Desktop nav */}
				<nav className="hidden md:flex items-center gap-1">
					<Link
						to="/"
						className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-300 hover:text-white"
						activeProps={{
							className:
								"flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 transition-colors text-white",
						}}
						activeOptions={{ exact: true }}
					>
						<Home size={18} />
						<span className="font-medium">Home</span>
					</Link>
					{user && (
						<Link
							to="/shelf"
							className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-300 hover:text-white"
							activeProps={{
								className:
									"flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 transition-colors text-white",
							}}
						>
							<BookOpen size={18} />
							<span className="font-medium">My Shelf</span>
						</Link>
					)}
					<Link
						to="/search"
						search={{ q: "" }}
						className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-300 hover:text-white"
					>
						<Search size={18} />
						<span className="font-medium">Search</span>
					</Link>

					{/* Auth section */}
					<div className="ml-4 pl-4 border-l border-gray-700">
						{isAuthLoading ? (
							<div className="w-8 h-8 rounded-full bg-gray-700 animate-pulse" />
						) : user ? (
							<div className="flex items-center gap-3">
								{user.avatar ? (
									<img
										src={String(user.avatar)}
										alt={String(user.displayName || user.handle)}
										className="w-8 h-8 rounded-full"
									/>
								) : (
									<div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
										<User size={16} />
									</div>
								)}
								<span className="text-sm text-gray-300">
									{user.displayName
										? String(user.displayName)
										: `@${user.handle}`}
								</span>
								<Link
									to="/settings"
									className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors text-gray-300 hover:text-white text-sm"
									title="Settings"
								>
									<Settings size={16} />
								</Link>
								<button
									type="button"
									onClick={handleLogout}
									disabled={logoutMutation.isPending}
									className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors text-gray-300 hover:text-white text-sm"
									title="Sign out"
								>
									<LogOut size={16} />
								</button>
							</div>
						) : (
							<button
								type="button"
								onClick={handleLogin}
								className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 transition-colors text-white text-sm font-medium"
							>
								<LogIn size={16} />
								<span>Sign in</span>
							</button>
						)}
					</div>
				</nav>
			</header>

			{/* Mobile drawer overlay */}
			{isOpen && (
				<button
					type="button"
					className="fixed inset-0 bg-black/50 z-40 md:hidden"
					onClick={() => setIsOpen(false)}
					aria-label="Close menu overlay"
				/>
			)}

			{/* Mobile drawer */}
			<aside
				className={`fixed top-0 left-0 h-full w-72 bg-gray-900 text-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col md:hidden ${
					isOpen ? "translate-x-0" : "-translate-x-full"
				}`}
			>
				<div className="flex items-center justify-between p-4 border-b border-gray-800">
					<div className="flex items-center gap-2">
						<Film className="w-6 h-6 text-purple-500" />
						<span className="text-lg font-bold">OpnShelf</span>
					</div>
					<button
						type="button"
						onClick={() => setIsOpen(false)}
						className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
						aria-label="Close menu"
					>
						<X size={24} />
					</button>
				</div>

				<nav className="flex-1 p-4 overflow-y-auto">
					<Link
						to="/"
						onClick={() => setIsOpen(false)}
						className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2 text-gray-300 hover:text-white"
						activeProps={{
							className:
								"flex items-center gap-3 p-3 rounded-lg bg-purple-600 hover:bg-purple-700 transition-colors mb-2 text-white",
						}}
						activeOptions={{ exact: true }}
					>
						<Home size={20} />
						<span className="font-medium">Home</span>
					</Link>

					<Link
						to="/search"
						search={{ q: "" }}
						onClick={() => setIsOpen(false)}
						className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2 text-gray-300 hover:text-white"
					>
						<Search size={20} />
						<span className="font-medium">Search</span>
					</Link>

					{user && (
						<>
							<Link
								to="/shelf"
								onClick={() => setIsOpen(false)}
								className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2 text-gray-300 hover:text-white"
								activeProps={{
									className:
										"flex items-center gap-3 p-3 rounded-lg bg-purple-600 hover:bg-purple-700 transition-colors mb-2 text-white",
								}}
							>
								<BookOpen size={20} />
								<span className="font-medium">My Shelf</span>
							</Link>
							<Link
								to="/settings"
								onClick={() => setIsOpen(false)}
								className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2 text-gray-300 hover:text-white"
							>
								<Settings size={20} />
								<span className="font-medium">Settings</span>
							</Link>
						</>
					)}
				</nav>

				{/* Mobile auth section */}
				<div className="p-4 border-t border-gray-800">
					{isAuthLoading ? (
						<div className="h-12 bg-gray-700 rounded-lg animate-pulse" />
					) : user ? (
						<div className="space-y-3">
							<div className="flex items-center gap-3">
								{user.avatar ? (
									<img
										src={String(user.avatar)}
										alt={String(user.displayName || user.handle)}
										className="w-10 h-10 rounded-full"
									/>
								) : (
									<div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center">
										<User size={20} />
									</div>
								)}
								<div>
									<div className="font-medium">
										{user.displayName ? String(user.displayName) : user.handle}
									</div>
									<div className="text-sm text-gray-400">@{user.handle}</div>
								</div>
							</div>
							<button
								type="button"
								onClick={() => {
									handleLogout();
									setIsOpen(false);
								}}
								disabled={logoutMutation.isPending}
								className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-gray-300"
							>
								<LogOut size={18} />
								<span>Sign out</span>
							</button>
						</div>
					) : (
						<button
							type="button"
							onClick={() => {
								handleLogin();
								setIsOpen(false);
							}}
							className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 transition-colors text-white font-medium"
						>
							<LogIn size={18} />
							<span>Sign in</span>
						</button>
					)}
				</div>
			</aside>
		</>
	);
}
