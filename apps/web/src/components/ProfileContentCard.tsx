import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

type ProfileContentCardProps = {
	posterUrl?: string | null;
	to: string;
	params?: Record<string, string | undefined>;
	hash?: string;
	title: string;
	/** Full-width metadata row rendered directly under the title (e.g. a date). */
	meta?: ReactNode;
	headerRight?: ReactNode;
	children: ReactNode;
};

export function ProfileContentCard({
	posterUrl,
	to,
	params,
	hash,
	title,
	meta,
	headerRight,
	children,
}: ProfileContentCardProps) {
	return (
		<article className="card relative flex gap-4 p-4 transition-shadow hover:shadow-md sm:p-5">
			{/* Poster */}
			<div className="shrink-0">
				{posterUrl ? (
					<img
						src={posterUrl}
						alt={title}
						className="h-28 w-20 rounded-lg object-cover sm:h-36 sm:w-24"
					/>
				) : (
					<div className="h-28 w-20 rounded-lg bg-(--background-subtle) sm:h-36 sm:w-24" />
				)}
			</div>

			{/* Content */}
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				{/* Header */}
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0 flex-1">
						<Link
							to={to}
							params={params}
							hash={hash}
							className="relative z-[1] line-clamp-2 font-medium text-sm hover:text-(--accent)"
						>
							{title}
						</Link>
						{meta && (
							<div className="mt-0.5 text-(--foreground-muted) text-xs">
								{meta}
							</div>
						)}
					</div>

					{headerRight && (
						<div className="relative z-[1] shrink-0">{headerRight}</div>
					)}
				</div>

				{children}
			</div>

			{/* Full-card overlay link for click-anywhere navigation */}
			<Link
				to={to}
				params={params}
				hash={hash}
				className="absolute inset-0 rounded-[inherit]"
				aria-hidden
				tabIndex={-1}
			/>
		</article>
	);
}
