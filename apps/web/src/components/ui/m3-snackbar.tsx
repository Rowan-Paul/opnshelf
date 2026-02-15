import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Material Design 3 Snackbar Component
 *
 * Used for brief messages at the bottom of the screen
 * Can include a single text action button
 */

const m3SnackbarVariants = cva(
	[
		"flex items-center justify-between gap-4",
		"min-h-[48px] max-w-[400px] px-4 py-3",
		"rounded-[var(--md-sys-shape-corner-extra-small)]",
		"bg-[var(--md-sys-color-inverse-surface)]",
		"md-elevation-3",
		"transition-all duration-300",
		"animate-in slide-in-from-bottom-full",
	].join(" "),
	{
		variants: {
			position: {
				center: "mx-auto",
				left: "mr-auto ml-4",
				right: "ml-auto mr-4",
			},
		},
		defaultVariants: {
			position: "center",
		},
	},
);

interface M3SnackbarProps
	extends React.ComponentProps<"div">,
		VariantProps<typeof m3SnackbarVariants> {
	message: string;
	action?: {
		label: string;
		onClick: () => void;
	};
	onClose?: () => void;
	duration?: number;
	showCloseButton?: boolean;
}

function M3Snackbar({
	className,
	position,
	message,
	action,
	onClose,
	duration = 4000,
	showCloseButton = false,
	...props
}: M3SnackbarProps) {
	// Auto-dismiss
	React.useEffect(() => {
		if (duration > 0) {
			const timer = setTimeout(() => {
				onClose?.();
			}, duration);
			return () => clearTimeout(timer);
		}
	}, [duration, onClose]);

	return (
		<div
			role="alert"
			aria-live="polite"
			className={cn(m3SnackbarVariants({ position, className }))}
			{...props}
		>
			{/* Message */}
			<span className="md-body-medium text-[var(--md-sys-color-on-inverse-surface)] flex-1">
				{message}
			</span>

			{/* Action Button */}
			{action && (
				<button
					type="button"
					onClick={action.onClick}
					className="md-label-large text-[var(--md-sys-color-inverse-primary)] hover:bg-[var(--md-sys-color-inverse-primary)]/10 px-2 py-1 rounded-[var(--md-sys-shape-corner-small)] transition-colors"
				>
					{action.label}
				</button>
			)}

			{/* Close Button */}
			{showCloseButton && (
				<button
					type="button"
					onClick={onClose}
					className="text-[var(--md-sys-color-on-inverse-surface)] hover:bg-[var(--md-sys-color-on-inverse-surface)]/10 p-1 rounded-full transition-colors"
					aria-label="Close"
				>
					<X className="w-4 h-4" />
				</button>
			)}
		</div>
	);
}

// ============================================
// Snackbar Manager (Provider)
// ============================================

interface SnackbarItem {
	id: string;
	message: string;
	action?: {
		label: string;
		onClick: () => void;
	};
	duration?: number;
	showCloseButton?: boolean;
}

interface SnackbarContextType {
	showSnackbar: (options: Omit<SnackbarItem, "id">) => void;
	hideSnackbar: (id: string) => void;
}

const SnackbarContext = React.createContext<SnackbarContextType | null>(null);

export function useSnackbar() {
	const context = React.useContext(SnackbarContext);
	if (!context) {
		throw new Error("useSnackbar must be used within M3SnackbarProvider");
	}
	return context;
}

interface M3SnackbarProviderProps {
	children: React.ReactNode;
	maxSnacks?: number;
}

export function M3SnackbarProvider({
	children,
	maxSnacks = 1,
}: M3SnackbarProviderProps) {
	const [snackbars, setSnackbars] = React.useState<SnackbarItem[]>([]);

	const showSnackbar = React.useCallback(
		(options: Omit<SnackbarItem, "id">) => {
			const id = Math.random().toString(36).substring(7);
			setSnackbars((prev) => {
				const newSnackbars = [...prev, { id, ...options }];
				// Keep only the most recent maxSnacks
				return newSnackbars.slice(-maxSnacks);
			});
		},
		[maxSnacks],
	);

	const hideSnackbar = React.useCallback((id: string) => {
		setSnackbars((prev) => prev.filter((snack) => snack.id !== id));
	}, []);

	return (
		<SnackbarContext.Provider value={{ showSnackbar, hideSnackbar }}>
			{children}
			{createPortal(
				<div className="fixed bottom-6 left-0 right-0 z-50 flex flex-col gap-2 items-center pointer-events-none">
					{snackbars.map((snackbar) => (
						<div key={snackbar.id} className="pointer-events-auto">
							<M3Snackbar
								message={snackbar.message}
								action={snackbar.action}
								duration={snackbar.duration}
								showCloseButton={snackbar.showCloseButton}
								onClose={() => hideSnackbar(snackbar.id)}
							/>
						</div>
					))}
				</div>,
				document.body,
			)}
		</SnackbarContext.Provider>
	);
}

export { M3Snackbar, m3SnackbarVariants };
export type { M3SnackbarProps, SnackbarItem };
