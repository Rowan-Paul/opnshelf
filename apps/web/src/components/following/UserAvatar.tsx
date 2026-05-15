import { User } from "lucide-react";
import { useState } from "react";

interface UserAvatarProps {
	src?: unknown;
	alt: string;
	size?: "sm" | "md" | "lg" | "xl";
	/** Override sizing entirely — use when the parent container controls the size (e.g. overflow-hidden button). Should include dimensions and rounded-full. */
	className?: string;
}

const sizeClasses = {
	sm: "h-8 w-8",
	md: "h-10 w-10",
	lg: "h-12 w-12",
	xl: "h-20 w-20",
};

const iconSizes = {
	sm: "h-3.5 w-3.5",
	md: "h-4 w-4",
	lg: "h-5 w-5",
	xl: "h-8 w-8",
};

export function UserAvatar({
	src,
	alt,
	size = "md",
	className,
}: UserAvatarProps) {
	const [failed, setFailed] = useState(false);
	const srcStr = typeof src === "string" && !failed ? src : null;
	const sizeClass = className ?? `${sizeClasses[size]} rounded-full`;

	if (srcStr) {
		return (
			<img
				src={srcStr}
				alt={alt}
				className={`${sizeClass} object-cover`}
				onError={() => setFailed(true)}
			/>
		);
	}

	return (
		<div
			className={`${sizeClass} flex items-center justify-center bg-(--accent-subtle)`}
		>
			<User
				className={`${className ? "h-1/3 w-1/3" : iconSizes[size]} text-(--accent)`}
			/>
		</div>
	);
}
