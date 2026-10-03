export function featuredExpiryInput(iso: string, timezone: string): string {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(new Date(iso));
	const get = (type: string) => parts.find((part) => part.type === type)?.value;
	return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
export function defaultFeaturedExpiry(): string {
	return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}
