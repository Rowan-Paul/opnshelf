import {
	authControllerMeOptions,
	usersControllerGetMySettingsOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";

export function useUserSettings() {
	const { data: user } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	const { data: settings, isLoading } = useQuery({
		...usersControllerGetMySettingsOptions(),
		enabled: !!user?.did,
	});

	return {
		timezone: settings?.timezone || "UTC",
		is24Hour: settings?.timeFormat === "24h",
		isLoading,
		user,
	};
}
