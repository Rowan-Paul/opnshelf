import { Link } from "@tanstack/react-router";
import { Film } from "lucide-react";

// Bluesky icon component using local SVG
const BlueskyIcon = ({ className }: { className?: string }) => (
	<img src="/bluesky.svg" alt="Bluesky" className={className} />
);

// Tangled icon component with dark/light mode variants
const TangledIcon = ({ className }: { className?: string }) => (
	<div
		className={`relative ${className}`}
		style={{ width: "1rem", height: "1rem" }}
	>
		{/* Dark mode (white icon) */}
		<img
			src="/tangled-white.svg"
			alt="Tangled"
			className="absolute inset-0 h-full w-full object-contain dark:block hidden"
		/>
		{/* Light mode (black icon) */}
		<img
			src="/tangled-black.svg"
			alt="Tangled"
			className="absolute inset-0 h-full w-full object-contain block dark:hidden"
		/>
	</div>
);

const footerLinks = {
	product: [
		{ name: "Features", href: "#" },
		{ name: "Calendar", href: "/calendar" },
		{ name: "Lists", href: "/lists" },
		{ name: "Import", href: "/import" },
	],
	company: [
		{ name: "About", href: "/about" },
		{ name: "Blog", href: "#" },
		{ name: "Careers", href: "#" },
		{ name: "Contact", href: "#" },
	],
	legal: [
		{ name: "Privacy", href: "#" },
		{ name: "Terms", href: "#" },
		{ name: "Cookie Policy", href: "#" },
	],
	social: [
		{
			name: "Bluesky",
			href: "https://bsky.app/profile/opnshelf.xyz",
			icon: BlueskyIcon,
		},
		{
			name: "Tangled",
			href: "https://tangled.org/rowanpaulflynn.dev/opnshelf",
			icon: TangledIcon,
		},
	],
};

export default function Footer() {
	const year = new Date().getFullYear();

	return (
		<footer className="border-t border-[var(--border)] bg-[var(--background)]">
			<div className="container-app py-12">
				<div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
					{/* Brand */}
					<div className="lg:col-span-2">
						<Link to="/" className="flex items-center gap-2">
							<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-[#3f2e00]">
								<Film className="h-4 w-4" />
							</div>
							<span className="font-display text-lg font-bold">OpnShelf</span>
						</Link>
						<p className="mt-4 max-w-sm text-sm text-[var(--foreground-muted)]">
							Track what you watch and discover what others are watching. A
							personal media tracker built on the AT Protocol.
						</p>
						<div className="mt-6 flex items-center gap-4">
							{footerLinks.social.map((item) => {
								const Icon = item.icon;
								return (
									<a
										key={item.name}
										href={item.href}
										target="_blank"
										rel="noopener noreferrer"
										className="flex h-9 w-9 items-center justify-center rounded-md text-[var(--foreground-muted)] transition-colors hover:bg-[var(--background-subtle)] hover:text-[var(--foreground)]"
										aria-label={item.name}
									>
										{item.name === "Tangled" ? (
											<TangledIcon className="h-4 w-4" />
										) : (
											<Icon className="h-4 w-4" />
										)}
									</a>
								);
							})}
						</div>
					</div>

					{/* Links */}
					<div>
						<h3 className="font-display text-sm font-semibold">Product</h3>
						<ul className="mt-4 space-y-3">
							{footerLinks.product.map((item) => (
								<li key={item.name}>
									<Link
										to={item.href}
										className="text-sm text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
									>
										{item.name}
									</Link>
								</li>
							))}
						</ul>
					</div>

					<div>
						<h3 className="font-display text-sm font-semibold">Company</h3>
						<ul className="mt-4 space-y-3">
							{footerLinks.company.map((item) => (
								<li key={item.name}>
									<Link
										to={item.href}
										className="text-sm text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
									>
										{item.name}
									</Link>
								</li>
							))}
						</ul>
					</div>

					<div>
						<h3 className="font-display text-sm font-semibold">Legal</h3>
						<ul className="mt-4 space-y-3">
							{footerLinks.legal.map((item) => (
								<li key={item.name}>
									<a
										href={item.href}
										className="text-sm text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
									>
										{item.name}
									</a>
								</li>
							))}
						</ul>
					</div>
				</div>

				{/* Bottom */}
				<div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-[var(--border)] pt-8 sm:flex-row">
					<p className="text-sm text-[var(--foreground-subtle)]">
						&copy; {year} OpnShelf. All rights reserved.
					</p>
					<p className="text-xs text-[var(--foreground-subtle)]">
						Built with care on the AT Protocol
					</p>
				</div>
			</div>
		</footer>
	);
}
