import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowRight,
	Clapperboard,
	Compass,
	LayoutDashboard,
	Sparkles,
	UserCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { HomeView } from "#/components/home/HomeView";
import LoadingState from "#/components/LoadingState";
import StoreBadges from "#/components/StoreBadges";
import { useAuth } from "#/lib/auth-context";

export const Route = createFileRoute("/")({
	head: () => ({
		meta: [{ title: "Opnshelf - Track What You Watch" }],
	}),
	component: IndexPage,
});

const HERO_BACKDROPS = [
	"https://image.tmdb.org/t/p/original/2u7zbn8EudG6kLlBzUYqP8RyFU4.jpg",
	"https://image.tmdb.org/t/p/original/2ssWTSVklAEc98frZUQhgtGHx7s.jpg",
	"https://image.tmdb.org/t/p/original/mVr0UiqyltcfqxbAUcLl9zWL8ah.jpg",
	"https://image.tmdb.org/t/p/original/TU9NIjwzjoKPwQHoHshkFcQUCG.jpg",
	"https://image.tmdb.org/t/p/original/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg",
	"https://image.tmdb.org/t/p/original/suaEOtk1N1sgg2MTM7oZd2cfVp3.jpg",
	"https://image.tmdb.org/t/p/original/dyJvKsNs2KP8qQnAXbRwDjblViy.jpg",
];

const SCREENSHOT_SECTIONS = [
	{
		title: "Your Home",
		description:
			"Your personal home for what you've recently watched, what to watch next, and what your friends are up to — all in one place.",
		icon: LayoutDashboard,
		image: "/screenshots/dashboard.png",
		imageAlt: "Opnshelf home preview",
	},
	{
		title: "Discover Anything",
		description:
			"Search across movies, TV shows, and people. Filter by what's trending, top-rated, or coming soon. Your next favorite is one search away.",
		icon: Compass,
		image: "/screenshots/search.png",
		imageAlt: "Search preview",
	},
	{
		title: "Deep Dives",
		description:
			"Every title has a home. Browse cast, crew, seasons, episodes, and where to watch. Read and write reviews that help the community decide.",
		icon: Clapperboard,
		image: "/screenshots/media-detail.png",
		imageAlt: "Media detail preview",
	},
	{
		title: "Your Profile",
		description:
			"Showcase your taste. Share your shelf, reviews, lists, and ratings with the world. Follow friends and see what they're loving.",
		icon: UserCircle,
		image: "/screenshots/profile.png",
		imageAlt: "Profile preview",
	},
];

/**
 * `/` is Home for a signed-in visitor and the landing page for everyone else.
 *
 * There is no redirect: the Mobile App serves Home at `/` too, and the routes
 * match (ADR 0023). This replaced a bounce to `/dashboard`, a route whose name
 * the glossary had already retired in favour of Home.
 */
function IndexPage() {
	const { user, isAuthenticated, isLoading: authLoading } = useAuth();
	const navigate = useNavigate();

	useEffect(() => {
		if (!authLoading && isAuthenticated && user?.needsOnboarding) {
			navigate({ to: "/onboarding" });
		}
	}, [authLoading, isAuthenticated, user?.needsOnboarding, navigate]);

	if (authLoading) return <LoadingState />;
	if (isAuthenticated) return <HomeView />;
	return <LandingPage />;
}

