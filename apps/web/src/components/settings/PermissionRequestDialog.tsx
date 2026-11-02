import {
	PERMISSION_REQUEST_COPY,
	PERMISSION_REQUEST_NOTES,
	type PermissionRequestIntegration,
} from "@opnshelf/api";
import { Check, ExternalLink, Laptop, X } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";

/**
 * Shown before leaving for the account host's consent screen, so the User
 * knows what they are about to approve and that they will come back here.
 */
export function PermissionRequestDialog({
	integration,
	open,
	pending = false,
	onCancel,
	onContinue,
}: {
	integration: PermissionRequestIntegration;
	open: boolean;
	pending?: boolean;
	onCancel: () => void;
	onContinue: () => void;
}) {
	const copy = PERMISSION_REQUEST_COPY[integration];

	return (
		<Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{copy.title}</DialogTitle>
					<DialogDescription>{PERMISSION_REQUEST_NOTES.host}</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 sm:grid-cols-2">
					<div>
						<p className="mb-1 font-medium text-sm">Opnshelf will be able to</p>
						<ul className="space-y-1 text-sm">
							{copy.can.map((line) => (
								<li key={line} className="flex gap-2">
									<Check className="mt-0.5 size-4 shrink-0 text-success" />
									{line}
								</li>
							))}
						</ul>
					</div>
					<div>
						<p className="mb-1 font-medium text-sm">It still can't</p>
						<ul className="space-y-1 text-(--foreground-muted) text-sm">
							{copy.cannot.map((line) => (
								<li key={line} className="flex gap-2">
									<X className="mt-0.5 size-4 shrink-0" />
									{line}
								</li>
							))}
						</ul>
					</div>
				</div>
				<p className="flex items-center gap-2 text-(--foreground-muted) text-xs">
					<Laptop className="size-4 shrink-0" />
					{PERMISSION_REQUEST_NOTES.devices}
				</p>
				<DialogFooter>
					<Button type="button" variant="outline" onClick={onCancel}>
						Not now
					</Button>
					<Button type="button" disabled={pending} onClick={onContinue}>
						Continue
						<ExternalLink />
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
