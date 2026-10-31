import {
	PERMISSION_DISCONNECT_DESCRIPTION,
	type PermissionRequestIntegration,
} from "@opnshelf/api";
import { useState } from "react";
import { PermissionRequestDialog } from "#/components/settings/PermissionRequestDialog";
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
	integration,
	name,
	description,
	connected,
	disabled = false,
	onConfirm,
}: {
	integration: PermissionRequestIntegration;
	name: string;
	description: string;
	connected: boolean;
	disabled?: boolean;
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

			<PermissionRequestDialog
				integration={integration}
				open={pendingAction === "connect"}
				onCancel={() => setPendingAction(null)}
				onContinue={() => {
					setPendingAction(null);
					onConfirm("connect");
				}}
			/>

			<Dialog
				open={pendingAction === "disconnect"}
				onOpenChange={(open) => !open && setPendingAction(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Disconnect {name}?</DialogTitle>
						<DialogDescription>
							{PERMISSION_DISCONNECT_DESCRIPTION}
						</DialogDescription>
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
							variant="destructive"
							onClick={() => {
								setPendingAction(null);
								onConfirm("disconnect");
							}}
						>
							Continue and disconnect
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
