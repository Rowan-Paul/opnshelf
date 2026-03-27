import type * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				"placeholder:text-(--md-sys-color-on-surface-variant) selection:bg-(--md-sys-color-primary) selection:text-(--md-sys-color-on-primary) min-h-[60px] w-full rounded-md border border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface-container) px-3 py-2 text-base text-(--md-sys-color-on-surface) shadow-xs transition-[color,box-shadow] outline-none resize-none md:text-sm",
				"focus-visible:border-(--md-sys-color-primary) focus-visible:ring-(--md-sys-color-primary)/50 focus-visible:ring-2",
				"aria-invalid:ring-(--md-sys-color-error)/20 aria-invalid:border-(--md-sys-color-error)",
				className,
			)}
			{...props}
		/>
	);
}

export { Textarea };
