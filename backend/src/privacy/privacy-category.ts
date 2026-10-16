import { BadRequestException } from "@nestjs/common";
/** The categories exposed by Privacy Alpha. Lists use one Space per List. */
export const PRIVACY_CATEGORIES = [
	"watches",
	"library",
	"notes",
	"lists",
] as const;
export type PrivacyCategory = (typeof PRIVACY_CATEGORIES)[number];
export type PrivacyVisibility = "public" | "private";
export const PRIVACY_COLLECTIONS = {
	watches: ["xyz.opnshelf.movie", "xyz.opnshelf.episode"],
	library: ["xyz.opnshelf.library.item"],
	notes: ["xyz.opnshelf.note"],
	lists: ["xyz.opnshelf.list", "xyz.opnshelf.list.item"],
} as const;
export type PrivacyCollection =
	(typeof PRIVACY_COLLECTIONS)[PrivacyCategory][number];
export interface PrivacyRepositoryConfig {
	collections: readonly PrivacyCollection[];
	spaceType: string;
	skey: string;
	scope: string;
}
export function privacyRepositoryConfig(
	category: PrivacyCategory,
	listRkey?: string,
): PrivacyRepositoryConfig {
	const collections = PRIVACY_COLLECTIONS[category];
	const spaceType = `xyz.opnshelf.${category}`;
	if (
		category === "lists" &&
		(!listRkey ||
			!/^[a-zA-Z0-9._~:-]{1,512}$/.test(listRkey) ||
			listRkey === "." ||
			listRkey === "..")
	)
		throw new BadRequestException(
			"A List privacy scope requires its record key",
		);
	return {
		collections,
		spaceType,
		skey: category === "lists" ? listRkey! : "self",
		scope: `space:${spaceType}?${collections.map((c) => `collection=${c}`).join("&")}&manage=create`,
	};
}
export const PRIVACY_ALPHA_DETAILS =
	"Privacy uses the evolving AT Protocol Spaces alpha. Previously public copies may remain on other services. Other authorized apps can edit your Spaces; migration detects observed changes but cannot make moves between repositories atomic.";
