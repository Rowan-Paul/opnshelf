import {
	INTEGRATIONS,
	integrationKey,
	integrationStatusLabel,
} from "@opnshelf/api";
import { useQueries } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { IntegrationMark } from "#/components/integrations/IntegrationMark";

export function IntegrationsSection() {
	const statuses = useQueries({
		queries: INTEGRATIONS.map((integration) => ({
			queryKey: [...integrationKey(integration), "status"],
			queryFn: ({ signal }: { signal: AbortSignal }) =>
				integration.api.status(signal),
		})),
	});
	return (
		<section aria-label="Integrations">
			{INTEGRATIONS.map((integration, index) => {
				const status = statuses[index];
				return (
					<Link
						key={integration.id}
						to="/integrations/$provider"
						params={{ provider: integration.id }}
						className={`group flex items-center gap-4 p-5 transition-colors hover:bg-(--background-subtle) focus-visible:outline-none focus-visible:ring-(--accent) focus-visible:ring-2 sm:p-7 ${
							index > 0 ? "border-(--border) border-t" : ""
						}`}
					>
						<span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-(--background-subtle)">
							<IntegrationMark id={integration.id} className="size-6" />
						</span>
						<span className="min-w-0 flex-1">
							<span className="flex flex-wrap items-center gap-x-3 gap-y-1">
								<span className="font-semibold">{integration.name}</span>
								{status.data ? (
									<span className="text-(--foreground-muted) text-sm">
										{integrationStatusLabel(status.data)}
									</span>
								) : status.isPending ? (
									<span
										aria-hidden="true"
										className="inline-block h-4 w-24 animate-pulse rounded bg-(--background-subtle)"
									/>
								) : null}
							</span>
							<span className="mt-0.5 block text-(--foreground-muted) text-sm">
								{integration.summary}
							</span>
						</span>
						<ChevronRight className="size-5 shrink-0 text-(--foreground-muted) transition-transform group-hover:translate-x-0.5" />
					</Link>
				);
			})}
		</section>
	);
}
