import {
	getOptionalString,
	getSocialDisplayName,
} from "@/components/social/social-display";
import { useTheme } from "@/components/theme-provider";

export function SocialUserAvatar({
	avatar,
	displayName,
	handle,
	className = "size-14",
}: {
	avatar: unknown;
	displayName: unknown;
	handle: string;
	className?: string;
}) {
	const { seedColor } = useTheme();
	const avatarUrl = getOptionalString(avatar);
	const resolvedName = getSocialDisplayName(displayName, handle);

	if (avatarUrl) {
		return (
			<img
				src={avatarUrl}
				alt={resolvedName}
				className={`${className} rounded-full object-cover`}
			/>
		);
	}

	return (
		<div
			className={`${className} flex items-center justify-center rounded-full text-lg font-bold uppercase text-(--md-sys-color-on-primary)`}
			style={{ backgroundColor: seedColor }}
		>
			{resolvedName.charAt(0) || "?"}
		</div>
	);
}
