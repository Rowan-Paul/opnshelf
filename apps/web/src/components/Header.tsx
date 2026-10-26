import { Link, useRouterState } from "@tanstack/react-router";
import {
	Clock,
	Compass,
	Disc,
	Film,
	Home,
	List,
	LogOut,
	Menu,
	Newspaper,
	Settings,
	Star,
	StickyNote,
	User,
	Users,
	X,
} from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { useAuth } from "#/lib/auth-context";
import { useSearchDialog } from "#/lib/search-dialog-context";
import { useReleaseNotes } from "#/lib/use-release-notes";
import { UserAvatar } from "./following/UserAvatar";
import Logo from "./Logo";
import { UnreadDot } from "./release-notes/UnreadDot";
import SearchCommand from "./SearchCommand";
import ThemeToggle from "./ThemeToggle";
import { UserMenuButton } from "./UserMenuButton";

// Radix's menu and positioning code load on intent rather than on every page:
// hover or focus prefetches, the first press mounts the menu already open.
const loadUserMenu = () => import("./UserMenu");
const UserMenu = lazy(loadUserMenu);

const profileNavigation = [
	{ name: "Shelf", to: "/profile/$handle/shelf", icon: Film },
	{ name: "Up Next", to: "/profile/$handle/up-next", icon: Clock },
	{ name: "Lists", to: "/profile/$handle/lists", icon: List },
	{ name: "Library", to: "/profile/$handle/library", icon: Disc },
	{ name: "Notes", to: "/profile/$handle/notes", icon: StickyNote },
	{ name: "Reviews", to: "/profile/$handle/reviews", icon: Star },
] as const;

export type ProfileNavigation = typeof profileNavigation;

export default function Header() {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [scrolled, setScrolled] = useState(false);
	const [menuWanted, setMenuWanted] = useState(false);
	const router = useRouterState();
	const currentPath = router.location.pathname;
	const { user, isAuthenticated, isLoading, logout } = useAuth();
	const { unread } = useReleaseNotes({ enabled: Boolean(user) });
	const { open: searchOpen, setOpen: setSearchOpen } = useSearchDialog();

	const navigation = [
		{ name: "Home", href: "/", icon: Home },
		{ name: "Discover", href: "/search", icon: Compass },
		{ name: "Social", href: "/social", icon: Users },
	];

	const visibleNavigation =
		isAuthenticated || isLoading
			? [
					...navigation,
					...(user
						? [{ name: "Profile", href: `/profile/${user.handle}`, icon: User }]
						: []),
				]
			: [];

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

	// Don't show navigation on login or onboarding pages
	if (currentPath === "/login" || currentPath === "/onboarding") {
		return (
			<header className="sticky top-0 z-50 border-transparent border-b bg-(--background)">
				<div className="container-app">
					<nav className="flex h-16 items-center justify-between">
						<Link to="/" className="flex items-center gap-2">
							<Logo className="size-8 rounded-lg" />
							<span className="font-bold font-display text-lg tracking-tight">
								Opnshelf
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
							<Logo className="size-8 rounded-lg" />
							<span className="font-bold font-display text-lg tracking-tight">
								Opnshelf
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
							<div className="hidden h-9 w-9 animate-pulse rounded-full bg-(--background-subtle) sm:block" />
						) : isAuthenticated && user ? (
							menuWanted ? (
								<Suspense
									fallback={<UserMenuButton user={user} unread={unread} />}
								>
									<UserMenu
										user={user}
										unread={unread}
										logout={logout}
										profileNavigation={profileNavigation}
									/>
								</Suspense>
							) : (
								<UserMenuButton
									user={user}
									unread={unread}
									onPointerEnter={loadUserMenu}
									onFocus={loadUserMenu}
									onClick={() => setMenuWanted(true)}
								/>
							)
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
							aria-label={`${mobileMenuOpen ? "Close menu" : "Open menu"}${unread ? ", unread release notes" : ""}`}
							aria-expanded={mobileMenuOpen}
						>
							{unread && <UnreadDot />}
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
										<div className="my-2 h-px bg-(--border)" />
										{profileNavigation.map(({ name, to, icon: Icon }) => {
											const href = to.replace("$handle", user.handle);
											const isActive = currentPath.startsWith(href);
											return (
												<Link
													key={name}
													to={to}
													params={{ handle: user.handle }}
													onClick={() => setMobileMenuOpen(false)}
													className={`flex items-center gap-3 rounded-md px-3 py-3 font-medium text-sm transition-colors ${
														isActive
															? "bg-(--accent-subtle) text-(--accent)"
															: "text-(--foreground-muted) hover:bg-(--background-subtle) hover:text-(--foreground)"
													}`}
												>
													<Icon className="h-5 w-5" />
													{name}
												</Link>
											);
										})}
										<Link
											to="/whats-new"
											onClick={() => setMobileMenuOpen(false)}
											className={`flex items-center gap-3 rounded-md px-3 py-3 font-medium text-sm transition-colors ${
												currentPath === "/whats-new" ||
												currentPath.startsWith("/whats-new/")
													? "bg-(--accent-subtle) text-(--accent)"
													: "text-(--foreground-muted) hover:bg-(--background-subtle) hover:text-(--foreground)"
											}`}
										>
											<Newspaper className="size-5" />
											What’s new {unread && <UnreadDot />}
										</Link>
										<Link
											to="/settings"
											onClick={() => setMobileMenuOpen(false)}
											className={`flex items-center gap-3 rounded-md px-3 py-3 font-medium text-sm transition-colors ${
												currentPath === "/settings"
													? "bg-(--accent-subtle) text-(--accent)"
													: "text-(--foreground-muted) hover:bg-(--background-subtle) hover:text-(--foreground)"
											}`}
										>
											<Settings className="h-5 w-5" />
											Settings
										</Link>
										<div className="my-2 h-px bg-(--border)" />
										<Link
											to="/profile/$handle"
											params={{ handle: user.handle }}
											onClick={() => setMobileMenuOpen(false)}
											className="flex items-center gap-3 px-3 py-3"
										>
											<UserAvatar
												src={user.avatar}
												alt={user.displayName || user.handle}
												size="sm"
											/>
											<div className="flex flex-col">
												<span className="font-medium text-sm">
													{user.displayName || user.handle}
												</span>
												<span className="text-xs opacity-60">
													@{user.handle}
												</span>
											</div>
										</Link>
										<button
											type="button"
											onClick={logout}
											className="flex items-center gap-3 rounded-md px-3 py-3 font-medium text-destructive text-sm transition-colors hover:bg-red-50"
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
