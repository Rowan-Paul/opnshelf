/**
 * Copy for the dialog shown before a client leaves for the account host's
 * consent screen. Each list must stay true to the scopes the backend requests
 * (backend/src/auth/oauth-scopes.ts); the host's own screen is the authority.
 */
export type PermissionRequestIntegration =
	| "atstore"
	| "blog"
	| "bluesky"
	| "popfeed"
	| "watches";

export type PermissionRequestCopy = {
	title: string;
	can: readonly string[];
	cannot: readonly string[];
};

export const PERMISSION_REQUEST_COPY: Record<
	PermissionRequestIntegration,
	PermissionRequestCopy
> = {
	bluesky: {
		title: "Let Opnshelf post to Bluesky",
		can: [
			"Create Bluesky posts for Reviews you choose to cross-post",
			"Update those posts",
		],
		cannot: [
			"Delete your Bluesky posts",
			"Read your direct messages",
			"Post a Review you didn't choose",
		],
	},
	blog: {
		title: "Let Opnshelf mirror Reviews to your blog",
		can: [
			"Write a blog post for each new Review to the publication you picked",
			"Update or remove those blog posts when you edit or delete the Review",
		],
		cannot: ["Post to Bluesky", "Read your direct messages"],
	},
	watches: {
		title: "Let Opnshelf keep things Private",
		can: [
			"Store the Watches, Library, Notes and Lists you make Private in a space only you and apps you approve can read",
		],
		cannot: [
			"Show Private items to anyone else",
			"Post to Bluesky",
			"Read your direct messages",
		],
	},
	popfeed: {
		title: "Let Opnshelf write to Popfeed",
		can: [
			"Add your Watches, Ratings, Reviews and Lists to Popfeed",
			"Update or remove Popfeed watched items, reviews and lists to keep them in step with Opnshelf",
		],
		cannot: [
			"Post to Bluesky",
			"Read your direct messages",
			"Change anything in Popfeed when Popfeed Sync is off",
		],
	},
	atstore: {
		title: "Let Opnshelf publish your AT Store review",
		can: [
			"Publish your review of Opnshelf on AT Store",
			"Create your AT Store profile if you don't have one yet",
		],
		cannot: ["Post to Bluesky", "Read your direct messages"],
	},
};

export const PERMISSION_REQUEST_NOTES = {
	host: "The service that hosts your account asks you to approve this, then sends you back here.",
	devices: "Your other Devices will need to sign in again afterwards.",
} as const;

export const PERMISSION_DISCONNECT_DESCRIPTION =
	"The service that hosts your account confirms the change, then sends you back here. Your other Devices will need to sign in again. Your saved publication and format choices stay in place.";
