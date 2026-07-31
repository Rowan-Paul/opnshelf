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
	onConfirm,
}: {
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
			<div className="flex items-center justify-between gap-4 rounded-lg border border-(--border) p-3">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<p className="font-medium text-sm">{name}</p>
						<span
							className={
								connected
									? "rounded-full bg-emerald-500/12 px-2 py-0.5 font-medium text-emerald-700 text-xs dark:text-emerald-300"
									: "rounded-full bg-(--background-subtle) px-2 py-0.5 font-medium text-(--foreground-muted) text-xs"
							}
						>
							{connected ? "Connected" : "Not connected"}
						</span>
					</div>
					<p className="mt-1 text-(--foreground-muted) text-sm">
						{description}
					</p>
				</div>
				<Button
					type="button"
					variant={connected ? "outline" : "default"}
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
						<DialogDescription>
							Other devices will need to sign in again after this permission
							change. Your saved publication and format choices stay in place.
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
