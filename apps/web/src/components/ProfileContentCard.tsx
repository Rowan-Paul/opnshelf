import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

type ProfileContentCardProps = {
	posterUrl?: string | null;
	to: string;
	params?: Record<string, string | undefined>;
	title: string;
	headerRight?: ReactNode;
	children: ReactNode;
};

export function ProfileContentCard({
	posterUrl,
	to,
	params,
	title,
	headerRight,
	children,
}: ProfileContentCardProps) {
	return (
		<article className="card flex gap-4 p-4 transition-shadow hover:shadow-md sm:p-5">
			{/* Poster */}
			{posterUrl ? (
				<div className="shrink-0">
					<Link to={to} params={params}>
						<img
							src={posterUrl}
							alt={title}
							className="h-28 w-20 rounded-lg object-cover sm:h-36 sm:w-24"
						/>
					</Link>
				</div>
			) : (
				<div className="shrink-0">
					<div className="h-28 w-20 rounded-lg bg-(--background-subtle) sm:h-36 sm:w-24" />
				</div>
			)}

			{/* Content */}
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				{/* Header */}
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0 flex-1">
						<Link
							to={to}
							params={params}
							className="truncate font-medium text-sm hover:text-(--accent)"
						>
							{title}
						</Link>
					</div>

					<div className="shrink-0">{headerRight}</div>
				</div>

				{children}
			</div>
		</article>
	);
}
