import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

type AddToShelfButtonProps = {
	onClick: () => void;
	isPending?: boolean;
	label: string;
	icon: ReactNode;
	colors: {
		primary?: string;
		secondary?: string;
	};
	size?: "compact" | "regular";
	className?: string;
	disabled?: boolean;
};

export function AddToShelfButton({
	onClick,
	isPending = false,
	label,
	icon,
	colors,
	size = "regular",
	className = "",
	disabled = false,
}: AddToShelfButtonProps) {
	const sizeClasses =
		size === "compact" ? "py-3 px-6" : "py-4 px-6 hover:scale-[1.02]";

	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled || isPending}
			className={`w-full rounded-xl m3-label-large transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 ${sizeClasses} ${className}`}
			style={{
				background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
				boxShadow: `0 15px 35px -10px ${colors.primary}60`,
				color: "var(--md-sys-color-on-primary)",
			}}
		>
			{isPending ? (
				<>
					<Loader2 className="w-5 h-5 animate-spin" />
					Loading
				</>
			) : (
				<>
					{icon}
					{label}
				</>
			)}
		</button>
	);
}
