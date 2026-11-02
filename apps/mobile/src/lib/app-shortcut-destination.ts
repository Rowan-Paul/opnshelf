import type { AppIntentInvocation } from "expo-app-intents";
import type { Href } from "expo-router";
import { parseWatchlistInput } from "./app-shortcut-input";

type User = {
	handle: string;
	needsOnboarding?: boolean;
	needsEmailVerification?: boolean;
};
const known = new Set([
	"openPickForMe",
	"openTimedPickForMe",
	"openUpNext",
	"searchTitles",
	"openWatchlist",
	"addToWatchlist",
]);
export function appShortcutDestination(
	intent: AppIntentInvocation,
	user: User | null | undefined,
): Href | null | undefined {
	if (!known.has(intent.name)) return undefined;
	let destination: Href;
	const params = intent.params;
	switch (intent.name) {
		case "searchTitles": {
			if (
				typeof params.query !== "string" ||
				!params.query.trim() ||
				params.query.trim().length > 200
			)
				return null;
			destination = {
				pathname: "/search",
				params: { q: params.query.trim(), shortcutRequest: intent.id },
			};
			break;
		}
		case "openTimedPickForMe": {
			if (
				typeof params.minutes !== "number" ||
				!Number.isInteger(params.minutes) ||
				params.minutes < 1 ||
				params.minutes > 1440 ||
				!["both", "movie", "show"].includes(String(params.type))
			)
				return null;
			destination = {
				pathname: "/pick-for-me",
				params: {
					minutes: String(params.minutes),
					type: String(params.type),
					shortcutRequest: intent.id,
				},
			};
			break;
		}
		case "openUpNext":
			destination = `/profile/${encodeURIComponent(user?.handle ?? "")}/up-next`;
			break;
		case "openWatchlist":
			destination = {
				pathname: "/profile/[handle]/lists/[slug]",
				params: {
					handle: user?.handle ?? "",
					slug: "watchlist",
					addInput: "",
					shortcutRequest: intent.id,
				},
			};
			break;
		case "addToWatchlist": {
			if (
				typeof params.input !== "string" ||
				!parseWatchlistInput(params.input)
			)
				return null;
			destination = {
				pathname: "/profile/[handle]/lists/[slug]",
				params: {
					handle: user?.handle ?? "",
					slug: "watchlist",
					addInput: params.input.trim(),
					shortcutRequest: intent.id,
				},
			};
			break;
		}
		default:
			destination = "/pick-for-me";
	}
	if (!user && intent.name !== "searchTitles") return "/login";
	if (user?.needsEmailVerification) return "/verify-email";
	if (user?.needsOnboarding) return "/onboarding";
	return destination;
}
