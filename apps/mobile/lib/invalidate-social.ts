import {
	socialControllerGetFeedQueryKey,
	socialControllerGetFollowersQueryKey,
	socialControllerGetFollowingQueryKey,
	socialControllerGetRelationshipQueryKey,
	usersControllerGetPublicProfileQueryKey,
} from "@opnshelf/api";
import type { QueryClient } from "@tanstack/react-query";

function normalizeHandle(handle: string) {
	return handle.trim().replace(/^@/, "").toLowerCase();
}

export async function invalidateSocialQueries(
	queryClient: QueryClient,
	args: {
		targetDid: string;
		targetHandle: string;
		viewerHandle?: string | null;
	},
) {
	const targetHandle = normalizeHandle(args.targetHandle);
	const viewerHandle = args.viewerHandle
		? normalizeHandle(args.viewerHandle)
		: null;

	await Promise.all([
		queryClient.invalidateQueries({
			queryKey: usersControllerGetPublicProfileQueryKey({
				path: { handle: targetHandle },
			}),
		}),
		queryClient.invalidateQueries({
			queryKey: socialControllerGetRelationshipQueryKey({
				path: { targetDid: args.targetDid },
			}),
		}),
		queryClient.invalidateQueries({
			predicate: (query) => {
				const key = query.queryKey[0] as
					| { _id?: string; path?: { handle?: string } }
					| undefined;
				if (!key?._id) {
					return false;
				}

				if (key._id === "socialControllerSearchPeople") {
					return true;
				}

				if (
					key._id === "socialControllerGetFeed" ||
					key._id === "socialControllerGetFollowers" ||
					key._id === "socialControllerGetFollowing"
				) {
					if (!key.path?.handle) {
						return true;
					}

					return (
						key.path.handle === targetHandle || key.path.handle === viewerHandle
					);
				}

				return false;
			},
		}),
		viewerHandle
			? queryClient.invalidateQueries({
					queryKey: usersControllerGetPublicProfileQueryKey({
						path: { handle: viewerHandle },
					}),
				})
			: Promise.resolve(),
		queryClient.invalidateQueries({
			queryKey: socialControllerGetFeedQueryKey(),
		}),
	]);
}
