import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowRight,
	Clapperboard,
	Compass,
	LayoutDashboard,
	type LucideIcon,
	Smartphone,
	UserCircle,
} from "lucide-react";
import {
	lazy,
	type ReactNode,
	Suspense,
	useCallback,
	useEffect,
	useState,
} from "react";
import StoreBadges from "#/components/StoreBadges";
import { useAuth } from "#/lib/auth-context";
import { prefetchHomePrompts } from "#/lib/home-prompts";
import { useHydrated } from "#/lib/prompt-state";
import { backdropSrcSet } from "#/lib/tmdb-image";

// Home is the signed-in view, so the landing page's anonymous visitors never
// download it. The session check starts the fetch, so it overlaps the wait.
const loadHomeView = () => import("#/components/home/HomeView");
const HomeView = lazy(() =>
	loadHomeView().then((module) => ({ default: module.HomeView })),
);

export const Route = createFileRoute("/")({
	head: () => ({
		meta: [{ title: "Opnshelf - Track What You Watch" }],
	}),
	component: IndexPage,
});

const HERO_BACKDROPS = [
	"https://image.tmdb.org/t/p/w1280/2u7zbn8EudG6kLlBzUYqP8RyFU4.jpg",
	"https://image.tmdb.org/t/p/w1280/2ssWTSVklAEc98frZUQhgtGHx7s.jpg",
	"https://image.tmdb.org/t/p/w1280/mVr0UiqyltcfqxbAUcLl9zWL8ah.jpg",
	"https://image.tmdb.org/t/p/w1280/TU9NIjwzjoKPwQHoHshkFcQUCG.jpg",
	"https://image.tmdb.org/t/p/w1280/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg",
	"https://image.tmdb.org/t/p/w1280/suaEOtk1N1sgg2MTM7oZd2cfVp3.jpg",
	"https://image.tmdb.org/t/p/w1280/dyJvKsNs2KP8qQnAXbRwDjblViy.jpg",
];

