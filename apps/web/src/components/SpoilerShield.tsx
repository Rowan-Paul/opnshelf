import { AlertTriangle } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useAuth } from "#/lib/auth-context";

interface SpoilerShieldProps {
	/** Author-declared Spoiler Flag (ADR-0016): the wrapped body contains spoilers. */
	spoiler: boolean;
	/** DID of the review's author, so they never see a shield on their own review. */
	authorDid?: string;
	children: ReactNode;
}

/**
 * The reader-facing Spoiler Shield: covers a flagged review's body behind a
 * tap-to-reveal cover. Never shields the author's own review, and is
 * suppressed entirely by the "always show spoiler content" setting.
 * Logged-out viewers always get the shield. Reveals are ephemeral — nothing
 * is persisted, so the cover is back on the next full render.
 */
export function SpoilerShield({
	spoiler,
	authorDid,
	children,
}: SpoilerShieldProps) {
	const { user, userSettings } = useAuth();
	const [revealed, setRevealed] = useState(false);

	const isAuthor = !!user && !!authorDid && user.did === authorDid;
	const alwaysShowSpoilers = userSettings?.alwaysShowSpoilers ?? false;
	const shielded = spoiler && !isAuthor && !alwaysShowSpoilers;

	if (!shielded || revealed) {
		return <>{children}</>;
	}

	return (
		<div className="flex items-center justify-between gap-3 rounded-lg border border-(--border) bg-(--background-subtle) p-3 text-sm">
			<span className="flex items-center gap-2 text-(--foreground-muted)">
				<AlertTriangle className="size-4 shrink-0" />
				Contains spoilers
			</span>
			<button
				type="button"
				onClick={() => setRevealed(true)}
				className="btn btn-secondary btn-sm shrink-0"
			>
				Show
			</button>
		</div>
	);
}
