export type ProfileSection =
	| "shelf"
	| "up-next"
	| "lists"
	| "calendar"
	| "settings";

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
	}
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
