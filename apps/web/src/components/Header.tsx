import { Link, useRouterState } from "@tanstack/react-router";
import {
	Calendar,
	Film,
	LogOut,
	Menu,
	Settings,
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
import { useSearchDialog } from "#/lib/search-dialog-context";
import SearchCommand from "./SearchCommand";
import ThemeToggle from "./ThemeToggle";

const navigation = [
	{ name: "Dashboard", href: "/dashboard", icon: Film },
	{ name: "Calendar", href: "/calendar", icon: Calendar },
	{ name: "Following", href: "/following", icon: Users },
];

export default function Header() {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [scrolled, setScrolled] = useState(false);
	const router = useRouterState();
	const currentPath = router.location.pathname;
	const { user, isAuthenticated, isLoading, logout } = useAuth();
	const { open: searchOpen, setOpen: setSearchOpen } = useSearchDialog();

	const visibleNavigation = isAuthenticated || isLoading ? navigation : [];

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
			<header className="sticky top-0 z-50 border-transparent border-b bg-(--background)">
				<div className="container-app">
					<nav className="flex h-16 items-center justify-between">
						<Link to="/" className="flex items-center gap-2">
							<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--accent) text-[#3f2e00]">
								<Film className="size-4" />
							</div>
							<span className="font-bold font-display text-lg tracking-tight">
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
					? "glass border-(--border-strong)"
					: "border-transparent bg-(--background)"
			}`}
		>
			<div className="container-app">
				<nav className="flex h-16 items-center justify-between gap-4">
					{/* Logo */}
					<div className="flex items-center gap-2">
						<Link to="/" className="flex items-center gap-2">
							<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--accent) text-[#3f2e00]">
								<Film className="size-4" />
							</div>
							<span className="font-bold font-display text-lg tracking-tight">
								OpnShelf
							</span>
						</Link>
					</div>

					{/* Desktop Navigation */}
					<div className="hidden items-center gap-1 md:flex">
						{visibleNavigation.map((item) => {
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
						<SearchCommand open={searchOpen} onOpenChange={setSearchOpen} />

						{/* Theme Toggle */}
						<ThemeToggle />

						{/* User Menu or Login Button */}
						{isLoading ? (
							<div className="h-9 w-9 animate-pulse rounded-full bg-(--background-subtle)" />
						) : isAuthenticated && user ? (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<button
										type="button"
										className="hidden h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-(--border) bg-(--background-elevated) transition-colors hover:border-(--border-strong) sm:flex"
										aria-label="User menu"
									>
										{user.avatar ? (
											<img
												src={user.avatar}
												alt={user.displayName || user.handle}
												className="h-full w-full object-cover"
											/>
										) : (
											<User className="size-4 text-(--foreground-muted)" />
										)}
									</button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-56">
									<div className="flex items-center gap-2 p-2">
										<div className="flex h-8 w-8 items-center justify-center rounded-full bg-(--accent-subtle)">
											{user.avatar ? (
												<img
													src={user.avatar}
													alt={user.displayName || user.handle}
													className="h-full w-full rounded-full object-cover"
												/>
											) : (
												<User className="size-4 text-(--accent)" />
											)}
										</div>
										<div className="flex flex-col">
											<span className="font-medium text-sm">
												{user.displayName || user.handle}
											</span>
											<span className="text-(--foreground-muted) text-xs">
												@{user.handle}
											</span>
										</div>
									</div>
									<DropdownMenuSeparator />
									<DropdownMenuItem asChild>
										<Link
											to="/profile/$handle"
											params={{ handle: user.handle }}
											className="cursor-pointer"
										>
											<User />
											Profile
										</Link>
									</DropdownMenuItem>
									<DropdownMenuItem asChild>
										<Link to="/settings" className="cursor-pointer">
											<Settings />
											Settings
										</Link>
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										onClick={logout}
										className="cursor-pointer text-red-600 focus:text-red-600"
									>
										<LogOut />
										Sign Out
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						) : (
							<Link
								to="/login"
								className="hidden items-center justify-center rounded-md bg-(--accent) px-4 py-2 font-medium text-(--accent-foreground) text-sm transition-colors hover:bg-(--accent-hover) sm:flex"
							>
								Sign In
							</Link>
						)}

						{/* Mobile menu button - only visible on small screens */}
						<button
							type="button"
							className="flex h-9 w-9 items-center justify-center rounded-md border border-(--border) bg-(--background-elevated) text-(--foreground-muted) transition-colors hover:bg-(--background-subtle) hover:text-(--foreground) md:hidden"
							onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
							aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
							aria-expanded={mobileMenuOpen}
						>
							{mobileMenuOpen ? (
								<X className="size-5" />
							) : (
								<Menu className="h-5 w-5" />
							)}
						</button>
					</div>
				</nav>

				{/* Mobile Navigation - Overlay */}
				{mobileMenuOpen && (
					<div className="fixed inset-x-0 top-16 z-40 h-[calc(100vh-4rem)] border-(--border) border-t bg-(--background) md:hidden">
						<div className="container-app h-full overflow-y-auto py-4">
							<div className="flex flex-col gap-1">
								{visibleNavigation.map((item) => {
									const isActive =
										currentPath === item.href ||
										(item.href !== "/" && currentPath.startsWith(item.href));
									const Icon = item.icon;
									return (
										<Link
											key={item.name}
											to={item.href}
											onClick={() => setMobileMenuOpen(false)}
											className={`flex items-center gap-3 rounded-md px-3 py-3 font-medium text-sm transition-colors ${
												isActive
													? "bg-(--accent-subtle) text-(--accent)"
													: "text-(--foreground-muted) hover:bg-(--background-subtle) hover:text-(--foreground)"
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
										<div className="my-2 border-(--border) border-t" />
										<div className="flex items-center gap-3 px-3 py-3">
											<div className="flex h-8 w-8 items-center justify-center rounded-full bg-(--accent-subtle)">
												{user.avatar ? (
													<img
														src={user.avatar}
														alt={user.displayName || user.handle}
														className="h-full w-full rounded-full object-cover"
													/>
												) : (
													<User className="size-4 text-(--accent)" />
												)}
											</div>
											<div className="flex flex-col">
												<span className="font-medium text-sm">
													{user.displayName || user.handle}
												</span>
												<span className="text-(--foreground-muted) text-xs">
													@{user.handle}
												</span>
											</div>
										</div>
										<button
											type="button"
											onClick={logout}
											className="flex items-center gap-3 rounded-md px-3 py-3 font-medium text-red-600 text-sm transition-colors hover:bg-red-50"
										>
											<LogOut className="size-5" />
											Sign Out
										</button>
									</>
								)}

								{!isAuthenticated && (
									<>
										<div className="my-2 border-(--border) border-t" />
										<Link
											to="/login"
											onClick={() => setMobileMenuOpen(false)}
											className="flex items-center gap-3 rounded-md bg-(--accent) px-3 py-3 font-medium text-(--accent-foreground) text-sm"
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
