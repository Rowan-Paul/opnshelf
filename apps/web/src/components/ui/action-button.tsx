import type { ReactNode } from "react";

interface ActionButtonProps {
	icon: ReactNode;
	label: string;
	onClick?: () => void;
	isActive?: boolean;
	activeColor?: string;
	disabled?: boolean;
	className?: string;
}

export function ActionButton({
	icon,
	label,
	onClick,
	isActive = false,
	activeColor,
	disabled = false,
	className = "",
}: ActionButtonProps) {
	const color = activeColor || "var(--md-sys-color-primary)";
	const hoverBg = isActive
		? `${color}15`
		: "var(--md-sys-color-surface-container)";

	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={`w-full py-3 px-6 rounded-xl m3-label-large transition-all duration-200 flex items-center justify-center gap-2 border focus:outline-none focus:ring-2 focus:ring-(--md-sys-color-primary)/50 ${className}`}
			style={
				isActive
					? {
							backgroundColor: `${color}20`,
							borderColor: color,
							color: color,
						}
					: {
							backgroundColor: "transparent",
							color: "var(--md-sys-color-on-surface-variant)",
							borderColor: "var(--md-sys-color-outline)",
						}
			}
			onMouseEnter={(e) => {
				e.currentTarget.style.backgroundColor = hoverBg;
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.backgroundColor = isActive
					? `${color}20`
					: "transparent";
			}}
		>
			{icon}
			{label}
		</button>
	);
}
