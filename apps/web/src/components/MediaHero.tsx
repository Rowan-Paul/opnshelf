import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

interface Breadcrumb {
	label: string;
	to: string;
}

interface MediaHeroProps {
	title: string;
	backdropUrl: string;
	posterUrl: string;
	metaItems?: ReactNode;
	actions?: ReactNode;
	breadcrumbs?: Breadcrumb[];
	currentProgress?: ReactNode;
	backLabel?: string;
}

export default function MediaHero({
	title,
	backdropUrl,
	posterUrl,
	metaItems,
	actions,
	breadcrumbs,
	currentProgress,
	backLabel = "Back to Dashboard",
}: MediaHeroProps) {
	return (
		<div className="relative z-10 min-h-[50vh] overflow-hidden">
			{/* Backdrop Image */}
			<div className="absolute inset-0 h-[60vh] overflow-hidden">
				{backdropUrl ? (
					<img
						src={backdropUrl}
						alt={title}
						className="h-full w-full object-cover"
					/>
				) : (
					<div className="h-full w-full bg-linear-to-br from-gray-800 to-gray-900" />
				)}
				{/* Gradient Overlays */}
				<div className="absolute inset-0 bg-linear-to-t from-(--background) via-(--background)/60 to-transparent" />
				<div className="absolute inset-0 bg-linear-to-r from-(--background) via-(--background)/40 to-transparent" />
			</div>

			{/* Content */}
			<div className="container-app relative pt-8">
				{/* Breadcrumbs / Back Button */}
				{breadcrumbs && breadcrumbs.length > 0 ? (
					<nav className="mb-6 flex items-center gap-2 text-sm">
						{breadcrumbs.map((crumb, index) => (
							<span key={crumb.to} className="flex items-center gap-2">
								{index > 0 && (
									<span className="text-(--foreground-muted)">/</span>
								)}
								{index === breadcrumbs.length - 1 ? (
									<span className="text-(--foreground-muted)">
										{crumb.label}
									</span>
								) : (
									<Link
										to={crumb.to}
										className="inline-flex items-center gap-1 text-(--foreground-muted) transition-colors hover:text-(--foreground)"
									>
										{index === 0 && <ChevronLeft className="size-4" />}
										{crumb.label}
									</Link>
								)}
							</span>
						))}
					</nav>
				) : (
					<Link to="/" className="btn btn-secondary mb-6 inline-flex gap-2">
						<ChevronLeft className="size-4" />
						{backLabel}
					</Link>
				)}

				{/* Media Info Header */}
				<div className="grid gap-8 lg:grid-cols-[300px_1fr] lg:gap-12">
					{/* Poster */}
					<div className="hidden lg:block">
						<div className="aspect-2/3 overflow-hidden rounded-xl shadow-2xl">
							{posterUrl ? (
								<img
									src={posterUrl}
									alt={title}
									className="h-full w-full object-cover"
								/>
							) : (
								<div className="flex h-full w-full items-center justify-center bg-linear-to-br from-gray-700 to-gray-800">
									<span className="text-gray-400">No Poster</span>
								</div>
							)}
						</div>
					</div>

					{/* Info */}
					<div className="flex flex-col justify-end pb-8 lg:pb-16">
						{/* Mobile Poster */}
						<div className="mb-6 flex gap-4 lg:hidden">
							<div className="h-40 w-28 shrink-0 overflow-hidden rounded-lg">
								{posterUrl ? (
									<img
										src={posterUrl}
										alt={title}
										className="h-full w-full object-cover"
									/>
								) : (
									<div className="h-full w-full bg-linear-to-br from-gray-700 to-gray-800" />
								)}
							</div>
							<div className="flex min-w-0 flex-col justify-center overflow-hidden">
								<h1 className="break-words text-display-2">{title}</h1>
							</div>
						</div>

						{/* Desktop Title */}
						<div className="hidden lg:block">
							<h1 className="break-words text-display-2">{title}</h1>
						</div>

						{/* Meta Info */}
						{metaItems && (
							<div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
								{metaItems}
							</div>
						)}

						{/* Current Progress */}
						{currentProgress && <div className="mt-4">{currentProgress}</div>}

						{/* Action Buttons */}
						{actions && (
							<div className="mt-6 flex flex-wrap gap-3">{actions}</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
