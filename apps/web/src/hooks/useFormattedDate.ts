import { useMemo } from "react";
import { type DateFormatOptions, formatDateWithTimezone } from "@/lib/utils";
import { useUserSettings } from "./useUserSettings";

export function useFormattedDate() {
	const { timezone, is24Hour } = useUserSettings();

	const formatDate = (
		dateString: string | Date,
		options?: Partial<Omit<DateFormatOptions, "timezone" | "is24Hour">>,
	) => {
		return formatDateWithTimezone(dateString, {
			timezone,
			is24Hour,
			includeTime: options?.includeTime ?? true,
		});
	};

	return { formatDate, timezone, is24Hour };
}

function _useMemoizedFormattedDate(
	dateString: string | Date | null | undefined,
) {
	const { formatDate } = useFormattedDate();

	return useMemo(() => {
		if (!dateString) return null;
		return formatDate(dateString);
	}, [dateString, formatDate]);
}
