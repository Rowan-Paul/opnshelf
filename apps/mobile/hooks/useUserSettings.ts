import {
	usersControllerGetMySettingsOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth";

export function useUserSettings() {
	const { user, isAuthenticated } = useAuth();

	const { data: settings, isLoading } = useQuery({
		...usersControllerGetMySettingsOptions(),
		enabled: !!user?.did && isAuthenticated,
	});

	return {
		timezone: settings?.timezone || "UTC",
		is24Hour: settings?.timeFormat === "24h",
		isLoading,
		user,
	};
}
