import * as SwitchPrimitives from "@radix-ui/react-switch";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Switch({
	className,
	...props
}: React.ComponentProps<typeof SwitchPrimitives.Root>) {
	return (
		<SwitchPrimitives.Root
			data-slot="switch"
			className={cn(
				"peer data-[state=checked]:bg-(--md-sys-color-primary) data-[state=unchecked]:bg-(--md-sys-color-surface-container-highest) focus-visible:ring-(--md-sys-color-primary)/50 inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-(--md-sys-color-surface) disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...props}
		>
			<SwitchPrimitives.Thumb
				data-slot="switch-thumb"
				className={cn(
					"bg-(--md-sys-color-on-primary) pointer-events-none block h-5 w-5 rounded-full shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
				)}
			/>
		</SwitchPrimitives.Root>
	);
}

export { Switch };
