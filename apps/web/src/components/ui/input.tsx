import type * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				"placeholder:text-(--md-sys-color-on-surface-variant) selection:bg-(--md-sys-color-primary) selection:text-(--md-sys-color-on-primary) h-9 w-full min-w-0 rounded-md border border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface-container) px-3 py-1 text-base text-(--md-sys-color-on-surface) shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
				"focus-visible:border-(--md-sys-color-primary) focus-visible:ring-(--md-sys-color-primary)/50 focus-visible:ring-2",
				"aria-invalid:ring-(--md-sys-color-error)/20 aria-invalid:border-(--md-sys-color-error)",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
