import { detectPlatform, type Platform } from "#/lib/platform";

// Storefront-less URLs: both stores redirect to the visitor's own country.
export const APP_STORE_URL = "https://apps.apple.com/app/opnshelf/id6758867162";
export const PLAY_STORE_URL =
	"https://play.google.com/store/apps/details?id=com.rowanpaul.opnshelf";

/**
 * Official App Store and Google Play badges, gated to the visitor's platform.
 *
 * A phone sees only its own store; desktop sees both, because a desktop visitor
 * is the one most likely not to know the Mobile App exists and cannot act on
 * either badge right now anyway.
 *
 * Both artworks render 40px tall. Google ships its badge with 41px of
 * transparent padding baked into a 250px-tall image, so it needs `h-[60px]`
 * plus `-m-2.5` to trim that back off. Without it the Play badge reads about a
 * third smaller than Apple's.
 */
export default function StoreBadges({
	className = "",
	platform,
}: {
	className?: string;
	/** Injected in tests; defaults to the visiting device. */
	platform?: Platform;
}) {
	const { os } = platform ?? detectPlatform();
	const showAppStore = os === "ios" || os === "other";
	const showPlay = os === "android" || os === "other";

	return (
		<div
			className={`flex flex-wrap items-center justify-center gap-3 ${className}`}
		>
			{showAppStore && (
				<a
					href={APP_STORE_URL}
					target="_blank"
					rel="noopener noreferrer"
					className="transition-opacity hover:opacity-80"
				>
					<img
						src="/app-store-badge.svg"
						alt="Download on the App Store"
						className="h-10 w-auto"
						width={120}
						height={40}
					/>
				</a>
			)}
			{showPlay && (
				<a
					href={PLAY_STORE_URL}
					target="_blank"
					rel="noopener noreferrer"
					className="transition-opacity hover:opacity-80"
				>
					<img
						src="/google-play-badge.png"
						alt="Get it on Google Play"
						className="-m-2.5 h-[60px] w-auto"
						width={155}
						height={60}
					/>
				</a>
			)}
		</div>
	);
}
