import { Redirect, useLocalSearchParams } from "expo-router";

// Trakt's OAuth callback and captured links still open this path (ADR 0022, ADR 0051).
export default function TraktSyncRedirect() {
	const { connection } = useLocalSearchParams<{ connection?: string }>();
	return (
		<Redirect
			href={{
				pathname: "/integrations/[provider]",
				params: { provider: "trakt", ...(connection ? { connection } : {}) },
			}}
		/>
	);
}
