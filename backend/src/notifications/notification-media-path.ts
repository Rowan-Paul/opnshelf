import slugify from "slugify";

export function mediaPath(
	kind: "movies" | "shows",
	id: string,
	title: string,
): string {
	return `/${kind}/${id}/${slugify(title, { lower: true, strict: true }) || "title"}`;
}
