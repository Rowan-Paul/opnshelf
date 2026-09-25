import type { Prisma } from "../generated/client";
import type { NotificationCollectionItemDto } from "./notifications.dto";

/** JSON is persisted by the worker, but validate it before exposing links or HTML. */
export function collectionItems(
	value: Prisma.JsonValue,
): NotificationCollectionItemDto[] {
	if (!Array.isArray(value)) throw new Error("Invalid notification collection");
	return value.map((item) => {
		if (
			!item ||
			typeof item !== "object" ||
			Array.isArray(item) ||
			typeof item.mediaId !== "string" ||
			!/^\d+$/.test(item.mediaId) ||
			(item.mediaType !== "movie" && item.mediaType !== "show") ||
			typeof item.title !== "string" ||
			typeof item.overview !== "string" ||
			!(
				item.posterPath === null ||
				(typeof item.posterPath === "string" &&
					/^\/[\w.-]+$/.test(item.posterPath))
			) ||
			!(
				item.releaseDate === null ||
				(typeof item.releaseDate === "string" &&
					/^\d{4}-\d{2}-\d{2}$/.test(item.releaseDate))
			) ||
			!(
				item.seasonNumber === null ||
				(typeof item.seasonNumber === "number" &&
					Number.isInteger(item.seasonNumber) &&
					item.seasonNumber > 0)
			) ||
			typeof item.path !== "string" ||
			!/^\/(movies|shows)\/\d+\/[a-z0-9-]+(?:\/seasons\/\d+)?$/.test(item.path)
		)
			throw new Error("Invalid notification collection item");
		return {
			mediaId: item.mediaId,
			mediaType: item.mediaType,
			title: item.title,
			overview: item.overview,
			posterPath: item.posterPath,
			releaseDate: item.releaseDate,
			seasonNumber: item.seasonNumber,
			path: item.path,
		};
	});
}

export function releaseTeaser(items: NotificationCollectionItemDto[]): string {
	const titles = items
		.slice(0, 2)
		.map((item) =>
			item.seasonNumber
				? `${item.title} season ${item.seasonNumber}`
				: item.title,
		);
	const remaining = items.length - titles.length;
	return `${titles.join(" and ")}${remaining ? `, plus ${remaining} more` : ""}. Take a look.`;
}

function escapeHtml(value: string): string {
	return value.replace(
		/[&<>"']/g,
		(character) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				character
			] ?? character,
	);
}

export function notificationEmail(input: {
	title: string;
	body: string;
	url: string | null;
	baseUrl: string;
	collection?: {
		heading: string;
		periodStart: string;
		periodEnd: string;
		items: Prisma.JsonValue;
	} | null;
}): { text: string; html: string } {
	const absolute = (path: string) => new URL(path, input.baseUrl).toString();
	const settings = absolute("/settings/notifications");
	const items = input.collection ? collectionItems(input.collection.items) : [];
	const heading = input.collection?.heading ?? input.title;
	const period = input.collection
		? `${input.collection.periodStart} – ${input.collection.periodEnd}`
		: "";
	const link = input.url ? absolute(input.url) : null;
	const label = input.url?.startsWith("/discover/collections/")
		? "See all releases"
		: "Open in Opnshelf";
	const cards = items
		.map((item) => {
			const title = `${item.title}${item.seasonNumber ? ` · Season ${item.seasonNumber}` : ""}`;
			const date = item.releaseDate
				? `${item.mediaType === "movie" ? "Release" : "Premiere"}: ${item.releaseDate}`
				: "Release date unavailable";
			return `<tr><td class="email-divider" style="padding:24px 0;border-bottom:1px solid #e2e8f0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${item.posterPath ? `<td width="96" valign="top" style="padding-right:16px"><a href="${escapeHtml(absolute(item.path))}"><img src="https://image.tmdb.org/t/p/w342${escapeHtml(item.posterPath)}" alt="${escapeHtml(item.title)} poster" width="80" style="display:block;width:80px;border-radius:8px" /></a></td>` : ""}<td valign="top"><h2 style="margin:0 0 8px;font-size:20px;line-height:1.3"><a href="${escapeHtml(absolute(item.path))}" class="email-text" style="color:#0f172a;text-decoration:none">${escapeHtml(title)}</a></h2><p class="email-muted" style="margin:0 0 8px;font-size:13px;color:#475569">${escapeHtml(date)}</p><p style="margin:0 0 12px;font-size:15px;line-height:1.6">${escapeHtml(item.overview.length > 240 ? `${item.overview.slice(0, 237)}…` : item.overview)}</p><a href="${escapeHtml(absolute(item.path))}" class="email-link" style="color:#654c00;font-size:14px">View details →</a></td></tr></table></td></tr>`;
		})
		.join("");
	return {
		text: [
			heading,
			period,
			input.body,
			...items.map(
				(item) =>
					`${item.title}${item.seasonNumber ? ` · Season ${item.seasonNumber}` : ""}\n${item.releaseDate ?? "Release date unavailable"}\n${item.overview}\n${absolute(item.path)}`,
			),
			link ? `${label}: ${link}` : "",
			`Manage notifications: ${settings}`,
		]
			.filter(Boolean)
			.join("\n\n"),
		html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><style>:root{color-scheme:light dark;supported-color-schemes:light dark}@media (prefers-color-scheme:dark){body,.email-canvas{background-color:#020617!important;color:#f8fafc!important}.email-panel{background-color:#0f172a!important;color:#f8fafc!important}.email-text{color:#f8fafc!important}.email-muted{color:#cbd5e1!important}.email-link{color:#f3bc00!important}.email-divider{border-color:#334155!important}.email-button{background-color:#f3bc00!important;color:#3f2e00!important}}</style><title>${escapeHtml(heading)}</title></head><body class="email-canvas" style="margin:0;background:#f8fafc;color:#0f172a;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(input.body)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" class="email-panel" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px"><tr><td style="padding:32px 24px"><p style="margin:0 0 28px"><a href="${escapeHtml(absolute("/"))}" style="text-decoration:none"><img src="${escapeHtml(absolute("/logo192.png"))}" alt="Opnshelf" width="48" height="48" style="display:block;border:0;border-radius:10px" /></a></p>${period ? `<p class="email-muted" style="font-size:13px;color:#475569">${escapeHtml(period)}</p>` : ""}<h1 style="margin:0 0 12px;font-size:30px;line-height:1.2">${escapeHtml(heading)}</h1><p class="email-muted" style="line-height:1.6;color:#475569">${escapeHtml(input.body)}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cards}</table>${link ? `<p style="margin:28px 0"><a href="${escapeHtml(link)}" class="email-button" style="display:inline-block;padding:14px 20px;background:#f3bc00;border-radius:8px;color:#3f2e00;text-decoration:none;font-weight:bold">${label}</a></p>` : ""}<p class="email-muted" style="margin:28px 0 0;font-size:12px;line-height:1.6;color:#475569"><a href="${escapeHtml(settings)}" class="email-muted" style="color:#475569">Manage notifications</a></p></td></tr></table></td></tr></table></body></html>`,
	};
}
