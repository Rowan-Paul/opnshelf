interface CrewMember {
	id: number;
	name: string;
	job: string;
	photo: string;
}

interface CrewGridProps {
	crew: CrewMember[];
}

export default function CrewGrid({ crew }: CrewGridProps) {
	return (
		<section>
			<h2 className="text-display-3 mb-4">Crew</h2>
			{crew.length === 0 ? (
				<p className="text-sm text-[var(--foreground-muted)]">
					No crew information available.
				</p>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{crew.map((person) => (
						<div
							key={person.id}
							className="card card-interactive flex items-center gap-3 p-3"
						>
							<img
								src={person.photo}
								alt={person.name}
								className="h-12 w-12 rounded-full object-cover"
								loading="lazy"
							/>
							<div className="min-w-0">
								<p className="font-medium text-sm truncate">{person.name}</p>
								<p className="text-xs text-[var(--foreground-muted)] truncate">
									{person.job}
								</p>
							</div>
						</div>
					))}
				</div>
			)}
		</section>
	);
}
