import { Link, useRouterState } from "@tanstack/react-router";
import {
	Calendar,
	Film,
	List,
	LogOut,
	Menu,
	User,
	Users,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { useAuth } from "#/lib/auth-context";
import SearchCommand from "./SearchCommand";
import ThemeToggle from "./ThemeToggle";

const navigation = [
	{ name: "Dashboard", href: "/dashboard", icon: Film },
	{ name: "Calendar", href: "/calendar", icon: Calendar },
	{ name: "Following", href: "/following", icon: Users },
	{ name: "Lists", href: "/lists", icon: List },
];

export default function Header() {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [scrolled, setScrolled] = useState(false);
	const router = useRouterState();
	const currentPath = router.location.pathname;
	const { user, isAuthenticated, isLoading, logout } = useAuth();

	useEffect(() => {
		const handleScroll = () => {
			setScrolled(window.scrollY > 10);
		};
		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	// Close mobile menu on route change
	useEffect(() => {
		setMobileMenuOpen(false);
	}, []);

	// Don't show navigation on login page
	if (currentPath === "/login") {
		return (
			<header className="sticky top-0 z-50 border-b border-transparent bg-[var(--background)]">
				<div className="container-app">
					<nav className="flex h-16 items-center justify-between">
						<Link to="/" className="flex items-center gap-2">
							<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-white">
								<Film className="h-4 w-4" />
							</div>
							<span className="font-display text-lg font-bold tracking-tight">
								OpnShelf
							</span>
						</Link>
					</nav>
				</div>
			</header>
		);
	}

	return (
		<header
			className={`sticky top-0 z-50 border-b transition-all duration-200 ${
				scrolled
					? "border-[var(--border-strong)] glass"
					: "border-transparent bg-[var(--background)]"
			}`}
		>
			<div className="container-app">
				<nav className="flex h-16 items-center justify-between gap-4">
					{/* Logo */}
					<div className="flex items-center gap-2">
						<Link to="/" className="flex items-center gap-2">
							<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-white">
								<Film className="h-4 w-4" />
							</div>
							<span className="font-display text-lg font-bold tracking-tight">
								OpnShelf
							</span>
						</Link>
					</div>

					{/* Desktop Navigation */}
					<div className="hidden items-center gap-1 md:flex">
						{navigation.map((item) => {
							const isActive =
								currentPath === item.href ||
								(item.href !== "/" && currentPath.startsWith(item.href));
							const Icon = item.icon;
							return (
								<Link
									key={item.name}
									to={item.href}
									data-active={isActive}
									className="nav-link flex items-center gap-2 rounded-md px-3 py-2"
								>
									<Icon className="h-4 w-4" />
									<span>{item.name}</span>
								</Link>
							);
						})}
					</div>

					{/* Right side actions */}
					<div className="flex items-center gap-2">
						{/* Search */}
						<SearchCommand />

						{/* Theme Toggle */}
						<ThemeToggle />

						{/* User Menu or Login Button */}
						{isLoading ? (
							<div className="h-9 w-9 animate-pulse rounded-full bg-[var(--background-subtle)]" />
						) : isAuthenticated && user ? (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<button
										type="button"
										className="hidden h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--background-elevated)] hover:border-[var(--border-strong)] transition-colors sm:flex"
										aria-label="User menu"
									>
										{user.avatar ? (
											<img
												src={user.avatar}
												alt={user.displayName || user.handle}
												className="h-full w-full object-cover"
											/>
										) : (
											<User className="h-4 w-4 text-[var(--foreground-muted)]" />
										)}
									</button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-56">
									<div className="flex items-center gap-2 p-2">
										<div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-subtle)]">
											{user.avatar ? (
												<img
													src={user.avatar}
													alt={user.displayName || user.handle}
													className="h-full w-full rounded-full object-cover"
												/>
											) : (
												<User className="h-4 w-4 text-[var(--accent)]" />
											)}
										</div>
										<div className="flex flex-col">
											<span className="text-sm font-medium">
												{user.displayName || user.handle}
											</span>
											<span className="text-xs text-[var(--foreground-muted)]">
												@{user.handle}
											</span>
										</div>
									</div>
									<DropdownMenuSeparator />
									<DropdownMenuItem asChild>
										<Link to="/settings" className="cursor-pointer">
											<User className="mr-2 h-4 w-4" />
											Profile & Settings
										</Link>
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										onClick={logout}
										className="cursor-pointer text-red-600 focus:text-red-600"
									>
										<LogOut className="mr-2 h-4 w-4" />
										Sign Out
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						) : (
							<Link
								to="/login"
								className="hidden items-center justify-center rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)] sm:flex"
							>
								Sign In
							</Link>
						)}

						{/* Mobile menu button - only visible on small screens */}
						<button
							type="button"
							className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--background-elevated)] text-[var(--foreground-muted)] transition-colors hover:bg-[var(--background-subtle)] hover:text-[var(--foreground)] md:hidden"
							onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
							aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
							aria-expanded={mobileMenuOpen}
						>
							{mobileMenuOpen ? (
								<X className="h-5 w-5" />
							) : (
								<Menu className="h-5 w-5" />
							)}
						</button>
					</div>
				</nav>

				{/* Mobile Navigation - Overlay */}
				{mobileMenuOpen && (
					<div className="fixed inset-x-0 top-16 z-40 h-[calc(100vh-4rem)] border-t border-[var(--border)] bg-[var(--background)] md:hidden">
						<div className="container-app h-full overflow-y-auto py-4">
							<div className="flex flex-col gap-1">
								{navigation.map((item) => {
									const isActive =
										currentPath === item.href ||
										(item.href !== "/" && currentPath.startsWith(item.href));
									const Icon = item.icon;
									return (
										<Link
											key={item.name}
											to={item.href}
											className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors ${
												isActive
													? "bg-[var(--accent-subtle)] text-[var(--accent)]"
													: "text-[var(--foreground-muted)] hover:bg-[var(--background-subtle)] hover:text-[var(--foreground)]"
											}`}
										>
											<Icon className="h-5 w-5" />
											{item.name}
										</Link>
									);
								})}

								{/* Mobile user section */}
								{isAuthenticated && user && (
									<>
										<div className="my-2 border-t border-[var(--border)]" />
										<div className="flex items-center gap-3 px-3 py-3">
											<div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-subtle)]">
												{user.avatar ? (
													<img
														src={user.avatar}
														alt={user.displayName || user.handle}
														className="h-full w-full rounded-full object-cover"
													/>
												) : (
													<User className="h-4 w-4 text-[var(--accent)]" />
												)}
											</div>
											<div className="flex flex-col">
												<span className="text-sm font-medium">
													{user.displayName || user.handle}
												</span>
												<span className="text-xs text-[var(--foreground-muted)]">
													@{user.handle}
												</span>
											</div>
										</div>
										<button
											type="button"
											onClick={logout}
											className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
										>
											<LogOut className="h-5 w-5" />
											Sign Out
										</button>
									</>
								)}

								{!isAuthenticated && (
									<>
										<div className="my-2 border-t border-[var(--border)]" />
										<Link
											to="/login"
											className="flex items-center gap-3 rounded-md bg-[var(--accent)] px-3 py-3 text-sm font-medium text-white"
										>
											Sign In
										</Link>
									</>
								)}
							</div>
						</div>
					</div>
				)}
			</div>
		</header>
	);
}