function LandingPage() {
	const backdropUrl = useMemo(
		() => HERO_BACKDROPS[Math.floor(Math.random() * HERO_BACKDROPS.length)],
		[],
	);

	return (
		<div className="min-h-screen">
			{/* Hero Section */}
			<section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden">
				{/* Movie backdrop */}
				<div className="absolute inset-0">
					<img
						src={backdropUrl}
						alt=""
						className="h-full w-full object-cover"
						loading="eager"
					/>
					{/* Heavy dark gradient overlay for legibility */}
					<div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/50 to-black/30" />
				</div>

				<div className="container-app relative z-10">
					<div className="mx-auto max-w-3xl text-center">
						{/* Badge */}
						<div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm text-white/90 backdrop-blur-sm">
							<Sparkles className="h-4 w-4 text-(--accent-400)" />
							<span>A better way to track what you watch</span>
						</div>

						{/* Headline */}
						<h1 className="mb-6 text-display-1 text-white">
							Track what you watch.
							<br />
							Share with friends.
						</h1>

						{/* Subheadline */}
						<p className="mx-auto mb-10 max-w-xl text-lg text-white/75">
							Opnshelf is your personal media tracker. Log movies and shows, see
							what friends are watching, and discover your next favorite.
						</p>

						{/* CTA Buttons */}
						<div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
							<Link
								to="/login"
								className="btn btn-primary inline-flex items-center gap-2 px-8 py-3 text-lg"
							>
								Get Started
								<ArrowRight className="size-5" />
							</Link>
						</div>

						{/* Mobile App. The MobileAppBanner deliberately skips `/`, so
						    this is the only ask a phone visitor sees here. */}
						<p className="mt-10 mb-4 text-sm text-white/60">
							Also on iPhone and Android
						</p>
						<StoreBadges />
					</div>
				</div>
			</section>

			{/* Screenshot Feature Sections */}
			{SCREENSHOT_SECTIONS.map((section, index) => {
				const Icon = section.icon;
				const isReversed = index % 2 === 1;

				return (
					<section
						key={section.title}
						className="border-(--border) border-t py-20 lg:py-28"
					>
						<div className="container-app">
							<div
								className={`flex flex-col items-center gap-12 lg:gap-20 ${
									isReversed ? "lg:flex-row-reverse" : "lg:flex-row"
								}`}
							>
								{/* Text side */}
								<div className="flex-1">
									<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-(--accent-subtle) text-(--accent)">
										<Icon className="h-6 w-6" />
									</div>
									<h2 className="mb-4 text-display-2">{section.title}</h2>
									<p className="max-w-md text-(--foreground-muted) text-lg leading-relaxed">
										{section.description}
									</p>
								</div>

								{/* Screenshot side */}
								<div className="w-full flex-1">
									<ScreenshotFrame
										image={section.image}
										alt={section.imageAlt}
										label={section.title}
									/>
								</div>
							</div>
						</div>
					</section>
				);
			})}

			{/* Extra features row (compact) */}
			<section className="border-(--border) border-t py-20">
				<div className="container-app">
					<div className="mb-12 text-center">
						<h2 className="mb-3 text-display-2">And so much more</h2>
						<p className="mx-auto max-w-lg text-(--foreground-muted)">
							A complete toolkit for media tracking and social discovery.
						</p>
					</div>

					<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
						{[
							"Release Calendar",
							"Social Feed",
							"Curated Lists",
							"Episode Tracking",
							"Rate & Review",
							"Import History",
						].map((feature) => (
							<div
								key={feature}
								className="rounded-xl border border-(--border) bg-(--background-elevated) px-4 py-6 text-center shadow-sm"
							>
								<p className="font-medium text-sm">{feature}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="border-(--border) border-t py-24">
				<div className="container-app">
					<div className="mx-auto max-w-2xl text-center">
						<h2 className="mb-4 text-display-2">Ready to start tracking?</h2>
						<p className="mb-8 text-(--foreground-muted)">
							Build your shelf, share your taste, and discover what to watch
							next. Your media history stays portable and under your control.
						</p>
						<Link
							to="/login"
							className="btn btn-primary inline-flex items-center gap-2 px-8 py-3 text-lg"
						>
							Sign In
							<ArrowRight className="size-5" />
						</Link>
					</div>
				</div>
			</section>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/* Screenshot Frame — shows a screenshot if available, otherwise a   */
/* styled placeholder. No browser chrome — just the raw image.       */
/* ------------------------------------------------------------------ */
function ScreenshotFrame({
	image,
	alt,
	label,
}: {
	image: string;
	alt: string;
	label: string;
}) {
	const [loaded, setLoaded] = useState(false);
	const [error, setError] = useState(false);

	return (
		<div className="overflow-hidden rounded-xl border border-(--border) bg-(--background-elevated) shadow-xl">
			<div className="relative aspect-video bg-(--background-subtle)">
				{!error && (
					<img
						src={image}
						alt={alt}
						className={`h-full w-full object-cover transition-opacity duration-500 ${
							loaded ? "opacity-100" : "opacity-0"
						}`}
						onLoad={() => setLoaded(true)}
						onError={() => setError(true)}
					/>
				)}

				{/* Placeholder shown while loading or on error */}
				{(!loaded || error) && (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
						<div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-(--accent-subtle) text-(--accent)">
							<Clapperboard className="h-8 w-8" />
						</div>
						<p className="font-medium text-(--foreground-muted)">{label}</p>
						<p className="text-(--foreground-subtle) text-xs">
							{error ? "Screenshot not yet captured" : "Loading preview…"}
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
