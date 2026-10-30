import type { IntegrationId } from "@opnshelf/api";
import { Popcorn } from "lucide-react";
import { TraktMark } from "#/components/TraktMark";

/**
 * Trakt keeps its own logomark. Popfeed publishes no brand assets we can use,
 * so it gets a neutral popcorn glyph rather than a copy of its logo.
 */
export function IntegrationMark({
	id,
	className,
}: {
	id: IntegrationId;
	className?: string;
}) {
	if (id === "trakt") return <TraktMark className={className} />;
	return (
		<Popcorn
			aria-hidden="true"
			className={`text-(--accent) ${className ?? ""}`}
		/>
	);
}
