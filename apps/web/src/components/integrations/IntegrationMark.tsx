import type { IntegrationId } from "@opnshelf/api";
import { TraktMark } from "#/components/TraktMark";

/**
 * Each provider keeps its own logo. Popfeed publishes no brand kit; its mark is
 * the avatar of its official @popfeed.social account, shown unaltered.
 */
export function IntegrationMark({
	id,
	className,
}: {
	id: IntegrationId;
	className?: string;
}) {
	if (id === "trakt") return <TraktMark className={className} />;
	if (id === "bingers")
		return (
			<span
				aria-hidden="true"
				className={`inline-flex items-center justify-center rounded-xl bg-muted font-bold ${className ?? ""}`}
			>
				B
			</span>
		);
	return (
		<img
			src="/integrations/popfeed.png"
			alt=""
			aria-hidden="true"
			className={`rounded-[22%] ${className ?? ""}`}
		/>
	);
}
