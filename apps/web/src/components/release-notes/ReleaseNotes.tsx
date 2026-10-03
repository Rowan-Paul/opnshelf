import {
	RELEASE_PLATFORM_NAMES,
	RELEASE_PLATFORMS,
	type ReleaseNote,
	releaseAvailabilityLabel,
	releaseNoteDate,
} from "@opnshelf/api";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { MarkdownContent } from "#/components/MarkdownContent";
import { useReleaseNotes } from "#/lib/use-release-notes";

export function ReleaseAvailability({ entry }: { entry: ReleaseNote }) {
	return (
		<dl className="flex flex-wrap gap-x-6 gap-y-3 rounded-xl border border-(--border) bg-(--background-subtle) p-4 text-xs">
			{RELEASE_PLATFORMS.map((platform) => (
				<div key={platform} className="space-y-1">
					<dt className="font-semibold">{RELEASE_PLATFORM_NAMES[platform]}</dt>
					<dd className="text-(--foreground-muted)">
						{releaseAvailabilityLabel(entry.platforms[platform])}
					</dd>
				</div>
			))}
		</dl>
	);
}
export function ReleaseNotesSkeleton() {
	return (
		<section
			className="mx-auto max-w-3xl space-y-10 px-4 py-12"
			aria-label="Loading release notes"
		>
			{[0, 1, 2].map((i) => (
				<div key={i} className="space-y-4 motion-safe:animate-pulse">
					<div className="h-3 w-28 rounded bg-(--background-subtle)" />
					<div className="h-8 w-3/4 rounded bg-(--background-subtle)" />
					<div className="h-4 w-full rounded bg-(--background-subtle)" />
					<div className="h-16 rounded-xl bg-(--background-subtle)" />
				</div>
			))}
		</section>
	);
}
export function ReleaseNotesPage({ slug }: { slug?: string }) {
	const notes = useReleaseNotes({ history: !slug });
	if (!notes.data && notes.isPending) return <ReleaseNotesSkeleton />;
	const entry = notes.data?.find((item) => item.slug === slug);
	return (
		<div className="container-app py-10 sm:py-14">
			<div className="mx-auto max-w-3xl">
				{slug && (
					<Link
						to="/whats-new"
						className="mb-8 inline-flex items-center gap-2 text-(--foreground-muted) text-sm hover:text-(--foreground)"
					>
						<ArrowLeft className="size-4" />
						All release notes
					</Link>
				)}
				<header className="mb-10 space-y-3">
					<p className="font-semibold text-(--accent) text-xs uppercase tracking-widest">
						Opnshelf · Release notes
					</p>
					<h1 className="text-display-1">
						{slug
							? (entry?.title ??
								(notes.data ? "Release note not found" : "Release notes"))
							: "What’s new"}
					</h1>
					{!slug && (
						<p className="text-(--foreground-muted)">
							The latest improvements, and how to use them.
						</p>
					)}
					{entry && (
						<time
							className="block text-(--foreground-muted) text-sm"
							dateTime={entry.publishedAt}
						>
							{releaseNoteDate(entry.publishedAt)}
						</time>
					)}
				</header>
				{notes.isError && (
					<div
						role="alert"
						className="mb-6 rounded-xl border border-(--border) p-4 text-sm"
					>
						<p>
							{notes.data
								? "Couldn’t refresh release notes. Showing the last loaded version."
								: "Couldn’t load release notes."}
						</p>
						<button
							type="button"
							className="mt-2 text-(--accent) underline"
							onClick={() => void notes.refetch()}
						>
							Try again
						</button>
					</div>
				)}
				{notes.markError && (
					<p role="alert" className="mb-4 text-sm">
						Couldn’t save your read status.{" "}
						<button
							type="button"
							onClick={notes.retryMark}
							className="text-(--accent) underline"
						>
							Try again
						</button>
					</p>
				)}
				{slug ? (
					entry ? (
						<article className="space-y-8">
							<ReleaseAvailability entry={entry} />
							<div className="[&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl">
								<MarkdownContent markdown={entry.markdown} />
							</div>
						</article>
					) : (
						notes.data && (
							<p className="text-(--foreground-muted)">
								This release note isn’t available. Browse the history for
								published updates.
							</p>
						)
					)
				) : (
					<>
						{notes.data?.length === 0 && (
							<div className="rounded-xl border border-(--border) p-8">
								<h2 className="font-display font-semibold text-lg">
									The next chapter starts here
								</h2>
								<p className="mt-2 text-(--foreground-muted) text-sm">
									Our next release notes will appear here. Check back for the
									latest improvements.
								</p>
							</div>
						)}
						<div className="divide-y divide-(--border)">
							{notes.data?.map((note) => (
								<article key={note.slug} className="space-y-4 py-8 first:pt-0">
									<time
										className="text-(--foreground-muted) text-xs"
										dateTime={note.publishedAt}
									>
										{releaseNoteDate(note.publishedAt)}
									</time>
									<h2 className="font-display font-semibold text-2xl">
										<Link
											to="/whats-new/$slug"
											params={{ slug: note.slug }}
											className="group inline-flex items-center gap-3 hover:text-(--accent)"
										>
											{note.title}
											<ArrowUpRight className="size-5 shrink-0" />
										</Link>
									</h2>
									<p className="text-(--foreground-muted) leading-relaxed">
										{note.summary}
									</p>
									<ReleaseAvailability entry={note} />
								</article>
							))}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
