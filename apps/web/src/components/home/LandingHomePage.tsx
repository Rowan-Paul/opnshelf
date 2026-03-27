import { Link } from "@tanstack/react-router";
import {
	ArrowRight,
	Clock3,
	Database,
	ListChecks,
	LogIn,
	Search,
	ShieldCheck,
} from "lucide-react";
import { M3Button } from "@/components/ui/m3-button";
import {
	M3Card,
	M3CardContent,
	M3CardDescription,
	M3CardHeader,
	M3CardTitle,
} from "@/components/ui/m3-card";

const comparisonItems = [
	{
		current: "Most apps help you mark something watched.",
		better: "OpnShelf helps you discover what belongs on your shelf next.",
	},
	{
		current: "Most apps give you one watchlist and call it enough.",
		better: "OpnShelf lets you build lists that stay useful over time.",
	},
	{
		current: "Most apps own your identity.",
		better: "OpnShelf is built around portable identity and owning your data.",
	},
];

const narrativeSections = [
	{
		icon: Search,
		title: "Discover beyond the algorithm",
		description:
			"Browse movies and shows, follow what catches your eye, and turn discovery into something you will actually come back to.",
		points: [
			"Browse movies and shows in one place",
			"Turn discoveries into saved intent",
			"Keep browsing without signing in",
		],
	},
	{
		icon: ListChecks,
		title: "Build lists that stay useful",
		description:
			"Keep watchlists, favorites, themed collections, and deep-cut queues in a structure that still makes sense months later.",
		points: [
			"Default lists plus custom lists",
			"Queue, favorites, and themed collections",
			"Organize around how you actually decide what to watch",
		],
	},
	{
		icon: Database,
		title: "Own your record",
		description:
			"Bring over the history you already care about, keep every watch date that matters, and avoid starting from zero.",
		points: [
			"Import from a public Trakt username",
			"Import from CSV",
			"Portable identity on the AT Protocol",
		],
	},
];

