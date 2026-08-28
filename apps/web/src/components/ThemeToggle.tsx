import { Monitor, Moon, Sun } from "lucide-react";
import { type ThemeMode, useThemeMode } from "#/lib/theme";

const ICONS = { light: Sun, dark: Moon, auto: Monitor } as const;

const LABELS = {
	light: "Light mode",
	dark: "Dark mode",
	auto: "System preference",
} as const;

const BUTTON_CLASS =
	"flex h-9 w-9 items-center justify-center rounded-md border border-(--border) bg-(--background-elevated) text-(--foreground-muted) transition-colors hover:border-(--border-strong) hover:bg-(--background-subtle) hover:text-(--foreground)";

/**
 * Quick appearance switch in the header. Logged-out visitors can only reach
 * this one, since Settings > Preferences > Appearance sits behind auth; both
 * read the same store, so they never disagree.
 */
export default function ThemeToggle() {
	const { mode, hydrated, setMode } = useThemeMode();

	if (!hydrated) {
		return (
			<button type="button" className={BUTTON_CLASS} aria-label="Loading theme">
				<Monitor className="size-4" />
			</button>
		);
	}

	function cycleMode() {
		const nextMode: ThemeMode =
			mode === "light" ? "dark" : mode === "dark" ? "auto" : "light";
		setMode(nextMode);
	}

	const Icon = ICONS[mode];

	return (
		<button
			type="button"
			onClick={cycleMode}
			className={BUTTON_CLASS}
			aria-label={`Current theme: ${LABELS[mode]}. Click to change.`}
			title={`Theme: ${LABELS[mode]}`}
		>
			<Icon className="h-4 w-4" />
		</button>
	);
}
