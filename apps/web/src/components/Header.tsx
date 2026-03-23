import { authControllerLogoutMutation, type UserDto } from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
	BookOpen,
	CalendarDays,
	ChevronDown,
	Home,
	List,
	LogIn,
	LogOut,
	Search,
	Settings,
	Tv,
	User,
} from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { M3Button } from "@/components/ui/m3-button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
	type GlobalNavItem,
	getCalendarRoute,
	getHomeRoute,
	getListsRoute,
	getMyShelfRoute,
	getSearchRoute,
	getSettingsRoute,
	getSignedInPrimaryNav,
	getSignedOutPrimaryNav,
	getUpNextRoute,
	isGlobalNavItemActive,
} from "@/lib/web-navigation";

interface HeaderProps {
	user: UserDto | null | undefined;
	isAuthLoading: boolean;
}

type NavLinkTarget =
	| ReturnType<typeof getHomeRoute>
	| ReturnType<typeof getSearchRoute>
	| ReturnType<typeof getMyShelfRoute>
	| ReturnType<typeof getUpNextRoute>
	| ReturnType<typeof getListsRoute>
	| ReturnType<typeof getCalendarRoute>
	| ReturnType<typeof getSettingsRoute>;

const navIcons = {
	home: Home,
	search: Search,
	"my-shelf": BookOpen,
} satisfies Record<GlobalNavItem["id"], typeof Home>;

export default function Header({ user, isAuthLoading }: HeaderProps) {
	const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const location = useLocation();
	const { seedColor } = useTheme();

	const primaryNav = user ? getSignedInPrimaryNav() : getSignedOutPrimaryNav();
	const logoutMutation = useMutation({
		mutationKey: ["auth", "logout"],
		...authControllerLogoutMutation(),
		onSuccess: () => {
			queryClient.clear();
			navigate({ to: "/" });
		},
	});

	const handleLogout = async () => {
		setIsAccountMenuOpen(false);
		await logoutMutation.mutateAsync({});
	};

	return (
		<header
			className="sticky top-0 z-40 border-b"
			style={{
				backgroundColor: "var(--md-sys-color-surface)",
				borderColor: "var(--md-sys-color-outline-variant)",
				boxShadow:
					"0 18px 40px rgba(0, 0, 0, 0.28), inset 0 -1px 0 rgba(255, 255, 255, 0.02)",
			}}
		>
			<div
				className="absolute inset-x-0 top-0 h-px"
				style={{
					background: `linear-gradient(90deg, transparent, ${seedColor}, transparent)`,
					opacity: 0.45,
				}}
			/>

			<div className="container mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 md:h-[4.5rem]">
				<Brand seedColor={seedColor} />

				<nav className="hidden min-w-0 flex-1 items-center justify-center gap-2 md:flex">
					{primaryNav.map((item) => (
						<PrimaryNavLink
							key={item.id}
							item={item}
							currentPath={location.pathname}
							currentUserHandle={user?.handle}
							seedColor={seedColor}
						/>
					))}
				</nav>

				<div className="flex items-center gap-2">
					{isAuthLoading ? (
						<AuthActionsSkeleton />
					) : user ? (
						<AccountMenu
							user={user}
							seedColor={seedColor}
							isOpen={isAccountMenuOpen}
							onOpenChange={setIsAccountMenuOpen}
							onLogout={handleLogout}
							isLoggingOut={logoutMutation.isPending}
						/>
					) : (
						<SignedOutActions />
					)}
				</div>
			</div>
		</header>
	);
}

function Brand({ seedColor }: { seedColor: string }) {
	return (
		<Link to="/" className="group flex items-center gap-3">
			<div
				className="flex size-10 items-center justify-center rounded-[18px] border transition-transform duration-300 group-hover:scale-[1.04]"
				style={{
					backgroundColor: "var(--md-sys-color-surface-container-high)",
					borderColor: "var(--md-sys-color-outline-variant)",
					boxShadow: `0 0 0 1px ${seedColor}24 inset`,
				}}
			>
				<img src="/icon.png" alt="OpnShelf" className="size-7 rounded-xl" />
			</div>

			<div className="min-w-0">
				<div className="md-title-large leading-none">OpnShelf</div>
			</div>
		</Link>
	);
}

