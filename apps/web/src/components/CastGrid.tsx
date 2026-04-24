interface CastMember {
	name: string;
	character: string;
	photo: string;
}

interface CastGridProps {
	cast: CastMember[];
}

export default function CastGrid({ cast }: CastGridProps) {
	if (cast.length === 0) return null;

	return (
		<section>
			<h2 className="text-display-3 mb-4">Cast</h2>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{cast.map((actor) => (
					<div
						key={actor.name}
						className="card card-interactive flex items-center gap-3 p-3"
					>
						<img
							src={actor.photo}
							alt={actor.name}
							className="h-12 w-12 rounded-full object-cover"
							loading="lazy"
						/>
						<div className="min-w-0">
							<p className="font-medium text-sm truncate">{actor.name}</p>
							<p className="text-xs text-[var(--foreground-muted)] truncate">
								{actor.character}
							</p>
						</div>
					</div>
				))}
			</div>
		</section>
	);
}
