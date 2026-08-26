import { reviewsControllerListMyPublicationsOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BookOpen } from "lucide-react";
import { useState } from "react";
import { IntegrationPermissionRow } from "#/components/settings/IntegrationPermissionRow";
import { RowListSkeleton } from "#/components/skeletons";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { useAuth } from "#/lib/auth-context";
import {
	usePermissionChange,
	useUpdateSettings,
} from "./use-settings-mutations";

type PublicationService = "leaflet" | "offprint" | "pckt" | "unknown";

const SERVICES = {
	leaflet: { label: "Leaflet", article: "a" },
	offprint: { label: "Offprint", article: "an" },
	pckt: { label: "Pckt", article: "a" },
} as const;

/**
 * Reviews publication (#118). The live picker — not the cached setting — is the
 * source of truth at selection time; the user can only pick a publication that
 * exists in their own PDS.
 */
export function BlogMirrorSection() {
	const { userSettings, isAuthenticated } = useAuth();
	const updateSettingsMutation = useUpdateSettings();
	const { requestPermissionChange, isPending: permissionChangePending } =
		usePermissionChange();

	const {
		data: myPublications,
		isLoading: publicationsLoading,
		isError: publicationsError,
	} = useQuery({
		...reviewsControllerListMyPublicationsOptions(),
		enabled: isAuthenticated,
	});

	// The currently-stored target URI (null = no blog mirror).
	const storedPublicationUri = userSettings?.reviewsPublicationUri ?? null;
	const [pendingPublication, setPendingPublication] = useState<{
		uri: string;
		name: string;
		url: string;
		service: PublicationService;
	} | null>(null);
	const [leafletRejected, setLeafletRejected] = useState(false);
	const [fallbackService, setFallbackService] =
		useState<PublicationService>("unknown");
	const pendingService = leafletRejected
		? fallbackService
		: (pendingPublication?.service ?? "unknown");
	const requiresServiceChoice =
		leafletRejected || pendingPublication?.service === "unknown";
	const recognised =
		pendingService === "unknown" ? null : SERVICES[pendingService];

	const resetPendingPublication = () => {
		setPendingPublication(null);
		setLeafletRejected(false);
		setFallbackService("unknown");
	};

	const confirmPublicationService = () => {
		if (!pendingPublication) return;
		updateSettingsMutation.mutate({
			body: {
				reviewsPublicationUri: pendingPublication.uri,
				reviewsMirrorFormat:
					pendingService === "unknown" ? "markdown" : pendingService,
			},
		});
		resetPendingPublication();
	};

	// D7 soft warning: the stored target is no longer present in the live list.
	const storedTargetMissing =
		storedPublicationUri !== null &&
		!publicationsLoading &&
		!publicationsError &&
		!myPublications?.items.some((pub) => pub.uri === storedPublicationUri);

	return (
		<>
			<section
				id="blog-mirror"
				className="scroll-mt-24 border-(--border) border-b p-5 sm:p-7"
			>
				<div className="mb-1 flex items-center gap-2">
					<BookOpen className="size-5 text-(--accent)" />
					<h2 className="font-semibold text-lg">Blog mirror</h2>
				</div>
				<p className="mb-6 text-(--foreground-muted) text-sm">
					Your reviews always live on Opnshelf. Optionally, mirror new reviews
					to one of your own blogs as well.
				</p>

				<IntegrationPermissionRow
					name="Blog mirroring"
					description={
						storedPublicationUri
							? "Allow Opnshelf to publish and update review mirrors in the selected publication."
							: "Choose a publication below before connecting Blog mirroring."
					}
					connected={userSettings?.blogIntegrationEnabled ?? false}
					disabled={
						permissionChangePending ||
						(!(userSettings?.blogIntegrationEnabled ?? false) &&
							!storedPublicationUri)
					}
					onConfirm={(action) => requestPermissionChange("blog", action)}
				/>

				{storedTargetMissing && (
					<div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-800 text-sm dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
						<AlertTriangle className="mt-0.5 size-4 shrink-0" />
						<span>
							Your selected publication is no longer available on your account.
							New reviews still point at it, but you may want to choose another
							below.
						</span>
					</div>
				)}

				{publicationsLoading ? (
					<RowListSkeleton rows={3} />
				) : publicationsError ? (
					<p className="text-(--foreground-muted) text-sm">
						Could not load your publications right now.
					</p>
				) : (
					<fieldset
						className="space-y-2"
						disabled={updateSettingsMutation.isPending}
					>
						{(myPublications?.items ?? []).map((pub) => (
							<label
								key={pub.uri}
								className="flex cursor-pointer items-center justify-between rounded-lg border border-(--border) p-3 transition-colors hover:border-(--accent) has-checked:border-(--accent) has-checked:bg-(--accent-subtle)"
							>
								<div className="flex items-center gap-3">
									<input
										type="radio"
										name="reviews-publication"
										className="size-4 accent-(--accent)"
										checked={storedPublicationUri === pub.uri}
										onChange={() => {
											setPendingPublication({
												uri: pub.uri,
												name: pub.name,
												url: pub.url,
												service: pub.service,
											});
											setLeafletRejected(false);
											setFallbackService("unknown");
										}}
									/>
									<div>
										<p className="font-medium text-sm">{pub.name}</p>
										<p className="text-(--foreground-muted) text-xs">
											{pub.url}
										</p>
									</div>
								</div>
							</label>
						))}
						<p className="pt-1 text-(--foreground-muted) text-xs">
							Disconnect above to stop mirroring. Your publication choice stays
							saved for reconnection.
						</p>
					</fieldset>
				)}
			</section>

			<Dialog
				open={pendingPublication !== null}
				onOpenChange={(open) => {
					if (!open) resetPendingPublication();
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{requiresServiceChoice
								? "Choose the publication service"
								: recognised
									? `Is this ${recognised.article} ${recognised.label} publication?`
									: "Which service runs this publication?"}
						</DialogTitle>
						<DialogDescription>
							{requiresServiceChoice
								? "Select the service you use. If it isn't listed, we'll still mirror your reviews, but they may not display as expected."
								: recognised
									? `We recognised ${pendingPublication?.name} as ${recognised.label}. Confirm to mirror your reviews there.`
									: "We couldn't recognise the service behind this publication. We'll still mirror your reviews, but they may not display as expected."}
						</DialogDescription>
					</DialogHeader>
					{requiresServiceChoice && (
						<div className="grid gap-2 text-sm">
							<span className="font-medium">Service</span>
							<Select
								value={fallbackService}
								onValueChange={(value) =>
									setFallbackService(value as PublicationService)
								}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Choose a service" />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										<SelectItem value="leaflet">Leaflet</SelectItem>
										<SelectItem value="offprint">Offprint</SelectItem>
										<SelectItem value="pckt">Pckt</SelectItem>
										<SelectItem value="unknown">Other or unknown</SelectItem>
									</SelectGroup>
								</SelectContent>
							</Select>
						</div>
					)}
					<div className="flex justify-end gap-3">
						<Button variant="outline" onClick={resetPendingPublication}>
							Cancel
						</Button>
						{recognised && !requiresServiceChoice && (
							<Button
								variant="outline"
								onClick={() => setLeafletRejected(true)}
							>
								No, it isn't {recognised.label}
							</Button>
						)}
						<Button onClick={confirmPublicationService}>
							{recognised ? `Yes, this is ${recognised.label}` : "Continue"}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
