export type ProfileSection =
	| "shelf"
	| "up-next"
	| "lists"
	| "calendar"
	| "settings"
	| "people"
	| "followers"
	| "following";

export type ProfilePeopleTab = "following" | "followers";

interface VisibleProfileSectionsOptions {
	isOwner: boolean;
	isSignedIn: boolean;
}

export interface ProfilePeopleRouteSearch {
	tab?: ProfilePeopleTab;
	q?: string;
	discoverPage?: number;
	followingPage?: number;
	followersPage?: number;
}

function withDefaultProfilePeopleSearch(
	search?: ProfilePeopleRouteSearch,
): Required<ProfilePeopleRouteSearch> {
	return {
		tab: "following",
		q: "",
		discoverPage: 1,
		followingPage: 1,
		followersPage: 1,
		...search,
	};
}

type ProfileRouteTarget =
	| {
			to: "/profile/$handle/shelf";
			params: { handle: string };
			search?: { page: number };
	  }
	| {
			to: "/profile/$handle/up-next";
			params: { handle: string };
			search?: { page: number };
	  }
	| {
			to: "/profile/$handle/lists";
			params: { handle: string };
	  }
	| {
			to: "/profile/$handle/calendar";
			params: { handle: string };
	  }
	| {
			to: "/profile/$handle/settings";
			params: { handle: string };
	  }
	| {
			to: "/profile/$handle/people";
			params: { handle: string };
			search: Required<ProfilePeopleRouteSearch>;
	  }
	| {
			to: "/profile/$handle/followers";
			params: { handle: string };
			search?: { page: number };
	  }
	| {
			to: "/profile/$handle/following";
			params: { handle: string };
			search?: { page: number };
	  }
	| {
			to: "/profile/$handle/list/$slug";
			params: { handle: string; slug: string };
	  };

export function normalizeProfileHandle(input: string) {
	return input.trim().replace(/^@/, "").toLowerCase();
}

export function isOwnerProfile(
	currentUserDid?: string | null,
	profileDid?: string | null,
) {
	return Boolean(currentUserDid && profileDid && currentUserDid === profileDid);
}

export function getProfileRoute(
	handle: string,
	section: ProfileSection,
	search?: { page: number },
): ProfileRouteTarget {
	const normalizedHandle = normalizeProfileHandle(handle);

	switch (section) {
		case "shelf":
			return {
				to: "/profile/$handle/shelf",
				params: { handle: normalizedHandle },
				...(search ? { search } : {}),
			};
		case "up-next":
			return {
				to: "/profile/$handle/up-next",
				params: { handle: normalizedHandle },
				...(search ? { search } : {}),
			};
		case "lists":
			return {
				to: "/profile/$handle/lists",
				params: { handle: normalizedHandle },
			};
		case "calendar":
			return {
				to: "/profile/$handle/calendar",
				params: { handle: normalizedHandle },
			};
		case "settings":
			return {
				to: "/profile/$handle/settings",
				params: { handle: normalizedHandle },
			};
		case "people":
			return {
				to: "/profile/$handle/people",
				params: { handle: normalizedHandle },
				search: withDefaultProfilePeopleSearch(),
			};
		case "followers":
			return {
				to: "/profile/$handle/followers",
				params: { handle: normalizedHandle },
				...(search ? { search } : {}),
			};
		case "following":
			return {
				to: "/profile/$handle/following",
				params: { handle: normalizedHandle },
				...(search ? { search } : {}),
			};
	}
}

export function getProfilePeopleRoute(
	handle: string,
	search?: ProfilePeopleRouteSearch,
) {
	return {
		to: "/profile/$handle/people" as const,
		params: {
			handle: normalizeProfileHandle(handle),
		},
		search: withDefaultProfilePeopleSearch(search),
	};
}

export function getProfileListDetailRoute(handle: string, slug: string) {
	return {
		to: "/profile/$handle/list/$slug" as const,
		params: {
			handle: normalizeProfileHandle(handle),
			slug,
		},
	};
}

export function getVisibleProfileSections({
	isOwner,
	isSignedIn,
}: VisibleProfileSectionsOptions): ProfileSection[] {
	const sections: ProfileSection[] = ["shelf"];

	if (isOwner) {
		sections.push("up-next");
	}

	sections.push("lists");

	if (isSignedIn) {
		if (isOwner) {
			sections.push("people");
		} else {
			sections.push("followers", "following");
		}
	}

	if (isOwner) {
		sections.push("calendar", "settings");
	}

	return sections;
}
