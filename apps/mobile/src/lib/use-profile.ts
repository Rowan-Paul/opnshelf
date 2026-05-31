import {
	authControllerMeQueryKey,
	getSessionToken,
	usersControllerDeleteMyAvatarMutation,
	usersControllerUpdateMyProfileMutation,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { File as FsFile } from "expo-file-system";
import { useToast } from "@/components/ui/toast";
import { env } from "@/lib/env";

/** An image asset chosen from the picker, ready to upload. */
export interface AvatarFile {
	uri: string;
}

async function uploadErrorMessage(response: Response): Promise<string> {
	let serverMessage = "";
	try {
		const parsed = (await response.json()) as { message?: unknown };
		serverMessage = Array.isArray(parsed.message)
			? parsed.message.join(", ")
			: typeof parsed.message === "string"
				? parsed.message
				: "";
	} catch {
		serverMessage = await response.text().catch(() => "");
	}
	return serverMessage
		? `${serverMessage} (${response.status})`
		: `Upload failed (${response.status})`;
}

/**
 * Profile mutations for the onboarding profile step: update display name,
 * upload an avatar, and remove it. Mirrors the web onboarding ProfileStep over
 * the shared `@opnshelf/api`.
 *
 * Avatar upload can't go through the generated client (the endpoint takes
 * `multipart/form-data`), and a hand-rolled `{ uri, name, type }` FormData part
 * is rejected by this RN runtime's spec-compliant fetch ("Unsupported
 * FormData"). expo-file-system's `File` implements `Blob`, so we append it
 * directly to a standard `FormData` and POST it with the Bearer session token
 * (native apps can't use the cookie web relies on).
 */
export function useProfileSetup() {
	const queryClient = useQueryClient();
	const toast = useToast();

	const invalidateMe = () =>
		queryClient.invalidateQueries({ queryKey: authControllerMeQueryKey() });

	const updateProfile = useMutation({
		mutationKey: ["users", "me", "profile", "update"],
		...usersControllerUpdateMyProfileMutation(),
		onSuccess: invalidateMe,
		onError: (error) =>
			toast.error(
				error instanceof Error ? error.message : "Failed to update profile",
			),
	});

	const uploadAvatar = useMutation({
		mutationKey: ["users", "me", "profile", "avatar", "upload"],
		mutationFn: async (file: AvatarFile) => {
			const token = getSessionToken();
			const form = new FormData();
			// `File` implements `Blob`; its `.name`/`.type` provide the multipart
			// filename and content-type the backend validates against.
			form.append("avatar", new FsFile(file.uri) as unknown as Blob);

			const response = await fetch(`${env.apiUrl}/users/me/profile/avatar`, {
				method: "POST",
				body: form,
				headers: token ? { Authorization: `Bearer ${token}` } : undefined,
			});
			if (!response.ok) {
				throw new Error(await uploadErrorMessage(response));
			}
		},
		onSuccess: () => {
			invalidateMe();
			toast.success("Profile photo updated");
		},
		onError: (error) =>
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to upload profile photo",
			),
	});

	const deleteAvatar = useMutation({
		mutationKey: ["users", "me", "profile", "avatar", "delete"],
		...usersControllerDeleteMyAvatarMutation(),
		onSuccess: () => {
			invalidateMe();
			toast.success("Profile photo removed");
		},
		onError: (error) =>
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to remove profile photo",
			),
	});

	return { updateProfile, uploadAvatar, deleteAvatar };
}
