import {
	ChevronDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
} from "lucide-react";
import * as React from "react";
import {
	type CustomComponents,
	type DayButton,
	DayPicker,
	getDefaultClassNames,
} from "react-day-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function CalendarRoot({
	className,
	rootRef,
	...props
}: {
	className?: string;
	rootRef?: React.Ref<HTMLDivElement>;
	children?: React.ReactNode;
}) {
	return (
		<div
			data-slot="calendar"
			ref={rootRef}
			className={cn(className)}
			{...props}
		/>
	);
}

function CalendarChevron({
	className,
	orientation,
	...props
}: {
	className?: string;
	orientation?: "left" | "right" | "down" | "up";
	children?: React.ReactNode;
}) {
	if (orientation === "left") {
		return <ChevronLeftIcon className={cn("size-5", className)} {...props} />;
	}

	if (orientation === "right") {
		return <ChevronRightIcon className={cn("size-5", className)} {...props} />;
	}

	return <ChevronDownIcon className={cn("size-4", className)} {...props} />;
}

function CalendarWeekNumber({
	children,
	className,
	...props
}: {
	children?: React.ReactNode;
	className?: string;
}) {
	return (
		<td className={className} {...props}>
			<div className="flex size-(--cell-size) items-center justify-center text-center">
				{children}
			</div>
		</td>
	);
}

function Calendar({
	className,
	classNames,
	showOutsideDays = true,
	captionLayout = "label",
	buttonVariant = "ghost",
	formatters,
	components,
	...props
}: React.ComponentProps<typeof DayPicker> & {
	buttonVariant?: React.ComponentProps<typeof Button>["variant"];
}) {
	const defaultClassNames = getDefaultClassNames();

	return (
		<DayPicker
			showOutsideDays={showOutsideDays}
			weekStartsOn={0}
			className={cn(
				"bg-background group/calendar p-0 in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent font-normal",
				String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
				String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
				className,
			)}
			captionLayout={captionLayout}
			formatters={{
				formatMonthDropdown: (date: Date) =>
					date.toLocaleString("default", { month: "short" }),
				formatWeekdayName: (weekday: Date) =>
					weekday.toLocaleString("default", { weekday: "narrow" }),
				...formatters,
			}}
			classNames={{
				root: cn("w-fit", defaultClassNames.root),
				months: cn("flex flex-col gap-0", defaultClassNames.months),
				month: cn("flex flex-col w-full gap-0", defaultClassNames.month),
				nav: cn(
					"flex items-center justify-between w-full px-1 py-1",
					defaultClassNames.nav,
				),
				button_previous: cn(
					buttonVariants({ variant: buttonVariant }),
					"size-8 aria-disabled:opacity-50 p-0 rounded-full select-none hover:bg-muted",
					defaultClassNames.button_previous,
				),
				button_next: cn(
					buttonVariants({ variant: buttonVariant }),
					"size-8 aria-disabled:opacity-50 p-0 rounded-full select-none hover:bg-muted",
					defaultClassNames.button_next,
				),
				month_caption: cn(
					"flex items-center justify-center h-10 w-full",
					defaultClassNames.month_caption,
				),
				dropdowns: cn(
					"flex items-center text-sm font-medium justify-center h-10 gap-1",
					defaultClassNames.dropdowns,
				),
				dropdown_root: cn("relative", defaultClassNames.dropdown_root),
				dropdown: cn(
					"absolute bg-popover inset-0 opacity-0",
					defaultClassNames.dropdown,
				),
				caption_label: cn(
					"select-none font-medium text-foreground text-base",
					captionLayout === "label"
						? "text-base font-medium"
						: "rounded-md pl-2 pr-1 flex items-center gap-1 text-sm h-8 [&>svg]:text-muted-foreground [&>svg]:size-3.5",
					defaultClassNames.caption_label,
				),
				table: "w-full border-collapse",
				weekdays: cn("grid grid-cols-7 w-full", defaultClassNames.weekdays),
				weekday: cn(
					"text-muted-foreground font-normal text-xs select-none h-9 flex items-center justify-center",
					defaultClassNames.weekday,
				),
				week: cn("grid grid-cols-7 w-full", defaultClassNames.week),
				week_number_header: cn(
					"select-none w-8",
					defaultClassNames.week_number_header,
				),
				week_number: cn(
					"text-xs select-none text-muted-foreground",
					defaultClassNames.week_number,
				),
				day: cn(
					"relative w-full h-full p-0 text-center group/day aspect-square select-none",
					props.showWeekNumber
						? "[&:nth-child(2)[data-selected=true]_button]:rounded-l-full"
						: "[&:first-child[data-selected=true]_button]:rounded-l-full",
					defaultClassNames.day,
				),
				range_start: cn(
					"rounded-l-full rounded-r-none bg-primary text-primary-foreground",
					defaultClassNames.range_start,
				),
				range_middle: cn(
					"rounded-none bg-primary/10 text-foreground",
					defaultClassNames.range_middle,
				),
				range_end: cn(
					"rounded-r-full rounded-l-none bg-primary text-primary-foreground",
					defaultClassNames.range_end,
				),
				today: cn(
					"border-2 border-primary rounded-full font-semibold text-foreground",
					defaultClassNames.today,
				),
				selected: cn(
					"bg-primary text-primary-foreground rounded-full font-semibold",
					defaultClassNames.selected,
				),
				outside: cn(
					"text-muted-foreground/50 aria-selected:text-muted-foreground",
					defaultClassNames.outside,
				),
				disabled: cn(
					"text-muted-foreground/30 opacity-50",
					defaultClassNames.disabled,
				),
				hidden: cn("invisible", defaultClassNames.hidden),
				...classNames,
			}}
			components={{
				Root: CalendarRoot as CustomComponents["Root"],
				Chevron: CalendarChevron as CustomComponents["Chevron"],
				DayButton: CalendarDayButton,
				WeekNumber: CalendarWeekNumber as CustomComponents["WeekNumber"],
				...components,
			}}
			{...props}
		/>
	);
}

function CalendarDayButton({
	className,
	day,
	modifiers,
	...props
}: React.ComponentProps<typeof DayButton>) {
	const defaultClassNames = getDefaultClassNames();

	const ref = React.useRef<HTMLButtonElement>(null);
	React.useEffect(() => {
		if (modifiers.focused) ref.current?.focus();
	}, [modifiers.focused]);

	return (
		<Button
			ref={ref}
			variant="ghost"
			size="icon"
			data-day={day.date.toLocaleDateString()}
			data-selected-single={
				modifiers.selected &&
				!modifiers.range_start &&
				!modifiers.range_end &&
				!modifiers.range_middle
			}
			data-range-start={modifiers.range_start}
			data-range-end={modifiers.range_end}
			data-range-middle={modifiers.range_middle}
			data-today={modifiers.today}
			className={cn(
				"data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-middle=true]:bg-primary/10 data-[range-middle=true]:text-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[today=true]:border-2 data-[today=true]:border-primary data-[today=true]:rounded-full group-data-[focused=true]/day:ring-ring/50 dark:hover:text-accent-foreground flex aspect-square w-full h-full min-w-0 min-h-0 p-0 leading-none font-normal justify-center items-center rounded-full hover:bg-muted group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-2 group-data-[focused=true]/day:ring-ring",
				defaultClassNames.day,
				className,
			)}
			{...props}
		/>
	);
}

export { Calendar };
