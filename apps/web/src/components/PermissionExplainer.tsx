import {
	accountHostName,
	PERMISSION_DEVICES_NOTICE,
	type PermissionExplainerAction,
	type PermissionIntegration,
	permissionExplainer,
} from "@opnshelf/api";
import { Check, ExternalLink, Laptop, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";

type ExplainerRequest = {
	integration: PermissionIntegration;
	action: PermissionExplainerAction;
	/** Creates the authorization request; resolves with the URL to open. */
	start: () => Promise<string>;
};

type ExplainerState = {
	id: number;
	integration: PermissionIntegration;
	action: PermissionExplainerAction;
	url: string;
};

/**
 * Explain a permission change before leaving for the Account Host.
 *
 * `request` creates the authorization request first, so the dialog names the
 * real Account Host and a request the backend refuses (no Bluesky profile,
 * say) fails before anything opens. It resolves with the URL to open once the
 * User continues, or null when they back out, and rejects when the request
 * can't be made. Callers show their own pending state until it opens.
 */
export function usePermissionExplainer() {
	const [state, setState] = useState<ExplainerState | null>(null);
	const pending = useRef<{
		id: number;
		resolve: (url: string | null) => void;
	} | null>(null);
	const nextId = useRef(0);

	const settle = useCallback((id: number, url: string | null) => {
		if (pending.current?.id !== id) return;
		const { resolve } = pending.current;
		pending.current = null;
		setState(null);
		resolve(url);
	}, []);

	const request = useCallback(
		({ integration, action, start }: ExplainerRequest) =>
			new Promise<string | null>((resolve, reject) => {
				const id = ++nextId.current;
				if (pending.current) settle(pending.current.id, null);
				pending.current = { id, resolve };
				start().then(
					(url) => {
						if (pending.current?.id === id)
							setState({ id, integration, action, url });
					},
					(error: unknown) => {
						if (pending.current?.id !== id) return;
						pending.current = null;
						reject(error);
					},
				);
			}),
		[settle],
	);

	const dialog = (
		<PermissionExplainerDialog
			state={state}
			onCancel={() => state && settle(state.id, null)}
			onContinue={() => state && settle(state.id, state.url)}
		/>
	);

	return { request, dialog };
}

function PermissionExplainerDialog({
	state,
	onCancel,
	onContinue,
}: {
	state: ExplainerState | null;
	onCancel: () => void;
	onContinue: () => void;
}) {
	// Keep the last copy while the dialog animates out.
	const shown = useRef<ExplainerState | null>(null);
	if (state) shown.current = state;
	const current = state ?? shown.current;
	if (!current) return null;

	const copy = permissionExplainer(current.integration, current.action);
	const host = accountHostName(current.url);

	return (
		<Dialog open={state !== null} onOpenChange={(open) => !open && onCancel()}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{copy.title}</DialogTitle>
					<DialogDescription>
						{host ? (
							<span className="font-medium text-(--foreground)">{host}</span>
						) : (
							"The service that"
						)}{" "}
						hosts your account, so it asks you to approve this change, not
						Opnshelf.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 sm:grid-cols-2">
					<div>
						<p className="mb-1.5 font-medium text-sm">{copy.canHeading}</p>
						<ul className="space-y-1.5 text-sm">
							{copy.can.map((line) => (
								<li key={line} className="flex gap-2">
									<Check className="mt-0.5 size-4 shrink-0 text-success" />
									{line}
								</li>
							))}
						</ul>
					</div>
					<div>
						<p className="mb-1.5 font-medium text-sm">{copy.cannotHeading}</p>
						<ul className="space-y-1.5 text-(--foreground-muted) text-sm">
							{copy.cannot.map((line) => (
								<li key={line} className="flex gap-2">
									{current.action === "connect" ? (
										<X className="mt-0.5 size-4 shrink-0" />
									) : (
										<Check className="mt-0.5 size-4 shrink-0" />
									)}
									{line}
								</li>
							))}
						</ul>
					</div>
				</div>
				{copy.note && (
					<p className="text-(--foreground-muted) text-sm">{copy.note}</p>
				)}
				<p className="flex items-center gap-2 text-(--foreground-muted) text-xs">
					<Laptop className="size-4 shrink-0" />
					{PERMISSION_DEVICES_NOTICE}
				</p>
				<DialogFooter>
					<Button type="button" variant="outline" onClick={onCancel}>
						Not now
					</Button>
					<Button
						type="button"
						variant={
							current.action === "disconnect" ? "destructive" : "default"
						}
						onClick={onContinue}
					>
						{host ? `Continue to ${host}` : "Continue"}
						<ExternalLink />
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
