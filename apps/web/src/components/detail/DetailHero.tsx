import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ColorTheme } from "./types";

type DetailHeroProps = {
	title: string;
	subtitle?: string;
	backdropUrl?: string | null;
	posterUrl?: string | null;
	posterLinkTo?: {
		to: string;
		params: Record<string, string>;
	};
	colors: ColorTheme;
	isLoading?: boolean;
	onBack?: () => void;
};

export function DetailHero({
	title,
	subtitle,
	backdropUrl,
	posterUrl,
	posterLinkTo,
	colors,
	isLoading,
	onBack,
}: DetailHeroProps) {
	if (isLoading) {
		return (
			<div className="relative h-[50vh] md:h-[60vh] overflow-hidden">
				<div
					className="w-full h-full animate-pulse"
					style={{
						background: `linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 100%)`,
					}}
				/>
				<div className="absolute bottom-0 left-0 right-0 p-4 md:p-8">
					<div className="container mx-auto max-w-7xl">
						<div className="flex items-end gap-4 md:gap-8">
							<div className="shrink-0">
								<div className="w-28 md:w-48 lg:w-64 rounded-lg overflow-hidden bg-(--md-sys-color-surface-container)" />
							</div>
							<div className="flex-1 pb-2">
								<div className="h-8 md:h-16 lg:w-96 bg-(--md-sys-color-surface-container) rounded-lg animate-pulse" />
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	const posterContent = posterUrl ? (
		<img
			src={posterUrl}
			alt={title}
			className="w-full aspect-2/3 object-cover"
		/>
	) : (
		<div className="w-full aspect-2/3 bg-gray-900 flex items-center justify-center">
			<span className="text-gray-600">No poster</span>
		</div>
	);

	return (
		<div className="relative h-[50vh] md:h-[60vh] overflow-hidden">
			{backdropUrl ? (
				<>
					<img
						src={backdropUrl}
						alt=""
						className="w-full h-full object-cover"
					/>
					<div
						className="absolute inset-0"
						style={{
							background: `linear-gradient(to bottom, transparent 0%, rgba(3, 7, 18, 0.6) 60%, rgb(3, 7, 18) 100%)`,
						}}
					/>
					<div
						className="absolute inset-0"
						style={{
							background: `linear-gradient(to right, rgba(3, 7, 18, 0.8) 0%, transparent 50%)`,
						}}
					/>
				</>
			) : (
				<div
					className="w-full h-full"
					style={{
						background: `linear-gradient(135deg, ${colors.muted} 0%, rgb(3, 7, 18) 100%)`,
					}}
				/>
			)}

			<button
				type="button"
				onClick={onBack}
				className="absolute top-4 left-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors cursor-pointer"
			>
				<ArrowLeft className="w-5 h-5" />
			</button>

			<div className="absolute bottom-0 left-0 right-0 p-4 md:p-8">
				<div className="container mx-auto max-w-7xl">
					<div className="flex items-end gap-4 md:gap-8">
						<div className="shrink-0">
							<div
								className="w-28 md:w-48 lg:w-64 rounded-lg overflow-hidden shadow-2xl"
								style={{
									boxShadow: `0 25px 50px -12px ${colors.primary}40`,
								}}
							>
								{posterLinkTo ? (
									<Link
										to={posterLinkTo.to}
										params={posterLinkTo.params}
										className="block transition-transform hover:scale-105"
									>
										{posterContent}
									</Link>
								) : (
									posterContent
								)}
							</div>
						</div>

						<div className="flex-1 pb-2">
							<h1
								className="text-2xl md:text-5xl lg:text-6xl font-bold mb-2"
								style={{
									textShadow: `0 4px 30px ${colors.primary}60`,
								}}
							>
								{title}
							</h1>
							{subtitle && (
								<h2 className="text-lg md:text-2xl text-gray-200">
									{subtitle}
								</h2>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
