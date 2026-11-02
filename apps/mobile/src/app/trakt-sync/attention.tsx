import { Redirect } from "expo-router";

// Older links to Trakt Sync's Needs attention list still open this path (ADR 0051).
export default function TraktSyncAttentionRedirect() {
	return (
		<Redirect
			href={{
				pathname: "/integrations/[provider]/attention",
				params: { provider: "trakt" },
			}}
		/>
	);
}
