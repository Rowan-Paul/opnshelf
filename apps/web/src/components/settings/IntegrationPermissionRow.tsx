import { useState } from "react";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";

type PermissionAction = "connect" | "disconnect";

export function IntegrationPermissionRow({
	name,
	description,
	connected,
	disabled = false,
	confirmationDescription = "Other devices will need to sign in again after this permission change. Your saved publication and format choices stay in place.",
	onConfirm,
}: {
	name: string;
	description: string;
	connected: boolean;
	disabled?: boolean;
	confirmationDescription?: string;
	onConfirm: (action: PermissionAction) => void;
}) {
	const [pendingAction, setPendingAction] = useState<PermissionAction | null>(
		null,
	);
	const action: PermissionAction = connected ? "disconnect" : "connect";

	return (
		<>
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
					// A faded primary button loses the contrast between the amber fill
					// and its dark label, so the disabled state uses a muted fill.
					variant={disabled ? "secondary" : connected ? "outline" : "default"}
					disabled={disabled}
					onClick={() => setPendingAction(action)}
				>
					{connected ? "Disconnect" : "Connect"}
				</Button>
			</div>

			<Dialog
				open={pendingAction !== null}
				onOpenChange={(open) => !open && setPendingAction(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{pendingAction === "disconnect"
								? `Disconnect ${name}?`
								: `Connect ${name}?`}
						</DialogTitle>
						<DialogDescription>{confirmationDescription}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setPendingAction(null)}
						>
							Cancel
						</Button>
						<Button
							type="button"
							variant={
								pendingAction === "disconnect" ? "destructive" : "default"
							}
							onClick={() => {
								if (!pendingAction) return;
								const confirmedAction = pendingAction;
								setPendingAction(null);
								onConfirm(confirmedAction);
							}}
						>
							Continue and {pendingAction}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
