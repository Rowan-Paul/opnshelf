import type { WatchProviderDto } from "@opnshelf/api";
import { useState } from "react";
import { COUNTRY_NAMES, SORTED_COUNTRIES } from "#/lib/countries";

interface WatchProviderDtosProps {
	providers:
		| {
				link?: string;
				flatrate?: WatchProviderDto[];
				rent?: WatchProviderDto[];
				buy?: WatchProviderDto[];
				ads?: WatchProviderDto[];
				free?: WatchProviderDto[];
		  }
		| null
		| undefined;
	availableCountries?: string[];
	country: string;
	onCountryChange: (country: string) => void;
}

const PROVIDER_LOGO_BASE = "https://image.tmdb.org/t/p/original";

function ProviderChip({
	provider,
	link,
}: {
	provider: WatchProviderDto;
	link?: string;
}) {
	const img = (
		<div className="flex flex-col items-center gap-1.5">
			<div className="size-10 overflow-hidden rounded-xl border border-(--border) shadow-sm">
				<img
					src={`${PROVIDER_LOGO_BASE}${provider.logo_path}`}
					alt={provider.provider_name}
					className="size-full object-cover"
					loading="lazy"
				/>
			</div>
			<span className="max-w-[60px] text-center text-(--foreground-muted) text-[10px] leading-tight">
				{provider.provider_name}
			</span>
		</div>
	);

	if (link) {
		return (
			<a
				href={link}
				target="_blank"
				rel="noopener noreferrer"
				className="group transition-transform hover:-translate-y-0.5"
				title={provider.provider_name}
			>
				{img}
			</a>
		);
	}
	return img;
}

function ProviderGroup({
	label,
	providers,
	link,
}: {
	label: string;
	providers: WatchProviderDto[];
	link?: string;
}) {
	if (!providers.length) return null;
	const sorted = [...providers].sort(
		(a, b) => a.display_priority - b.display_priority,
	);
	return (
		<div className="space-y-2">
			<p className="font-semibold text-(--foreground-subtle) text-[11px] uppercase tracking-widest">
				{label}
			</p>
			<div className="flex flex-wrap gap-3">
				{sorted.map((p) => (
					<ProviderChip key={p.provider_id} provider={p} link={link} />
				))}
			</div>
		</div>
	);
}

export default function WatchProviderDtos({
	providers,
	availableCountries = [],
	country,
	onCountryChange,
}: WatchProviderDtosProps) {
	const [showCountryPicker, setShowCountryPicker] = useState(false);
	const [showRentBuy, setShowRentBuy] = useState(false);

	const hasAny =
		providers &&
		(providers.flatrate?.length ||
			providers.rent?.length ||
			providers.buy?.length ||
			providers.ads?.length ||
			providers.free?.length);

	const availableSet = new Set(availableCountries);
	const sortedCountries = SORTED_COUNTRIES.filter(([code]) =>
		availableSet.has(code),
	);

	return (
		<section className="card p-5">
			<div className="mb-4 flex items-center justify-between">
				<h3 className="font-display font-semibold">Where to Watch</h3>
				{availableCountries.length > 1 && (
					<div className="relative">
						<button
							type="button"
							onClick={() => setShowCountryPicker((v) => !v)}
							className="flex items-center gap-1 rounded-md px-2 py-1 font-medium text-(--foreground-muted) text-xs transition-colors hover:bg-(--background-subtle) hover:text-(--foreground)"
						>
							<span>{COUNTRY_NAMES[country] ?? country}</span>
							<svg
								aria-hidden="true"
								className={`size-3 transition-transform ${showCountryPicker ? "rotate-180" : ""}`}
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2.5}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M19 9l-7 7-7-7"
								/>
							</svg>
						</button>
						{showCountryPicker && (
							<div className="absolute top-full right-0 z-50 mt-1 max-h-48 w-44 overflow-y-auto rounded-lg border border-(--border) bg-(--background-elevated) py-1 shadow-lg">
								{sortedCountries.map(([code, name]) => (
									<button
										key={code}
										type="button"
										onClick={() => {
											onCountryChange(code);
											setShowCountryPicker(false);
										}}
										className={`w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-(--background-subtle) ${
											code === country
												? "font-semibold text-(--accent)"
												: "text-(--foreground)"
										}`}
									>
										{name}
									</button>
								))}
							</div>
						)}
					</div>
				)}
			</div>

			{!providers ? (
				<p className="text-(--foreground-muted) text-sm">
					No streaming information available.
				</p>
			) : !hasAny ? (
				<p className="text-(--foreground-muted) text-sm">
					Not available for streaming in {COUNTRY_NAMES[country] ?? country}.
				</p>
			) : (
				<div className="space-y-4">
					<ProviderGroup
						label="Stream"
						providers={providers.flatrate ?? []}
						link={providers.link}
					/>
					<ProviderGroup
						label="Free"
						providers={[...(providers.free ?? []), ...(providers.ads ?? [])]}
						link={providers.link}
					/>
					{((providers.rent?.length ?? 0) > 0 ||
						(providers.buy?.length ?? 0) > 0) && (
						<div>
							<button
								type="button"
								onClick={() => setShowRentBuy((v) => !v)}
								className="flex items-center gap-1 font-semibold text-(--foreground-subtle) text-[11px] uppercase tracking-widest transition-colors hover:text-(--foreground-muted)"
							>
								<svg
									aria-hidden="true"
									className={`size-3 transition-transform ${showRentBuy ? "rotate-90" : ""}`}
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={2.5}
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M9 5l7 7-7 7"
									/>
								</svg>
								Rent & Buy
							</button>
							{showRentBuy && (
								<div className="mt-3 space-y-4">
									<ProviderGroup
										label="Rent"
										providers={providers.rent ?? []}
										link={providers.link}
									/>
									<ProviderGroup
										label="Buy"
										providers={providers.buy ?? []}
										link={providers.link}
									/>
								</div>
							)}
						</div>
					)}
				</div>
			)}

			<p className="mt-4 text-(--foreground-subtle) text-[10px]">
				Streaming data provided by{" "}
				<a
					href="https://www.justwatch.com"
					target="_blank"
					rel="noopener noreferrer"
					className="underline hover:text-(--foreground-muted)"
				>
					JustWatch
				</a>
			</p>
		</section>
	);
}