export function LandingHomePage() {
	return (
		<div
			className="min-h-screen overflow-hidden"
			style={{
				backgroundColor: "var(--md-sys-color-background)",
				color: "var(--md-sys-color-on-background)",
			}}
		>
			<section className="relative border-b border-(--md-sys-color-outline-variant)">
				<div
					className="absolute inset-0 opacity-90"
					style={{
						background:
							"radial-gradient(circle at top left, rgba(243, 188, 0, 0.18), transparent 35%), radial-gradient(circle at 85% 20%, rgba(176, 207, 186, 0.12), transparent 30%), linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0))",
					}}
				/>
				<div className="container relative mx-auto max-w-7xl px-4 py-16 md:py-24">
					<div className="max-w-5xl">
						<div className="mb-6 flex items-center gap-3">
							<img
								src="/icon.png"
								alt="OpnShelf"
								className="size-14 rounded-2xl shadow-[0_12px_30px_rgba(0,0,0,0.28)]"
							/>
							<span
								className="md-label-large rounded-full px-4 py-1.5"
								style={{
									backgroundColor: "var(--md-sys-color-secondary-container)",
									color: "var(--md-sys-color-on-secondary-container)",
								}}
							>
								For people who want a real record of what they watch
							</span>
						</div>

						<h1 className="md-display-medium max-w-4xl text-balance sm:text-[3.4rem] sm:leading-[3.8rem]">
							Discover more. Curate better. Own your watch history.
						</h1>
						<p
							className="md-title-large mt-5 max-w-4xl"
							style={{ color: "var(--md-sys-color-on-surface-variant)" }}
						>
							Browse movies and shows, create lists for every mood and
							obsession, and keep your data portable with AT Protocol identity.
						</p>
						<p
							className="md-body-large mt-4 max-w-3xl"
							style={{ color: "var(--md-sys-color-on-surface-variant)" }}
						>
							Find your next watch, save it to the right list, and keep a watch
							record you can take with you.
						</p>

						<div className="mt-8 flex flex-wrap gap-3">
							<M3Button
								variant="filled"
								size="lg"
								asChild
								className="rounded-full"
							>
								<Link to="/login">
									<LogIn className="size-5" />
									Sign in and build your shelf
								</Link>
							</M3Button>
							<M3Button
								variant="outlined"
								size="lg"
								asChild
								className="rounded-full"
							>
								<Link to="/search" search={{ q: "", type: "all" }}>
									<Search className="size-5" />
									Browse the catalog
								</Link>
							</M3Button>
						</div>
					</div>
				</div>
			</section>

			<section className="border-b border-(--md-sys-color-outline-variant) bg-[rgba(255,255,255,0.02)]">
				<div className="container mx-auto max-w-7xl px-4 py-10 md:py-14">
					<div className="mb-8 max-w-2xl">
						<p
							className="md-label-large uppercase tracking-[0.12em]"
							style={{ color: "var(--md-sys-color-primary)" }}
						>
							Why OpnShelf
						</p>
						<h2 className="md-headline-medium mt-2">
							Not just a watched toggle. A place to browse, curate, and keep the
							record.
						</h2>
					</div>
					<div className="grid gap-4 md:grid-cols-3">
						{comparisonItems.map((item) => (
							<div
								key={item.current}
								className="rounded-[24px] border p-6"
								style={{
									borderColor: "var(--md-sys-color-outline-variant)",
									backgroundColor: "rgba(255, 255, 255, 0.025)",
								}}
							>
								<p
									className="md-title-small"
									style={{ color: "var(--md-sys-color-on-surface-variant)" }}
								>
									{item.current}
								</p>
								<p className="md-title-large mt-4 text-(--md-sys-color-on-surface)">
									{item.better}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			<section className="container mx-auto max-w-7xl px-4 py-16 md:py-20">
				<div className="mb-10 max-w-2xl">
					<p
						className="md-label-large uppercase tracking-[0.12em]"
						style={{ color: "var(--md-sys-color-tertiary)" }}
					>
						How It Works
					</p>
					<h2 className="md-headline-medium mt-2">
						Three reasons the product feels better the longer you use it.
					</h2>
				</div>
				<div className="grid gap-5 lg:grid-cols-3">
					{narrativeSections.map((section) => {
						const Icon = section.icon;

						return (
							<M3Card
								key={section.title}
								variant="elevated"
								className="rounded-[28px] border border-(--md-sys-color-outline-variant)"
							>
								<M3CardHeader className="px-6 pt-6">
									<div
										className="mb-3 flex size-12 items-center justify-center rounded-2xl"
										style={{
											backgroundColor:
												"var(--md-sys-color-surface-container-high)",
											color: "var(--md-sys-color-primary)",
										}}
									>
										<Icon className="size-5" />
									</div>
									<M3CardTitle className="md-headline-small">
										{section.title}
									</M3CardTitle>
									<M3CardDescription className="md-body-large">
										{section.description}
									</M3CardDescription>
								</M3CardHeader>
								<M3CardContent className="px-6 pb-6">
									<ul className="space-y-3">
										{section.points.map((point) => (
											<li key={point} className="flex items-start gap-3">
												<span
													className="mt-1 size-2.5 shrink-0 rounded-full"
													style={{
														backgroundColor: "var(--md-sys-color-primary)",
													}}
												/>
												<span className="md-body-large text-(--md-sys-color-on-surface)">
													{point}
												</span>
											</li>
										))}
									</ul>
								</M3CardContent>
							</M3Card>
						);
					})}
				</div>
			</section>

			<section className="container mx-auto max-w-7xl px-4 pb-16">
				<div
					className="grid gap-6 overflow-hidden rounded-[32px] border px-6 py-8 md:px-10 md:py-10 lg:grid-cols-[1fr_auto] lg:items-center"
					style={{
						borderColor: "rgba(243, 188, 0, 0.34)",
						background:
							"linear-gradient(135deg, rgba(92, 69, 0, 0.7), rgba(33, 31, 38, 0.95) 48%, rgba(50, 75, 59, 0.7))",
						boxShadow: "0 24px 60px rgba(0, 0, 0, 0.28)",
					}}
				>
					<div className="max-w-3xl">
						<p
							className="md-label-large uppercase tracking-[0.12em]"
							style={{ color: "var(--md-sys-color-primary)" }}
						>
							Import First
						</p>
						<h2 className="md-headline-medium mt-3">
							Bring your history with you
						</h2>
						<p
							className="md-body-large mt-4 max-w-2xl"
							style={{ color: "var(--md-sys-color-on-surface-variant)" }}
						>
							Starting from zero is the fastest way to abandon a tracker. Import
							from Trakt or CSV, then keep building your shelf with lists,
							discovery, and full watch history.
						</p>
					</div>

					<M3Button variant="filled" size="lg" asChild className="rounded-full">
						<Link to="/login">
							<Database className="size-5" />
							Sign in and import your history
						</Link>
					</M3Button>
				</div>
			</section>

			<section className="container mx-auto max-w-7xl px-4 pb-16">
				<div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
					<div className="max-w-xl">
						<p
							className="md-label-large uppercase tracking-[0.12em]"
							style={{ color: "var(--md-sys-color-tertiary)" }}
						>
							Portable Identity
						</p>
						<h2 className="md-headline-medium mt-3">
							Built on portable identity
						</h2>
					</div>

					<div
						className="rounded-[28px] border p-6 md:p-8"
						style={{
							borderColor: "var(--md-sys-color-outline-variant)",
							backgroundColor: "var(--md-sys-color-surface-container-low)",
						}}
					>
						<div className="flex items-start gap-4">
							<div
								className="flex size-12 shrink-0 items-center justify-center rounded-2xl"
								style={{
									backgroundColor: "var(--md-sys-color-tertiary-container)",
									color: "var(--md-sys-color-on-tertiary-container)",
								}}
							>
								<ShieldCheck className="size-5" />
							</div>
							<p
								className="md-body-large"
								style={{ color: "var(--md-sys-color-on-surface-variant)" }}
							>
								OpnShelf uses your AT Protocol account so your identity is not
								trapped inside one media app. That matters if you care about
								long-term ownership of your data and profile.
							</p>
						</div>
					</div>
				</div>
			</section>

			<section className="container mx-auto max-w-7xl px-4 pb-20">
				<div
					className="rounded-[32px] border px-6 py-10 text-center md:px-10"
					style={{
						borderColor: "var(--md-sys-color-outline-variant)",
						backgroundColor: "var(--md-sys-color-surface-container)",
					}}
				>
					<h2 className="md-headline-medium">
						Find your next watch and keep the record
					</h2>
					<p
						className="md-body-large mx-auto mt-4 max-w-2xl"
						style={{ color: "var(--md-sys-color-on-surface-variant)" }}
					>
						Browse first if you want. Sign in when you are ready to build lists,
						track what matters, and keep your data yours.
					</p>
					<div className="mt-8 flex flex-wrap justify-center gap-3">
						<M3Button
							variant="filled"
							size="lg"
							asChild
							className="rounded-full"
						>
							<Link to="/login">
								<LogIn className="size-5" />
								Start discovering
							</Link>
						</M3Button>
						<M3Button
							variant="filled-tonal"
							size="lg"
							asChild
							className="rounded-full"
						>
							<Link to="/search" search={{ q: "", type: "all" }}>
								<Search className="size-5" />
								Browse catalog
								<ArrowRight className="size-5" />
							</Link>
						</M3Button>
					</div>
					<div className="mt-6 flex flex-wrap justify-center gap-6">
						<div className="flex items-center gap-2 text-(--md-sys-color-on-surface-variant)">
							<Clock3 className="size-4 text-(--md-sys-color-primary)" />
							<span className="md-body-medium">Keep a real watch history</span>
						</div>
						<div className="flex items-center gap-2 text-(--md-sys-color-on-surface-variant)">
							<ListChecks className="size-4 text-(--md-sys-color-primary)" />
							<span className="md-body-medium">
								Build lists that stay useful
							</span>
						</div>
						<div className="flex items-center gap-2 text-(--md-sys-color-on-surface-variant)">
							<Search className="size-4 text-(--md-sys-color-primary)" />
							<span className="md-body-medium">
								Discover without signing in
							</span>
						</div>
					</div>
				</div>
			</section>
		</div>
	);
}
