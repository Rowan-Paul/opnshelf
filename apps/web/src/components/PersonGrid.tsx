interface Person {
	id: number;
	name: string;
	role: string;
	photo: string;
}

interface PersonGridProps {
	people: Person[];
	title?: string;
	emptyMessage?: string;
}

export default function PersonGrid({
	people,
	title = "Cast",
	emptyMessage = "No information available.",
}: PersonGridProps) {
	return (
		<section>
			<h2 className="mb-4 text-display-3">{title}</h2>
			{people.length === 0 ? (
				<p className="text-(--foreground-muted) text-sm">{emptyMessage}</p>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{people.map((person) => (
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
								<p className="truncate font-medium text-sm">{person.name}</p>
								<p className="truncate text-(--foreground-muted) text-xs">
									{person.role}
								</p>
							</div>
						</div>
					))}
				</div>
			)}
		</section>
	);
}
