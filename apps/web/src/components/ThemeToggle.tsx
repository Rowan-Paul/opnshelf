import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark" | "auto";

function getInitialMode(): ThemeMode {
	if (typeof window === "undefined") return "auto";
	const stored = window.localStorage.getItem("theme");
	if (stored === "light" || stored === "dark" || stored === "auto")
		return stored;
	return "auto";
}

function applyThemeMode(mode: ThemeMode) {
	const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
	const resolved = mode === "auto" ? (prefersDark ? "dark" : "light") : mode;

	document.documentElement.classList.remove("light", "dark");
	document.documentElement.classList.add(resolved);

	if (mode === "auto") {
		document.documentElement.removeAttribute("data-theme");
	} else {
		document.documentElement.setAttribute("data-theme", mode);
	}

	document.documentElement.style.colorScheme = resolved;
}

export default function ThemeToggle() {
	const [mode, setMode] = useState<ThemeMode>("auto");
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
		const initialMode = getInitialMode();
		setMode(initialMode);
		applyThemeMode(initialMode);
	}, []);

	useEffect(() => {
		if (mode === "auto") {
			const media = window.matchMedia("(prefers-color-scheme: dark)");
			const onChange = () => applyThemeMode("auto");
			media.addEventListener("change", onChange);
			return () => media.removeEventListener("change", onChange);
		}
	}, [mode]);

	if (!mounted) {
		return (
			<button
				type="button"
				className="flex h-9 w-9 items-center justify-center rounded-md border border-(--border) bg-(--background-elevated) text-(--foreground-muted) transition-colors hover:border-(--border-strong) hover:bg-(--background-subtle) hover:text-(--foreground)"
				aria-label="Loading theme"
			>
				<Monitor className="size-4" />
			</button>
		);
	}

	function cycleMode() {
		const nextMode: ThemeMode =
			mode === "light" ? "dark" : mode === "dark" ? "auto" : "light";
		setMode(nextMode);
		applyThemeMode(nextMode);
		window.localStorage.setItem("theme", nextMode);
	}

	const icons = {
		light: Sun,
		dark: Moon,
		auto: Monitor,
	};

	const labels = {
		light: "Light mode",
		dark: "Dark mode",
		auto: "System preference",
	};

	const Icon = icons[mode];

	return (
		<button
			type="button"
			onClick={cycleMode}
			className="flex h-9 w-9 items-center justify-center rounded-md border border-(--border) bg-(--background-elevated) text-(--foreground-muted) transition-colors hover:border-(--border-strong) hover:bg-(--background-subtle) hover:text-(--foreground)"
			aria-label={`Current theme: ${labels[mode]}. Click to change.`}
			title={`Theme: ${labels[mode]}`}
		>
			<Icon className="h-4 w-4" />
		</button>
	);
}
