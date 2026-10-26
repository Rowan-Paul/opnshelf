import type { UserDto } from "@opnshelf/api";
import { Link } from "@tanstack/react-router";
import { LogOut, Newspaper, Settings } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { UserAvatar } from "./following/UserAvatar";
import type { ProfileNavigation } from "./Header";
import { UnreadDot } from "./release-notes/UnreadDot";
import { UserMenuButton } from "./UserMenuButton";

interface UserMenuProps {
	user: UserDto;
	unread: boolean;
	logout: () => void;
	profileNavigation: ProfileNavigation;
}

/** Mounted by the header's first press on the avatar, so it starts open. */
export default function UserMenu({
	user,
	unread,
	logout,
	profileNavigation,
}: UserMenuProps) {
	return (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger asChild>
				<UserMenuButton user={user} unread={unread} />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				<DropdownMenuItem asChild>
					<Link
						to="/profile/$handle"
						params={{ handle: user.handle }}
						className="flex cursor-pointer items-center gap-2 p-2"
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
							<span className="text-xs opacity-60">@{user.handle}</span>
						</div>
					</Link>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				{profileNavigation.map(({ name, to, icon: Icon }) => (
					<DropdownMenuItem key={name} asChild>
						<Link
							to={to}
							params={{ handle: user.handle }}
							className="cursor-pointer"
						>
							<Icon />
							{name}
						</Link>
					</DropdownMenuItem>
				))}
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link to="/whats-new" className="cursor-pointer">
						<Newspaper />
						What’s new {unread && <UnreadDot />}
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
					className="cursor-pointer text-destructive focus:text-destructive"
				>
					<LogOut className="text-current" />
					Sign Out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
