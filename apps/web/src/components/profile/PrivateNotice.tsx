import { Lock } from "lucide-react";

/**
 * Shown to visitors in place of a profile section the owner keeps private
 * ("Watches are private."). Mobile uses EmptyState's card with the same icon.
 */
export function PrivateNotice({ message }: { message: string }) {
	return (
		<div className="card p-8 text-center">
			<Lock
				className="mx-auto mb-3 size-8 text-(--foreground-muted)"
				aria-hidden="true"
			/>
			<p className="text-(--foreground-muted)">{message}</p>
		</div>
	);
}
