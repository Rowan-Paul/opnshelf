import { User } from "lucide-react";

interface UserAvatarProps {
	src?: unknown;
	alt: string;
	size?: "sm" | "md" | "lg";
}

const sizeClasses = {
	sm: "h-8 w-8",
	md: "h-10 w-10",
	lg: "h-12 w-12",
};

const iconSizes = {
	sm: "h-3.5 w-3.5",
	md: "h-4 w-4",
	lg: "h-5 w-5",
};

export function UserAvatar({ src, alt, size = "md" }: UserAvatarProps) {
	const srcStr = typeof src === "string" ? src : null;
	if (srcStr) {
		return (
			<img
				src={srcStr}
				alt={alt}
				className={`${sizeClasses[size]} rounded-full object-cover`}
			/>
		);
	}

	return (
		<div
			className={`${sizeClasses[size]} flex items-center justify-center rounded-full bg-(--accent-subtle)`}
		>
			<User className={`${iconSizes[size]} text-(--accent)`} />
		</div>
	);
}
