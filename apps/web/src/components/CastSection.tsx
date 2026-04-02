import type { TmdbCastDto } from "@opnshelf/api";
import { Link } from "@tanstack/react-router";
import { getTmdbProfileUrl } from "@/lib/utils";

interface CastSectionProps {
	cast: TmdbCastDto[] | undefined;
	guestStars?: TmdbCastDto[] | undefined;
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

export function CastSection({ cast, guestStars, colors }: CastSectionProps) {
	const hasCast = cast && cast.length > 0;
	const hasGuestStars = guestStars && guestStars.length > 0;

	if (!hasCast && !hasGuestStars) return null;

	return (
		<>
			{hasCast && (
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
								const personSlug = getPersonSlug(person.name);
								return (
									<Link
										key={`cast-${person.id}`}
										to="/person/$personId/$name"
										params={{
											personId: String(person.id),
											name: personSlug,
										}}
										className="shrink-0 w-32 group cursor-pointer"
									>
										<div
											className="relative overflow-hidden rounded-lg aspect-2/3 mb-2 transition-transform duration-300 group-hover:scale-[1.02]"
											style={{
												backgroundColor:
													"var(--md-sys-color-surface-container)",
											}}
										>
											{profileUrl ? (
												<img
													src={profileUrl}
													alt={person.name}
													className="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-90"
													loading="lazy"
												/>
											) : (
												<div
													className="w-full h-full flex items-center justify-center"
													style={{
														backgroundColor:
															"var(--md-sys-color-surface-container-high)",
														color: "var(--md-sys-color-on-surface-variant)",
													}}
												>
													<span className="text-xs text-center px-2">
														No photo
													</span>
												</div>
											)}
										</div>
										<div className="space-y-0.5">
											<p
												className="text-sm font-medium line-clamp-2 transition-colors duration-200 group-hover:text-(--md-sys-color-primary)"
												style={{
													color: "var(--md-sys-color-on-surface)",
												}}
											>
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
									</Link>
								);
							})}
						</div>
						<div
							className="absolute right-0 top-0 bottom-4 w-16 pointer-events-none"
							style={{
								background:
									"linear-gradient(to left, var(--md-sys-color-background), transparent)",
							}}
						/>
					</div>
				</section>
			)}

			{hasGuestStars && (
				<section className="pt-4 min-w-0">
					<h2
						className="text-xl font-semibold mb-4"
						style={{ color: colors.primary }}
					>
						Guest Stars
					</h2>
					<div className="relative w-full overflow-hidden">
						<div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent w-full pr-8">
							{guestStars.map((person) => {
								const profileUrl = getTmdbProfileUrl(person.profile_path);
								const personSlug = getPersonSlug(person.name);
								return (
									<Link
										key={`guest-${person.id}`}
										to="/person/$personId/$name"
										params={{
											personId: String(person.id),
											name: personSlug,
										}}
										className="shrink-0 w-32 group cursor-pointer"
									>
										<div
											className="relative overflow-hidden rounded-lg aspect-2/3 mb-2 transition-transform duration-300 group-hover:scale-[1.02]"
											style={{
												backgroundColor:
													"var(--md-sys-color-surface-container)",
											}}
										>
											{profileUrl ? (
												<img
													src={profileUrl}
													alt={person.name}
													className="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-90"
													loading="lazy"
												/>
											) : (
												<div
													className="w-full h-full flex items-center justify-center"
													style={{
														backgroundColor:
															"var(--md-sys-color-surface-container-high)",
														color: "var(--md-sys-color-on-surface-variant)",
													}}
												>
													<span className="text-xs text-center px-2">
														No photo
													</span>
												</div>
											)}
										</div>
										<div className="space-y-0.5">
											<p
												className="text-sm font-medium line-clamp-2 transition-colors duration-200 group-hover:text-(--md-sys-color-primary)"
												style={{
													color: "var(--md-sys-color-on-surface)",
												}}
											>
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
									</Link>
								);
							})}
						</div>
						<div
							className="absolute right-0 top-0 bottom-4 w-16 pointer-events-none"
							style={{
								background:
									"linear-gradient(to left, var(--md-sys-color-background), transparent)",
							}}
						/>
					</div>
				</section>
			)}
		</>
	);
}
