import type { TmdbCrewDto } from "@opnshelf/api";

interface CrewSectionProps {
	crew: TmdbCrewDto[] | undefined;
	colors: {
		primary?: string;
		muted?: string;
	};
}

export function CrewSection({ crew, colors }: CrewSectionProps) {
	if (!crew || crew.length === 0) return null;

	return (
		<section className="pt-2">
			<h2
				className="text-xl font-semibold mb-4"
				style={{ color: colors.primary }}
			>
				Crew
			</h2>
			<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
				{crew.map((person) => (
					<div
						key={`${person.id}-${person.job}`}
						className="group p-3 rounded-lg bg-gray-900/30 hover:bg-gray-900/60 transition-all duration-200 cursor-pointer"
					>
						<p className="text-sm font-medium text-gray-200 line-clamp-1 transition-colors duration-200 group-hover:text-white">
							{person.name}
						</p>
						<p className="text-xs mt-0.5" style={{ color: colors.muted }}>
							{person.job}
						</p>
					</div>
				))}
			</div>
		</section>
	);
}
