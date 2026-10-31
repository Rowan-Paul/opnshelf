import { Button } from "#/components/ui/button";

type PermissionAction = "connect" | "disconnect";

/**
 * Connect or disconnect one External Integration. The press goes straight to
 * the Permission Explainer, which says what changes before leaving for the
 * Account Host.
 */
export function IntegrationPermissionRow({
	name,
	description,
	connected,
	disabled = false,
	onRequest,
}: {
	name: string;
	description: string;
	connected: boolean;
	disabled?: boolean;
	onRequest: (action: PermissionAction) => void;
}) {
	return (
		<div className="flex items-center justify-between gap-4 pb-4">
			<div className="min-w-0">
				{connected && (
					<p className="text-(--foreground-muted) text-sm">Connected</p>
				)}
				{disabled && !connected && (
					<p className="text-(--foreground-muted) text-sm">{description}</p>
				)}
			</div>
			<Button
				type="button"
				aria-label={`${connected ? "Disconnect" : "Connect"} ${name}`}
				// A faded primary button loses the contrast between the amber fill
				// and its dark label, so the disabled state uses a muted fill.
				variant={disabled ? "secondary" : connected ? "outline" : "default"}
				disabled={disabled}
				onClick={() => onRequest(connected ? "disconnect" : "connect")}
			>
				{connected ? "Disconnect" : "Connect"}
			</Button>
		</div>
	);
}
