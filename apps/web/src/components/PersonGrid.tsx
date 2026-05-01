import { Link } from "@tanstack/react-router";
import { buildPersonUrl } from "#/lib/url-utils";

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

function deduplicatePeople(people: Person[]): Person[] {
	const map = new Map<number, Person>();
	for (const person of people) {
		const existing = map.get(person.id);
		if (existing) {
			const roles = new Set(
				[existing.role, person.role]
					.filter(Boolean)
					.flatMap((r) => r.split(", ")),
			);
			existing.role = Array.from(roles).join(", ");
		} else {
			map.set(person.id, { ...person });
		}
	}
	return Array.from(map.values());
}

export default function PersonGrid({
	people,
	title = "Cast",
	emptyMessage = "No information available.",
}: PersonGridProps) {
	const uniquePeople = deduplicatePeople(people);

	return (
		<section>
			<h2 className="mb-4 text-display-3">{title}</h2>
			{uniquePeople.length === 0 ? (
				<p className="text-(--foreground-muted) text-sm">{emptyMessage}</p>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{uniquePeople.map((person) => (
						<Link
							key={person.id}
							to={buildPersonUrl(person.id, person.name)}
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
						</Link>
					))}
				</div>
			)}
		</section>
	);
}
