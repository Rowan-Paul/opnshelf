import { useLocation } from "@tanstack/react-router";
import { ArrowLeft, Clapperboard, Home, Search } from "lucide-react";
import * as React from "react";
import { M3Button } from "@/components/ui/m3-button";
import {
	M3Card,
	M3CardContent,
	M3CardDescription,
	M3CardHeader,
	M3CardTitle,
} from "@/components/ui/m3-card";

export function NotFoundPage() {
	const location = useLocation();
	const [canGoBack, setCanGoBack] = React.useState(false);

	React.useEffect(() => {
		setCanGoBack(window.history.length > 1);
	}, []);

	return (
		<section className="relative isolate flex flex-1 items-center overflow-hidden">
			<div
				className="pointer-events-none absolute inset-0"
				style={{
					background:
						"radial-gradient(circle at top left, rgba(243, 188, 0, 0.16), transparent 34%), radial-gradient(circle at bottom right, rgba(243, 188, 0, 0.1), transparent 28%)",
				}}
			/>

			<div className="container relative mx-auto flex w-full max-w-6xl flex-1 px-4 py-12 md:py-20">
				<div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
					<div className="max-w-2xl">
						<div
							className="mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-2"
							style={{
								backgroundColor: "rgba(243, 188, 0, 0.1)",
								borderColor: "rgba(243, 188, 0, 0.24)",
								color: "var(--md-sys-color-primary)",
							}}
						>
							<Clapperboard className="size-4" />
							<span className="md-label-large">404 · Route not found</span>
						</div>

						<h1 className="md-display-small mb-4 max-w-xl">
							This page slipped out of the release schedule.
						</h1>

						<p
							className="md-title-large max-w-xl"
							style={{ color: "var(--md-sys-color-on-surface-variant)" }}
						>
							The URL you opened does not exist on OpnShelf, or it may have
							moved somewhere else in the app.
						</p>

						<div className="mt-8 flex flex-wrap gap-3">
							<M3Button variant="filled" size="lg" asChild>
								<a href="/">
									<Home className="size-5" />
									Go home
								</a>
							</M3Button>

							<M3Button variant="outlined" size="lg" asChild>
								<a href="/search?q=&type=all">
									<Search className="size-5" />
									Open search
								</a>
							</M3Button>

							{canGoBack ? (
								<M3Button
									variant="text"
									size="lg"
									type="button"
									onClick={() => window.history.back()}
								>
									<ArrowLeft className="size-5" />
									Go back
								</M3Button>
							) : null}
						</div>

						<div
							className="mt-6 inline-flex max-w-full items-center gap-2 rounded-2xl border px-4 py-3"
							style={{
								backgroundColor: "var(--md-sys-color-surface-container-low)",
								borderColor: "var(--md-sys-color-outline-variant)",
							}}
						>
							<span
								className="md-label-medium uppercase tracking-[0.18em]"
								style={{ color: "var(--md-sys-color-on-surface-variant)" }}
							>
								Missing path
							</span>
							<code
								className="truncate text-sm"
								style={{ color: "var(--md-sys-color-on-surface)" }}
							>
								{location.pathname}
							</code>
						</div>
					</div>

					<M3Card
						variant="elevated"
						className="rounded-[28px] border"
						style={{ borderColor: "var(--md-sys-color-outline-variant)" }}
					>
						<M3CardHeader className="gap-3 p-6 pb-4">
							<div
								className="flex size-14 items-center justify-center rounded-full"
								style={{
									backgroundColor: "var(--md-sys-color-primary-container)",
									color: "var(--md-sys-color-primary)",
								}}
							>
								<Clapperboard className="size-7" />
							</div>
							<M3CardTitle className="md-headline-small">
								Get back to something worth tracking
							</M3CardTitle>
							<M3CardDescription className="md-body-large">
								Try one of the main recovery paths below instead of refreshing a
								broken link.
							</M3CardDescription>
						</M3CardHeader>

						<M3CardContent className="space-y-4 p-6 pt-0">
							<div
								className="rounded-[24px] border p-4"
								style={{
									backgroundColor: "var(--md-sys-color-surface-container)",
									borderColor: "var(--md-sys-color-outline-variant)",
								}}
							>
								<p className="mb-1 text-sm font-semibold text-(--md-sys-color-on-surface)">
									Start from the dashboard
								</p>
								<p className="text-sm text-(--md-sys-color-on-surface-variant)">
									Return home to pick up your shelf, lists, and up next queue.
								</p>
							</div>

							<div
								className="rounded-[24px] border p-4"
								style={{
									backgroundColor: "var(--md-sys-color-surface-container)",
									borderColor: "var(--md-sys-color-outline-variant)",
								}}
							>
								<p className="mb-1 text-sm font-semibold text-(--md-sys-color-on-surface)">
									Search the catalog
								</p>
								<p className="text-sm text-(--md-sys-color-on-surface-variant)">
									Look up the movie, show, season, or episode you were trying to
									reach.
								</p>
							</div>

							<div
								className="rounded-[24px] border p-4"
								style={{
									backgroundColor: "rgba(243, 188, 0, 0.1)",
									borderColor: "rgba(243, 188, 0, 0.24)",
								}}
							>
								<p className="mb-1 text-sm font-semibold text-(--md-sys-color-on-surface)">
									Check the link source
								</p>
								<p className="text-sm text-(--md-sys-color-on-surface-variant)">
									If this came from a saved bookmark or shared URL, it may be
									outdated.
								</p>
							</div>
						</M3CardContent>
					</M3Card>
				</div>
			</div>
		</section>
	);
}
