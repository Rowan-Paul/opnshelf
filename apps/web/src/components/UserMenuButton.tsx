import type { UserDto } from "@opnshelf/api";
import type { ComponentProps } from "react";
import { UserAvatar } from "./following/UserAvatar";
import { UnreadDot } from "./release-notes/UnreadDot";

interface UserMenuButtonProps extends ComponentProps<"button"> {
	user: UserDto;
	unread: boolean;
}

/**
 * The avatar that opens the user menu. Also stands in for the menu while its
 * chunk loads, so the header keeps its shape.
 */
export function UserMenuButton({
	user,
	unread,
	...props
}: UserMenuButtonProps) {
	return (
		<button
			type="button"
			className="relative hidden h-9 w-9 items-center justify-center rounded-full border border-(--border) bg-(--background-elevated) transition-colors hover:border-(--border-strong) sm:flex"
			aria-label={unread ? "User menu, unread release notes" : "User menu"}
			{...props}
		>
			{unread && (
				<span className="absolute top-0 right-0 z-10">
					<UnreadDot />
				</span>
			)}
			<UserAvatar
				src={user.avatar}
				alt={user.displayName || user.handle}
				className="h-full w-full rounded-full"
			/>
		</button>
	);
}
