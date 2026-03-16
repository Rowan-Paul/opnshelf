import {
	socialControllerGetFeedQueryKey,
	socialControllerGetFollowersQueryKey,
	socialControllerGetFollowingQueryKey,
	socialControllerGetRelationshipQueryKey,
	usersControllerGetPublicProfileQueryKey,
} from "@opnshelf/api";
import type { QueryClient } from "@tanstack/react-query";
import { normalizeProfileHandle } from "@/lib/profile-routes";

export async function invalidateSocialQueries(
	queryClient: QueryClient,
	args: {
		targetDid: string;
		targetHandle: string;
		viewerHandle?: string | null;
	},
) {
	const normalizedTargetHandle = normalizeProfileHandle(args.targetHandle);
	const normalizedViewerHandle = args.viewerHandle
		? normalizeProfileHandle(args.viewerHandle)
		: null;

	await Promise.all([
		queryClient.invalidateQueries({
			queryKey: usersControllerGetPublicProfileQueryKey({
				path: { handle: normalizedTargetHandle },
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
						key.path.handle === normalizedTargetHandle ||
						key.path.handle === normalizedViewerHandle
					);
				}

				return false;
			},
		}),
		normalizedViewerHandle
			? queryClient.invalidateQueries({
					queryKey: usersControllerGetPublicProfileQueryKey({
						path: { handle: normalizedViewerHandle },
					}),
				})
			: Promise.resolve(),
		normalizedTargetHandle
			? queryClient.invalidateQueries({
					queryKey: socialControllerGetFollowersQueryKey({
						path: { handle: normalizedTargetHandle },
						query: { page: 1, pageSize: 1 },
					}),
				})
			: Promise.resolve(),
		normalizedTargetHandle
			? queryClient.invalidateQueries({
					queryKey: socialControllerGetFollowingQueryKey({
						path: { handle: normalizedTargetHandle },
						query: { page: 1, pageSize: 1 },
					}),
				})
			: Promise.resolve(),
		normalizedViewerHandle
			? queryClient.invalidateQueries({
					queryKey: socialControllerGetFollowersQueryKey({
						path: { handle: normalizedViewerHandle },
						query: { page: 1, pageSize: 1 },
					}),
				})
			: Promise.resolve(),
		normalizedViewerHandle
			? queryClient.invalidateQueries({
					queryKey: socialControllerGetFollowingQueryKey({
						path: { handle: normalizedViewerHandle },
						query: { page: 1, pageSize: 1 },
					}),
				})
			: Promise.resolve(),
		queryClient.invalidateQueries({
			queryKey: socialControllerGetFeedQueryKey(),
		}),
	]);
}
