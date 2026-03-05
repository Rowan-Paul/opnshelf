import { useCallback, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

export function useScrollRevealHeader(threshold: number = 120) {
	const [showCompactHeader, setShowCompactHeader] = useState(false);

	const onScroll = useCallback(
		(event: NativeSyntheticEvent<NativeScrollEvent>) => {
			const shouldShowHeader = event.nativeEvent.contentOffset.y > threshold;
			setShowCompactHeader((prev) =>
				prev === shouldShowHeader ? prev : shouldShowHeader,
			);
		},
		[threshold],
	);

	return {
		showCompactHeader,
		onScroll,
	};
}
