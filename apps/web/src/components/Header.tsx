import {
	authControllerLogoutMutation,
	authControllerMeOptions,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Film, Home, LogIn, LogOut, Menu, Search, User, X } from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { M3Button } from "@/components/ui/m3-button";

export default function Header() {
	const [isOpen, setIsOpen] = useState(false);
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { seedColor } = useTheme();

	const { data: user, isLoading: isAuthLoading } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	const logoutMutation = useMutation({
		mutationKey: ["auth", "logout"],
		...authControllerLogoutMutation(),
		onSuccess: () => {
			queryClient.removeQueries(authControllerMeOptions());
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
			<header
				className="px-4 py-3 flex items-center justify-between md-elevation-1 sticky top-0 z-30"
				style={{
					backgroundColor: "var(--md-sys-color-surface)",
					color: "var(--md-sys-color-on-surface)",
				}}
			>
				<div className="flex items-center gap-3">
					<M3Button
						variant="text"
						size="icon"
						onClick={() => setIsOpen(true)}
						className="md:hidden"
						aria-label="Open menu"
					>
						<Menu size={24} />
					</M3Button>
					<Link to="/" className="flex items-center gap-2 group">
						<Film
							className="w-8 h-8 transition-transform group-hover:scale-110"
							style={{ color: seedColor }}
						/>
						<span className="md-title-large">OpnShelf</span>
					</Link>
				</div>

				<nav className="hidden md:flex items-center gap-1">
					<Link
						to="/"
						className="flex items-center gap-2 px-4 py-2 rounded-(--md-sys-shape-corner-large) transition-colors md-label-large"
						style={{
							color: "var(--md-sys-color-on-surface-variant)",
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor =
								"var(--md-sys-color-surface-container)";
							e.currentTarget.style.color = "var(--md-sys-color-on-surface)";
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor = "transparent";
							e.currentTarget.style.color =
								"var(--md-sys-color-on-surface-variant)";
						}}
						activeProps={{
							className:
								"flex items-center gap-2 px-4 py-2 rounded-[var(--md-sys-shape-corner-large)] md-label-large",
							style: {
								backgroundColor: "var(--md-sys-color-secondary-container)",
								color: "var(--md-sys-color-on-secondary-container)",
							},
						}}
						activeOptions={{ exact: true }}
					>
						<Home size={18} />
						<span>Home</span>
					</Link>
					<Link
						to="/search"
						search={{ q: "", type: "all" }}
						className="flex items-center gap-2 px-4 py-2 rounded-(--md-sys-shape-corner-large) transition-colors md-label-large"
						style={{
							color: "var(--md-sys-color-on-surface-variant)",
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor =
								"var(--md-sys-color-surface-container)";
							e.currentTarget.style.color = "var(--md-sys-color-on-surface)";
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor = "transparent";
							e.currentTarget.style.color =
								"var(--md-sys-color-on-surface-variant)";
						}}
					>
						<Search size={18} />
						<span>Search</span>
					</Link>
					<div
						className="ml-4 pl-4"
						style={{
							borderLeft: "1px solid var(--md-sys-color-outline-variant)",
						}}
					>
						{isAuthLoading ? (
							<div
								className="w-8 h-8 rounded-full animate-pulse"
								style={{
									backgroundColor: "var(--md-sys-color-surface-container)",
								}}
							/>
						) : user ? (
							<div className="flex items-center gap-3">
								<Link
									to="/profile/shelf"
									className="flex items-center gap-3 rounded-(--md-sys-shape-corner-large) px-2 py-1.5 transition-colors"
									style={{
										color: "var(--md-sys-color-on-surface-variant)",
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.backgroundColor =
											"var(--md-sys-color-surface-container)";
										e.currentTarget.style.color =
											"var(--md-sys-color-on-surface)";
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.backgroundColor = "transparent";
										e.currentTarget.style.color =
											"var(--md-sys-color-on-surface-variant)";
									}}
								>
									{user.avatar ? (
										<img
											src={String(user.avatar)}
											alt={String(user.displayName || user.handle)}
											className="w-8 h-8 rounded-full"
										/>
									) : (
										<div
											className="w-8 h-8 rounded-full flex items-center justify-center"
											style={{
												backgroundColor: seedColor,
												color: "var(--md-sys-color-on-primary)",
											}}
										>
											<User size={16} />
										</div>
									)}
									<span className="md-body-medium">
										{user.displayName
											? String(user.displayName)
											: `@${user.handle}`}
									</span>
								</Link>
								<M3Button
									variant="text"
									size="icon-sm"
									onClick={handleLogout}
									disabled={logoutMutation.isPending}
									title="Sign out"
								>
									<LogOut size={16} />
								</M3Button>
							</div>
						) : (
							<M3Button variant="filled" onClick={handleLogin} size="sm">
								<LogIn size={16} />
								<span>Sign in</span>
							</M3Button>
						)}
					</div>
				</nav>
			</header>

			{isOpen && (
				<button
					type="button"
					className="fixed inset-0 z-40 md:hidden"
					style={{ backgroundColor: "var(--md-sys-color-scrim)" }}
					onClick={() => setIsOpen(false)}
					aria-label="Close menu overlay"
				/>
			)}

			<aside
				className={`fixed top-0 left-0 h-full w-72 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col md:hidden ${
					isOpen ? "translate-x-0" : "-translate-x-full"
				}`}
				style={{
					backgroundColor: "var(--md-sys-color-surface-container)",
					color: "var(--md-sys-color-on-surface)",
				}}
			>
				<div
					className="flex items-center justify-between p-4"
					style={{
						borderBottom: "1px solid var(--md-sys-color-outline-variant)",
					}}
				>
					<div className="flex items-center gap-2">
						<Film className="w-6 h-6" style={{ color: seedColor }} />
						<span className="md-title-medium">OpnShelf</span>
					</div>
					<M3Button
						variant="text"
						size="icon-sm"
						onClick={() => setIsOpen(false)}
						aria-label="Close menu"
					>
						<X size={24} />
					</M3Button>
				</div>

				<nav className="flex-1 p-4 overflow-y-auto">
					<Link
						to="/"
						onClick={() => setIsOpen(false)}
						className="flex items-center gap-3 p-3 rounded-(--md-sys-shape-corner-large) transition-colors mb-2 md-label-large"
						style={{
							color: "var(--md-sys-color-on-surface-variant)",
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor =
								"var(--md-sys-color-surface-container-highest)";
							e.currentTarget.style.color = "var(--md-sys-color-on-surface)";
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor = "transparent";
							e.currentTarget.style.color =
								"var(--md-sys-color-on-surface-variant)";
						}}
						activeProps={{
							className:
								"flex items-center gap-3 p-3 rounded-[var(--md-sys-shape-corner-large)] mb-2 md-label-large",
							style: {
								backgroundColor: "var(--md-sys-color-secondary-container)",
								color: "var(--md-sys-color-on-secondary-container)",
							},
						}}
						activeOptions={{ exact: true }}
					>
						<Home size={20} />
						<span>Home</span>
					</Link>

					<Link
						to="/search"
						search={{ q: "", type: "all" }}
						onClick={() => setIsOpen(false)}
						className="flex items-center gap-3 p-3 rounded-(--md-sys-shape-corner-large) transition-colors mb-2 md-label-large"
						style={{
							color: "var(--md-sys-color-on-surface-variant)",
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor =
								"var(--md-sys-color-surface-container-highest)";
							e.currentTarget.style.color = "var(--md-sys-color-on-surface)";
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor = "transparent";
							e.currentTarget.style.color =
								"var(--md-sys-color-on-surface-variant)";
						}}
					>
						<Search size={20} />
						<span>Search</span>
					</Link>
				</nav>

				<div
					className="p-4"
					style={{ borderTop: "1px solid var(--md-sys-color-outline-variant)" }}
				>
					{isAuthLoading ? (
						<div
							className="h-12 rounded-lg animate-pulse"
							style={{
								backgroundColor: "var(--md-sys-color-surface-container-high)",
							}}
						/>
					) : user ? (
						<div className="space-y-3">
							<Link
								to="/profile/shelf"
								onClick={() => setIsOpen(false)}
								className="flex items-center gap-3"
							>
								<div className="flex items-center gap-3">
									{user.avatar ? (
										<img
											src={String(user.avatar)}
											alt={String(user.displayName || user.handle)}
											className="w-10 h-10 rounded-full"
										/>
									) : (
										<div
											className="w-10 h-10 rounded-full flex items-center justify-center"
											style={{
												backgroundColor: seedColor,
												color: "var(--md-sys-color-on-primary)",
											}}
										>
											<User size={20} />
										</div>
									)}
									<div>
										<div className="md-body-large">
											{user.displayName
												? String(user.displayName)
												: user.handle}
										</div>
										<div
											className="md-body-small"
											style={{
												color: "var(--md-sys-color-on-surface-variant)",
											}}
										>
											@{user.handle}
										</div>
									</div>
								</div>
							</Link>
							<M3Button
								variant="outlined"
								onClick={() => {
									handleLogout();
									setIsOpen(false);
								}}
								disabled={logoutMutation.isPending}
								className="w-full"
							>
								<LogOut size={18} />
								<span>Sign out</span>
							</M3Button>
						</div>
					) : (
						<M3Button
							variant="filled"
							onClick={() => {
								handleLogin();
								setIsOpen(false);
							}}
							className="w-full"
						>
							<LogIn size={18} />
							<span>Sign in</span>
						</M3Button>
					)}
				</div>
			</aside>
		</>
	);
}
