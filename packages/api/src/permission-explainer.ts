/**
 * Plain-language copy for a Permission Explainer: what the User sees before
 * Opnshelf sends them to their Account Host to approve a permission change.
 *
 * Shared so Web and Mobile say the same thing. Each "can" and "cannot" line
 * must stay true of the scopes the backend requests in
 * `backend/src/auth/oauth-scopes.ts`; a promise about how Opnshelf behaves
 * belongs in `note`, never in `cannot`.
 */

export type PermissionIntegration = "atstore" | "blog" | "bluesky" | "watches";
export type PermissionExplainerAction = "connect" | "disconnect";

export type PermissionExplainer = {
	title: string;
	/** Heading for `can`, e.g. "Opnshelf will be able to". */
	canHeading: string;
	can: string[];
	/** Heading for `cannot`, e.g. "It still can't". */
	cannotHeading: string;
	cannot: string[];
	/** How Opnshelf uses the access, or what stays in place. */
	note?: string;
};

const NO_DMS = "Read your Bluesky direct messages";

function connectCopy(integration: PermissionIntegration): PermissionExplainer {
	switch (integration) {
		case "bluesky":
			return {
				title: "Let Opnshelf post to Bluesky",
				canHeading: "Opnshelf will be able to",
				can: ["Create Bluesky posts", "Update the posts it creates"],
				cannotHeading: "It still can't",
				cannot: [
					"Delete your Bluesky posts",
					"Like, repost, follow or change your profile",
					NO_DMS,
				],
				note: "Opnshelf only posts a Bluesky Cross-post for a Review you choose to share.",
			};
		case "blog":
			return {
				title: "Let Opnshelf mirror Reviews to your blog",
				canHeading: "Opnshelf will be able to",
				can: [
					"Create, update and delete posts in your Standard.site blogs, such as Leaflet",
				],
				cannotHeading: "It still can't",
				cannot: [
					"Change your publication's name or settings",
					"Post to Bluesky",
					NO_DMS,
				],
				note: "Opnshelf only writes the Blog Mirror of Reviews you publish. Your saved publication and format choices stay in place.",
			};
		case "watches":
			return {
				title: "Allow Private on your account",
				canHeading: "Opnshelf will be able to",
				can: [
					"Keep what you make Private in private storage on your account",
					"Read it back so you still see it in Opnshelf",
				],
				cannotHeading: "It still can't",
				cannot: ["Read private data other apps keep", "Post to Bluesky"],
				note: "Opnshelf only makes the categories and Lists you choose Private.",
			};
		case "atstore":
			return {
				title: "Let Opnshelf publish your AT Store Review",
				canHeading: "Opnshelf will be able to",
				can: [
					"Publish an AT Store Review of Opnshelf",
					"Create your AT Store profile if you don't have one yet",
				],
				cannotHeading: "It still can't",
				cannot: ["Edit or delete your AT Store Reviews", "Post to Bluesky"],
				note: "You write the AT Store Review and choose when to publish it.",
			};
	}
}

function disconnectCopy(
	integration: PermissionIntegration,
): PermissionExplainer {
	switch (integration) {
		case "bluesky":
			return {
				title: "Stop Opnshelf posting to Bluesky",
				canHeading: "Opnshelf will no longer be able to",
				can: ["Create or update Bluesky posts"],
				cannotHeading: "What stays",
				cannot: ["Bluesky Cross-posts you already shared stay on Bluesky"],
			};
		case "blog":
			return {
				title: "Stop mirroring Reviews to your blog",
				canHeading: "Opnshelf will no longer be able to",
				can: ["Create, update or delete posts in your blogs"],
				cannotHeading: "What stays",
				cannot: [
					"Existing Blog Mirrors stay on your blog, but stop updating",
					"Your saved publication and format choices",
				],
			};
		case "watches":
			return {
				title: "Remove Private access",
				canHeading: "Opnshelf will no longer be able to",
				can: ["Keep anything Private on your account"],
				cannotHeading: "What stays",
				cannot: ["Everything you already made Public"],
			};
		case "atstore":
			return {
				title: "Remove AT Store access",
				canHeading: "Opnshelf will no longer be able to",
				can: ["Publish AT Store Reviews"],
				cannotHeading: "What stays",
				cannot: ["AT Store Reviews you already published"],
			};
	}
}

export function permissionExplainer(
	integration: PermissionIntegration,
	action: PermissionExplainerAction,
): PermissionExplainer {
	return action === "connect"
		? connectCopy(integration)
		: disconnectCopy(integration);
}

/** Every permission change replaces the session on every other Device. */
export const PERMISSION_DEVICES_NOTICE =
	"Your other Devices will need to sign in again afterwards.";

/** Shown when the User declines on their Account Host. */
export const PERMISSION_DECLINED_MESSAGE =
	"Nothing changed. The permission wasn't granted, so Opnshelf's access is the same as before.";

/**
 * The Account Host's name, taken from the authorization URL Opnshelf is about
 * to open. The Handle's domain is not a reliable guide: a Handle on a custom
 * domain is often hosted somewhere else.
 */
export function accountHostName(authorizationUrl: string): string | null {
	try {
		const host = new URL(authorizationUrl).hostname;
		return host.replace(/^www\./, "") || null;
	} catch {
		return null;
	}
}
