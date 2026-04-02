import type { TmdbCrewDto } from "@opnshelf/api";
import { Link } from "@tanstack/react-router";

interface CrewSectionProps {
	crew: TmdbCrewDto[] | undefined;
	colors: {
		primary?: string;
		muted?: string;
	};
}

function getPersonSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
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
				{crew.map((person) => {
					const personSlug = getPersonSlug(person.name);
					return (
						<Link
							key={`${person.id}-${person.job}`}
							to="/person/$personId/$name"
							params={{
								personId: String(person.id),
								name: personSlug,
							}}
							className="group p-3 rounded-lg bg-(--md-sys-color-surface-container)/30 hover:bg-(--md-sys-color-surface-container)/60 transition-all duration-200 cursor-pointer"
						>
							<p className="text-sm font-medium text-(--md-sys-color-on-surface) line-clamp-1 transition-colors duration-200 group-hover:text-(--md-sys-color-primary)">
								{person.name}
							</p>
							<p className="text-xs mt-0.5" style={{ color: colors.muted }}>
								{person.job}
							</p>
						</Link>
					);
				})}
			</div>
		</section>
	);
}