function SignedOutActions() {
	return (
		<>
			<Link
				{...getSearchRoute()}
				className="inline-flex size-10 items-center justify-center rounded-full border transition-colors md:hidden"
				style={{
					backgroundColor: "var(--md-sys-color-surface-container)",
					borderColor: "var(--md-sys-color-outline-variant)",
					color: "var(--md-sys-color-on-surface)",
				}}
				aria-label="Search"
			>
				<Search className="size-4" />
			</Link>

			<M3Button
				variant="filled"
				size="sm"
				asChild
				className="rounded-full px-4"
			>
				<Link to="/login">
					<LogIn className="size-4" />
					<span className="hidden sm:inline">Sign in</span>
				</Link>
			</M3Button>
		</>
	);
}

function AuthActionsSkeleton() {
	return (
		<div className="flex items-center gap-2">
			<div
				className="hidden h-10 w-28 animate-pulse rounded-full md:block"
				style={{
					backgroundColor: "var(--md-sys-color-surface-container-high)",
				}}
			/>
			<div
				className="size-10 animate-pulse rounded-full"
				style={{
					backgroundColor: "var(--md-sys-color-surface-container-high)",
				}}
			/>
		</div>
	);
}

function PrimaryNavLink({
	item,
	currentPath,
	currentUserHandle,
	seedColor,
}: {
	item: GlobalNavItem;
	currentPath: string;
	currentUserHandle?: string;
	seedColor: string;
}) {
	const Icon = navIcons[item.id];
	const isActive = isGlobalNavItemActive(
		item.id,
		currentPath,
		currentUserHandle,
	);
	const target = getNavTarget(item.id, currentUserHandle);

	if (!target) {
		return null;
	}

	return (
		<Link
			{...target}
			className={cn(
				"inline-flex items-center gap-2 rounded-full border px-4 py-2 transition-all duration-200",
				"hover:-translate-y-0.5 hover:bg-[var(--md-sys-color-surface-container-high)] hover:text-[var(--md-sys-color-on-surface)]",
			)}
			style={
				isActive
					? {
							backgroundColor: `${seedColor}22`,
							borderColor: `${seedColor}55`,
							color: seedColor,
							boxShadow: `0 10px 24px ${seedColor}14`,
						}
					: {
							backgroundColor: "var(--md-sys-color-surface-container-low)",
							borderColor: "var(--md-sys-color-outline-variant)",
							color: "var(--md-sys-color-on-surface-variant)",
						}
			}
		>
			<Icon className="size-4" />
			<span className="md-label-large">{item.label}</span>
		</Link>
	);
}

