import type { IntegrationId } from "@opnshelf/api";
import { TraktMark } from "#/components/TraktMark";

/**
 * Each provider keeps its own logo. Popfeed publishes no brand kit; its mark is
 * the avatar of its official @popfeed.social account, shown unaltered. Bingers'
 * mark is the app icon it serves at bingers.app/apple-touch-icon.png.
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
		<img
			src={`/integrations/${id}.png`}
			alt=""
			aria-hidden="true"
			className={`rounded-[22%] ${className ?? ""}`}
		/>
	);
}
