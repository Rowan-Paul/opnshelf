import { AlertTriangle, type LucideIcon } from "lucide-react";

/**
 * Icon-and-text card for an empty or failed list (profile Notes, Reviews).
 * The Web counterpart of Mobile's `EmptyState` / `ErrorState`: the error
 * variant swaps in a destructive warning icon and announces itself.
 */
export function ContentState({
	icon: Icon,
	message,
	variant = "empty",
}: {
	icon?: LucideIcon;
	message: string;
	variant?: "empty" | "error";
}) {
	const isError = variant === "error";
	const StateIcon = isError ? AlertTriangle : Icon;
	return (
		<div
			role={isError ? "alert" : undefined}
			className="card flex flex-col items-center gap-3 p-8 text-center"
		>
			{StateIcon && (
				<StateIcon
					aria-hidden
					className={`size-10 ${isError ? "text-destructive" : "text-(--foreground-muted)"}`}
				/>
			)}
			<p className="text-(--foreground-muted)">{message}</p>
		</div>
	);
}
