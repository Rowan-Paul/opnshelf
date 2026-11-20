import slugify from "slugify";

export function slugifyName(name: string): string {
	return (
		slugify(name, {
			lower: true,
			strict: true,
			trim: true,
		}) ||
		"-"
	);
}