const SCREENSHOT_SECTIONS = [
	{
		title: "Your Home",
		description:
			"Your personal home for what you've recently watched, what to watch next, and what your friends are up to — all in one place.",
		icon: LayoutDashboard,
		image: "/screenshots/dashboard",
		imageAlt: "Opnshelf home preview",
	},
	{
		title: "Discover Anything",
		description:
			"Search across movies, TV shows, and people. Filter by what's trending, top-rated, or coming soon. Your next favorite is one search away.",
		icon: Compass,
		image: "/screenshots/search",
		imageAlt: "Search preview",
	},
	{
		title: "Deep Dives",
		description:
			"Every title has a home. Browse cast, crew, seasons, episodes, and where to watch. Read and write reviews that help the community decide.",
		icon: Clapperboard,
		image: "/screenshots/media-detail",
		imageAlt: "Media detail preview",
	},
	{
		title: "Your Profile",
		description:
			"Showcase your taste. Share your shelf, reviews, lists, and ratings with the world. Follow friends and see what they're loving.",
		icon: UserCircle,
		image: "/screenshots/profile",
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
	const queryClient = useQueryClient();
	const hydrated = useHydrated();

	useEffect(() => {
		if (!authLoading && isAuthenticated && user?.needsOnboarding) {
			navigate({ to: "/onboarding" });
		}
	}, [authLoading, isAuthenticated, user?.needsOnboarding, navigate]);

	// While the session check runs, fetch what Home needs first so it can
	// appear in one piece: its code, and the answers that decide its prompts.
	useEffect(() => {
		if (!authLoading && !isAuthenticated) return;
		void loadHomeView();
		prefetchHomePrompts(queryClient);
	}, [authLoading, isAuthenticated, queryClient]);

	// Wait for the browser session before choosing personal or public content.
	// A reader who waits is probably signed in (ADR 0039), so hold Home's shape
	// rather than an empty page the footer would sit in, then get pushed from.
	if (authLoading) return <HomeSkeleton />;
	if (isAuthenticated) {
		// Home renders in the browser only. When SSR could see the session (a
		// legacy parent-domain cookie, or local dev) it rendered Home, and the
		// lazy chunk was still loading at hydration: the first query update
		// threw the server HTML away for the fallback and shifted the page.
		if (!hydrated) return <HomeSkeleton />;
		return (
			<Suspense fallback={<HomeSkeleton />}>
				<HomeView />
			</Suspense>
		);
	}
	return <LandingPage />;
}

function HomeSkeleton() {
	const pulse = "animate-pulse rounded bg-(--background-subtle)";
	return (
		<div className="container-app min-h-screen py-6" aria-hidden>
			<div className="mb-6 space-y-2">
				<div className={`h-9 w-72 max-w-full ${pulse}`} />
				<div className={`h-5 w-40 ${pulse}`} />
			</div>
			<div className="card mb-6 h-[236px] animate-pulse lg:h-[154px]" />
			<div className={`mb-3 h-7 w-32 ${pulse}`} />
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
				{["a", "b", "c"].map((key) => (
					<div key={key} className={`aspect-video ${pulse}`} />
				))}
			</div>
		</div>
	);
}

function LandingPage() {
	// Rotates daily rather than per render: SSR and hydration must pick the
	// same image, or the browser fetches the hero twice.
	const backdropUrl =
		HERO_BACKDROPS[Math.floor(Date.now() / 86_400_000) % HERO_BACKDROPS.length];

	return (
		<div className="min-h-screen">
			{/* Hero Section */}
			<section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden py-16">
				{/* Movie backdrop */}
				<div className="absolute inset-0">
					<img
						src={backdropUrl}
						srcSet={backdropSrcSet(backdropUrl)}
						// object-cover fills the 70vh hero, so a portrait screen draws
						// the 16:9 backdrop about 125vh wide, not 100vw.
						sizes="(orientation: portrait) 125vh, 100vw"
						alt=""
						className="h-full w-full object-cover"
						loading="eager"
						fetchPriority="high"
					/>
					{/* Heavy dark gradient overlay for legibility */}
					<div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/50 to-black/30" />
				</div>

				<div className="container-app relative z-10">
					<div className="mx-auto max-w-3xl text-center">
						{/* Headline. 4xl on a phone keeps each sentence on one line. */}
						<h1 className="mb-4 font-bold font-display text-4xl text-white leading-[1.1] sm:text-5xl">
							Track what you watch.
							<br />
							Share with friends.
						</h1>

						{/* Subheadline */}
						<p className="mx-auto mb-8 max-w-xl text-lg text-white/75">
							Opnshelf is your personal media tracker. Log movies and shows, see
							what friends are watching, and discover your next favorite.
						</p>

						{/* CTA Buttons */}
						<div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
							<Link
								to="/signup"
								className="btn btn-primary inline-flex items-center gap-2 px-8 py-3 text-lg"
							>
								Get Started
								<ArrowRight className="size-5" />
							</Link>
						</div>

						{/* Mobile App. The MobileAppBanner deliberately skips `/`, so
						    this is the only ask a phone visitor sees here. */}
						<p className="mt-8 mb-3 text-sm text-white/60">
							Also on iPhone and Android
						</p>
						<StoreBadges />
					</div>
				</div>
			</section>

			{/* Feature rows: one section and one rhythm, so the page reads as a
			    single list instead of five separately framed blocks. */}
			<section className="border-(--border) border-t py-14 lg:py-24">
				<div className="container-app space-y-14 lg:space-y-24">
					{SCREENSHOT_SECTIONS.map((section, index) => (
						<FeatureRow
							key={section.title}
							icon={section.icon}
							title={section.title}
							description={section.description}
							reversed={index % 2 === 1}
						>
							{/* One capture per theme. The hidden one is `display: none`,
							    so its lazy image is never fetched. */}
							<ScreenshotFrame
								className="dark:hidden"
								image={`${section.image}-light.jpg`}
								alt={section.imageAlt}
								label={section.title}
							/>
							<ScreenshotFrame
								className="hidden dark:block"
								image={`${section.image}-dark.jpg`}
								alt={section.imageAlt}
								label={section.title}
							/>
						</FeatureRow>
					))}

					{/* Mobile App. Led by the Home-Screen Widget because it is the
					    one thing the Web App cannot do, which is the only honest
					    argument for installing. */}
					<FeatureRow
						icon={Smartphone}
						title="On your home screen"
						description="Put your watching year on your home screen. The widget shows your last 30 days and your total, and opens your profile in a tap."
						reversed={SCREENSHOT_SECTIONS.length % 2 === 1}
						action={<StoreBadges className="justify-start" />}
					>
						<img
							src="/screenshots/widget-android.png"
							loading="lazy"
							decoding="async"
							alt="The Opnshelf home-screen widget, showing a bar graph of the last 30 days of watches and a total count"
							width={946}
							height={512}
							className="w-full shadow-xl"
							/* The crop is the widget's exact bounds, so the launcher
							   wallpaper survives in its rounded corners. Clipping at the
							   widget's own radius removes it. Measured: 42px clears every
							   wallpaper pixel, so 48px (5.07% by 9.38% of 946x512) has
							   margin. Percentages, so it holds at any render width. */
							style={{ borderRadius: "5.07% / 9.38%" }}
						/>
					</FeatureRow>
				</div>
			</section>

			{/* Extra features (compact) */}
			<section className="border-(--border) border-t py-12 lg:py-16">
				<div className="container-app text-center">
					<h2 className="mb-2 text-display-3">And so much more</h2>
					<p className="mx-auto mb-6 max-w-lg text-(--foreground-muted)">
						A complete toolkit for media tracking and social discovery.
					</p>

					<ul className="mx-auto flex max-w-4xl flex-wrap justify-center gap-2">
						{[
							"Release Calendar",
							"Social Feed",
							"Curated Lists",
							"Episode Tracking",
							"Rate & Review",
							"Import History",
						].map((feature) => (
							<li
								key={feature}
								className="rounded-full border border-(--border) bg-(--background-elevated) px-4 py-2 font-medium text-sm"
							>
								{feature}
							</li>
						))}
					</ul>
				</div>
			</section>

			{/* CTA Section */}
			<section className="border-(--border) border-t py-14 lg:py-20">
				<div className="container-app">
					<div className="mx-auto max-w-2xl text-center">
						<h2 className="mb-3 text-display-2">Ready to start tracking?</h2>
						<p className="mb-6 text-(--foreground-muted)">
							Build your shelf, share your taste, and discover what to watch
							next. Your media history stays portable and under your control.
						</p>
						<Link
							to="/signup"
							className="btn btn-primary inline-flex items-center gap-2 px-8 py-3 text-lg"
						>
							Create your account
							<ArrowRight className="size-5" />
						</Link>
					</div>
				</div>
			</section>
		</div>
	);
}

/**
 * One landing-page feature: copy beside its picture. The picture gets the
 * wider column, because the screenshots are full pages and unreadable small.
 */
function FeatureRow({
	icon: Icon,
	title,
	description,
	reversed,
	action,
	children,
}: {
	icon: LucideIcon;
	title: string;
	description: string;
	reversed: boolean;
	/** Sits under the copy, e.g. the store badges. */
	action?: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="grid items-center gap-6 lg:grid-cols-12 lg:gap-16">
			<div className={`lg:col-span-5 ${reversed ? "lg:order-2" : ""}`}>
				<div className="mb-3 flex items-center gap-3">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-(--accent-subtle) text-(--accent)">
						<Icon className="size-5" />
					</div>
					<h2 className="font-bold font-display text-3xl leading-[1.15] sm:text-4xl">
						{title}
					</h2>
				</div>
				<p className="max-w-md text-(--foreground-muted) text-lg leading-relaxed">
					{description}
				</p>
				{action && <div className="mt-6">{action}</div>}
			</div>

			<div className="lg:col-span-7">{children}</div>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/* Screenshot Frame — shows a screenshot if available, otherwise a   */
/* styled placeholder. No browser chrome — just the raw image.       */
/* ------------------------------------------------------------------ */
function ScreenshotFrame({
	className = "",
	image,
	alt,
	label,
}: {
	className?: string;
	image: string;
	alt: string;
	label: string;
}) {
	const [loaded, setLoaded] = useState(false);
	const [error, setError] = useState(false);
	// SSR can finish loading the image before React hydrates, and then onLoad
	// never fires; read the element's state once it is attached instead.
	const syncLoaded = useCallback((img: HTMLImageElement | null) => {
		if (img?.complete) {
			if (img.naturalWidth > 0) setLoaded(true);
			else setError(true);
		}
	}, []);

	return (
		<div
			className={`overflow-hidden rounded-xl border border-(--border) bg-(--background-elevated) shadow-xl ${className}`}
		>
			<div className="relative aspect-video bg-(--background-subtle)">
				{!error && (
					<img
						ref={syncLoaded}
						src={image}
						alt={alt}
						width={1440}
						height={810}
						loading="lazy"
						decoding="async"
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
