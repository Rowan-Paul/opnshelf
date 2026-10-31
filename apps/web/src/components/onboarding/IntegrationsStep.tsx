import {
	INTEGRATIONS,
	type IntegrationDefinition,
	type IntegrationId,
	integrationKey,
	onboardingIntegrationAction,
	onboardingIntegrationsCopy,
	type SyncStatusDto,
	traktError,
} from "@opnshelf/api";
import {
	type UseQueryResult,
	useMutation,
	useQueries,
	useQueryClient,
} from "@tanstack/react-query";
import { ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import { IntegrationMark } from "#/components/integrations/IntegrationMark";
import { SyncSettings } from "#/components/integrations/IntegrationSyncManager";

/**
 * Offers every Integration in one onboarding step. Each row connects or sets
 * up its Integration, then opens the same settings as Settings › Integrations.
 */
export function IntegrationsStep({
	onNext,
	initialOpen = null,
	connectionFailed = null,
}: {
	onNext: () => void;
	/** The Integration to open, when onboarding resumes after leaving for it. */
	initialOpen?: IntegrationId | null;
	/** The Integration whose connection just failed. */
	connectionFailed?: IntegrationId | null;
}) {
	const statuses = useQueries({
		queries: INTEGRATIONS.map((integration) => ({
			queryKey: [...integrationKey(integration), "status"],
			queryFn: ({ signal }: { signal: AbortSignal }) =>
				integration.api.status(signal),
		})),
	});
	const [open, setOpen] = useState<IntegrationId | null>(initialOpen);
	const copy = onboardingIntegrationsCopy();
	const anyOn = statuses.some(
		({ data }) => data?.status === "active" || data?.status === "preparing",
	);
	return (
		<div className="card p-6">
			<h2 className="text-display-3">{copy.title}</h2>
			<p className="mt-1 mb-5 text-(--foreground-muted) text-sm">{copy.body}</p>
			<ul className="divide-y divide-(--border) rounded-xl border border-(--border)">
				{INTEGRATIONS.map((integration, index) => (
					<IntegrationRow
						key={integration.id}
						integration={integration}
						status={statuses[index]}
						open={open === integration.id}
						onOpen={() => setOpen(integration.id)}
						onClose={() => setOpen(null)}
						connectionFailed={connectionFailed === integration.id}
					/>
				))}
			</ul>
			<div className="mt-5 flex items-center justify-between gap-3">
				<p className="text-(--foreground-subtle) text-xs">{copy.later}</p>
				{anyOn ? (
					<button type="button" onClick={onNext} className="btn btn-primary">
						Continue
						<ArrowRight className="size-4" />
					</button>
				) : (
					<button
						type="button"
						onClick={onNext}
						className="shrink-0 text-(--foreground-muted) text-sm hover:text-(--foreground)"
					>
						Skip
					</button>
				)}
			</div>
		</div>
	);
}

function IntegrationRow({
	integration,
	status,
	open,
	onOpen,
	onClose,
	connectionFailed,
}: {
	integration: IntegrationDefinition;
	status: UseQueryResult<SyncStatusDto>;
	open: boolean;
	onOpen: () => void;
	onClose: () => void;
	connectionFailed: boolean;
}) {
	const queryClient = useQueryClient();
	const refresh = () =>
		queryClient.invalidateQueries({ queryKey: integrationKey(integration) });
	const connect = useMutation({
		mutationKey: [...integrationKey(integration), "connect"],
		mutationFn: integration.api.connect,
		onSuccess: async (result) => {
			if (result.url) return window.location.assign(result.url);
			await refresh();
			onOpen();
		},
	});
	const data = status.data;
	const action = data && onboardingIntegrationAction(integration, data);
	const handle =
		data?.username && action?.kind !== "connect" ? `@${data.username}` : null;
	return (
		<li className="p-4">
			<div className="flex items-center gap-3">
				<span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-(--background-subtle)">
					<IntegrationMark id={integration.id} className="size-6" />
				</span>
				<div className="min-w-0 flex-1">
					<p className="font-semibold">{integration.name}</p>
					<p className="text-(--foreground-muted) text-sm">
						{handle ? `${handle} · ` : ""}
						{integration.summary}
					</p>
				</div>
				{!action ? (
					!status.isError && (
						<span
							aria-hidden="true"
							className="h-9 w-28 shrink-0 animate-pulse rounded-lg bg-(--background-subtle)"
						/>
					)
				) : action.kind === "on" ? (
					<span className="flex shrink-0 items-center gap-1 font-medium text-sm text-success">
						<Check className="size-4" />
						On
					</span>
				) : action.kind === "unavailable" ? (
					<span className="shrink-0 text-(--foreground-muted) text-sm">
						Unavailable
					</span>
				) : action.kind === "connect" ? (
					<button
						type="button"
						className="btn btn-secondary shrink-0"
						disabled={connect.isPending}
						onClick={() =>
							connect.mutate({ platform: "web", returnTo: "onboarding" })
						}
					>
						{connect.isPending ? action.pending : action.label}
					</button>
				) : (
					!open && (
						<button
							type="button"
							className="btn btn-secondary shrink-0"
							onClick={onOpen}
						>
							{action.label}
						</button>
					)
				)}
			</div>
			{(status.isError || connect.error || connectionFailed) && (
				<p role="alert" className="mt-3 text-(--destructive) text-sm">
					{status.isError
						? traktError(status.error)
						: connect.error
							? traktError(connect.error)
							: `${integration.name} could not connect. Try connecting again.`}
				</p>
			)}
			{open && data && action?.kind === "choose" && (
				<SyncSettings
					key={data.username}
					integration={integration}
					status={data}
					onSaved={() => {
						void refresh();
						onClose();
					}}
					onCancel={onClose}
					onboarding
					className=""
					showHeading={false}
				/>
			)}
		</li>
	);
}
