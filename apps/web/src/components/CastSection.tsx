import type { TmdbCastDto } from "@opnshelf/api";
import { getTmdbProfileUrl } from "@/lib/utils";

interface CastSectionProps {
	cast: TmdbCastDto[] | undefined;
	colors: {
		primary?: string;
		muted?: string;
	};
}

export function CastSection({ cast, colors }: CastSectionProps) {
	if (!cast || cast.length === 0) return null;

	return (
		<section className="pt-4 min-w-0">
			<h2
				className="text-xl font-semibold mb-4"
				style={{ color: colors.primary }}
			>
				Cast
			</h2>
			<div className="relative w-full overflow-hidden">
				<div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent w-full pr-8">
					{cast.map((person) => {
						const profileUrl = getTmdbProfileUrl(person.profile_path);
						return (
							<div
								key={person.id}
								className="shrink-0 w-32 group cursor-pointer"
							>
								<div className="relative overflow-hidden rounded-lg bg-gray-900/50 aspect-2/3 mb-2 transition-transform duration-300 group-hover:scale-[1.02]">
									{profileUrl ? (
										<img
											src={profileUrl}
											alt={person.name}
											className="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-90"
											loading="lazy"
										/>
									) : (
										<div className="w-full h-full bg-gray-800 flex items-center justify-center">
											<span className="text-gray-600 text-xs text-center px-2">
												No photo
											</span>
										</div>
									)}
								</div>
								<div className="space-y-0.5">
									<p className="text-sm font-medium text-gray-200 line-clamp-2 transition-colors duration-200 group-hover:text-white">
										{person.name}
									</p>
									{person.character && (
										<p
											className="text-xs line-clamp-2"
											style={{ color: colors.muted }}
										>
											as {person.character}
										</p>
									)}
								</div>
							</div>
						);
					})}
				</div>
				<div
					className="absolute right-0 top-0 bottom-4 w-16 pointer-events-none"
					style={{
						background: `linear-gradient(to left, rgb(3, 7, 18), transparent)`,
					}}
				/>
			</div>
		</section>
	);
}