function AccountMenu({
	user,
	seedColor,
	isOpen,
	onOpenChange,
	onLogout,
	isLoggingOut,
}: {
	user: UserDto;
	seedColor: string;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onLogout: () => Promise<void>;
	isLoggingOut: boolean;
}) {
	const displayName = user.displayName
		? String(user.displayName)
		: `@${user.handle}`;
	const avatar = user.avatar ? String(user.avatar) : null;

	return (
		<Popover open={isOpen} onOpenChange={onOpenChange}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="inline-flex size-10 items-center justify-center rounded-full border transition-transform duration-200 hover:scale-[1.02] md:size-auto md:gap-2 md:px-2.5"
					style={{
						backgroundColor: "var(--md-sys-color-surface-container)",
						borderColor: "var(--md-sys-color-outline-variant)",
						color: "var(--md-sys-color-on-surface)",
					}}
					aria-label="Open account menu"
				>
					<Avatar user={user} seedColor={seedColor} className="size-8" />
					<ChevronDown className="hidden size-4 md:block" />
				</button>
			</PopoverTrigger>

			<PopoverContent
				align="end"
				sideOffset={10}
				className="w-[20rem] rounded-[24px] border p-2"
				style={{
					backgroundColor: "var(--md-sys-color-surface-container-high)",
					borderColor: "var(--md-sys-color-outline-variant)",
				}}
			>
				<div
					className="mb-2 flex items-center gap-3 rounded-[18px] border px-3 py-3"
					style={{
						backgroundColor: "var(--md-sys-color-surface-container-low)",
						borderColor: "var(--md-sys-color-outline-variant)",
					}}
				>
					{avatar ? (
						<img
							src={avatar}
							alt={displayName}
							className="size-11 rounded-full object-cover"
						/>
					) : (
						<Avatar user={user} seedColor={seedColor} className="size-11" />
					)}
					<div className="min-w-0">
						<p className="truncate md-title-medium">{displayName}</p>
						<p
							className="truncate md-body-small"
							style={{ color: "var(--md-sys-color-on-surface-variant)" }}
						>
							@{user.handle}
						</p>
					</div>
				</div>

				<div className="space-y-1">
					<MenuLink
						target={getMyShelfRoute(user.handle)}
						icon={User}
						label="My Profile"
						onSelect={() => onOpenChange(false)}
					/>
					<MenuLink
						target={getUpNextRoute(user.handle)}
						icon={Tv}
						label="Up Next"
						onSelect={() => onOpenChange(false)}
					/>
					<MenuLink
						target={getListsRoute(user.handle)}
						icon={List}
						label="Lists"
						onSelect={() => onOpenChange(false)}
					/>
					<MenuLink
						target={getCalendarRoute(user.handle)}
						icon={CalendarDays}
						label="Calendar"
						onSelect={() => onOpenChange(false)}
					/>
					<MenuLink
						target={getSettingsRoute(user.handle)}
						icon={Settings}
						label="Settings"
						onSelect={() => onOpenChange(false)}
					/>
					<button
						type="button"
						onClick={onLogout}
						disabled={isLoggingOut}
						className="flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-left transition-colors hover:bg-[var(--md-sys-color-surface-container-low)] disabled:opacity-60"
						style={{ color: "var(--md-sys-color-on-surface)" }}
					>
						<LogOut className="size-4" />
						<span className="md-label-large">Sign out</span>
					</button>
				</div>
			</PopoverContent>
		</Popover>
	);
}

function MenuLink({
	target,
	icon: Icon,
	label,
	onSelect,
}: {
	target: NavLinkTarget;
	icon: typeof User;
	label: string;
	onSelect: () => void;
}) {
	return (
		<Link
			{...target}
			onClick={onSelect}
			className="flex items-center gap-3 rounded-[18px] px-3 py-3 transition-colors hover:bg-[var(--md-sys-color-surface-container-low)]"
			style={{ color: "var(--md-sys-color-on-surface)" }}
		>
			<Icon className="size-4" />
			<span className="md-label-large">{label}</span>
		</Link>
	);
}

function Avatar({
	user,
	seedColor,
	className,
}: {
	user: UserDto;
	seedColor: string;
	className?: string;
}) {
	if (user.avatar) {
		return (
			<img
				src={String(user.avatar)}
				alt={user.displayName ? String(user.displayName) : user.handle}
				className={cn("rounded-full object-cover", className)}
			/>
		);
	}

	return (
		<div
			className={cn(
				"flex items-center justify-center rounded-full text-(--md-sys-color-on-primary)",
				className,
			)}
			style={{ backgroundColor: seedColor }}
		>
			{user.displayName ? (
				<span className="text-sm font-bold uppercase">
					{String(user.displayName).charAt(0)}
				</span>
			) : (
				<User className="size-4" />
			)}
		</div>
	);
}

function getNavTarget(
	itemId: GlobalNavItem["id"],
	currentUserHandle?: string,
): NavLinkTarget | null {
	switch (itemId) {
		case "home":
			return getHomeRoute();
		case "search":
			return getSearchRoute();
		case "my-shelf":
			return currentUserHandle ? getMyShelfRoute(currentUserHandle) : null;
	}
}
