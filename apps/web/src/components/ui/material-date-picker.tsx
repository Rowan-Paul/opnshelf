import {
	addDays,
	addMonths,
	endOfMonth,
	endOfWeek,
	format,
	isSameDay,
	isSameMonth,
	isToday,
	startOfMonth,
	startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

interface MaterialDatePickerProps {
	selected?: Date;
	onSelect?: (date: Date) => void;
	className?: string;
}

export function MaterialDatePicker({
	selected,
	onSelect,
	className,
}: MaterialDatePickerProps) {
	const [currentMonth, setCurrentMonth] = React.useState(
		selected || new Date(),
	);
	const [selectingYear, setSelectingYear] = React.useState(false);

	// Update current month when selected changes from outside
	React.useEffect(() => {
		if (selected) {
			setCurrentMonth(selected);
		}
	}, [selected]);

	const selectedDate = selected || new Date();

	const handlePrevMonth = () => {
		setCurrentMonth(addMonths(currentMonth, -1));
	};

	const handleNextMonth = () => {
		setCurrentMonth(addMonths(currentMonth, 1));
	};

	const handleDateSelect = (date: Date) => {
		onSelect?.(date);
	};

	// Generate calendar days
	const monthStart = startOfMonth(currentMonth);
	const monthEnd = endOfMonth(monthStart);
	const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
	const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

	const days: Date[] = [];
	let day = calendarStart;
	while (day <= calendarEnd) {
		days.push(day);
		day = addDays(day, 1);
	}

	const weekDays = [
		{ label: "M", id: "mon" },
		{ label: "T", id: "tue" },
		{ label: "W", id: "wed" },
		{ label: "T", id: "thu" },
		{ label: "F", id: "fri" },
		{ label: "S", id: "sat" },
		{ label: "S", id: "sun" },
	];

	// Generate years for year picker (100 years back, 50 years forward)
	const currentYear = new Date().getFullYear();
	const years = Array.from({ length: 151 }, (_, i) => currentYear - 100 + i);

	// Generate months
	const months = [
		"January",
		"February",
		"March",
		"April",
		"May",
		"June",
		"July",
		"August",
		"September",
		"October",
		"November",
		"December",
	];

	const handleYearSelect = (year: number) => {
		const newDate = new Date(currentMonth);
		newDate.setFullYear(year);
		setCurrentMonth(newDate);
		setSelectingYear(false);
	};

	const handleMonthSelect = (monthIndex: number) => {
		const newDate = new Date(currentMonth);
		newDate.setMonth(monthIndex);
		setCurrentMonth(newDate);
		setSelectingYear(false);
	};

	return (
		<div
			className={cn(
				"w-[328px] bg-(--md-sys-color-surface-container-high) rounded-xl p-0 overflow-hidden",
				className,
			)}
		>
			{/* Header with selected date */}
			<div className="px-6 pt-6 pb-4">
				<div className="text-(--md-sys-color-on-surface-variant) text-sm mb-2">
					Select date
				</div>
				<div className="text-(--md-sys-color-on-surface) text-[32px] leading-[40px] font-normal tracking-[-0.25px]">
					{format(selectedDate, "EEE, MMM d")}
				</div>
			</div>

			{/* Divider */}
			<div className="h-px bg-(--md-sys-color-outline-variant) mx-4" />

			{/* Month/Year Navigation */}
			<div className="flex items-center justify-between px-4 py-3">
				<button
					type="button"
					onClick={() => setSelectingYear(!selectingYear)}
					className="flex items-center gap-1 text-(--md-sys-color-on-surface-variant) hover:text-(--md-sys-color-on-surface) transition-colors"
				>
					<span className="text-sm font-medium">
						{format(currentMonth, "MMMM yyyy")}
					</span>
					<svg
						className="w-4 h-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						role="img"
					>
						<title>Toggle month/year selector</title>
						<path d="M6 9l6 6 6-6" />
					</svg>
				</button>
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={handlePrevMonth}
						className="w-10 h-10 flex items-center justify-center rounded-full text-(--md-sys-color-on-surface-variant) hover:bg-(--md-sys-color-on-surface-variant)/8 transition-colors"
					>
						<ChevronLeft className="w-5 h-5" />
					</button>
					<button
						type="button"
						onClick={handleNextMonth}
						className="w-10 h-10 flex items-center justify-center rounded-full text-(--md-sys-color-on-surface-variant) hover:bg-(--md-sys-color-on-surface-variant)/8 transition-colors"
					>
						<ChevronRight className="w-5 h-5" />
					</button>
				</div>
			</div>

			{/* Year/Month Picker Overlay */}
			{selectingYear && (
				<div className="px-4 pb-4">
					<div className="bg-(--md-sys-color-surface-container) rounded-lg p-4 max-h-[280px] overflow-y-auto">
						<div className="grid grid-cols-3 gap-2">
							{months.map((month, index) => (
								<button
									key={month}
									type="button"
									onClick={() => handleMonthSelect(index)}
									className={cn(
										"px-3 py-2 rounded-full text-sm font-medium transition-colors",
										currentMonth.getMonth() === index
											? "bg-(--md-sys-color-primary) text-(--md-sys-color-on-primary)"
											: "text-(--md-sys-color-on-surface-variant) hover:bg-(--md-sys-color-on-surface-variant)/8",
									)}
								>
									{month.slice(0, 3)}
								</button>
							))}
						</div>
						<div className="h-px bg-(--md-sys-color-outline-variant) my-3" />
						<div className="grid grid-cols-3 gap-2">
							{years.map((year) => (
								<button
									key={year}
									type="button"
									onClick={() => handleYearSelect(year)}
									className={cn(
										"px-3 py-2 rounded-full text-sm font-medium transition-colors",
										currentMonth.getFullYear() === year
											? "bg-(--md-sys-color-primary) text-(--md-sys-color-on-primary)"
											: "text-(--md-sys-color-on-surface-variant) hover:bg-(--md-sys-color-on-surface-variant)/8",
									)}
								>
									{year}
								</button>
							))}
						</div>
					</div>
				</div>
			)}

			{/* Calendar Grid */}
			{!selectingYear && (
				<div className="px-2 pb-6">
					{/* Weekday Headers */}
					<div className="grid grid-cols-7 mb-2">
						{weekDays.map((weekDay) => (
							<div
								key={weekDay.id}
								className="h-10 flex items-center justify-center text-(--md-sys-color-on-surface-variant) text-sm font-medium"
							>
								{weekDay.label}
							</div>
						))}
					</div>

					{/* Days Grid */}
					<div className="grid grid-cols-7 gap-0">
						{days.map((date) => {
							const isSelected = isSameDay(date, selectedDate);
							const isCurrentMonth = isSameMonth(date, currentMonth);
							const isTodayDate = isToday(date);
							const dateKey = format(date, "yyyy-MM-dd");

							return (
								<button
									key={dateKey}
									type="button"
									onClick={() => handleDateSelect(date)}
									className={cn(
										"h-10 w-10 mx-auto flex items-center justify-center text-sm font-normal rounded-full transition-all",
										!isCurrentMonth &&
											"text-(--md-sys-color-on-surface-variant)/40",
										isCurrentMonth &&
											!isSelected &&
											"text-(--md-sys-color-on-surface)",
										isSelected &&
											"bg-(--md-sys-color-primary) text-(--md-sys-color-on-primary)",
										!isSelected &&
											isTodayDate &&
											"border border-(--md-sys-color-primary) text-(--md-sys-color-primary)",
										!isSelected &&
											"hover:bg-(--md-sys-color-on-surface-variant)/8",
									)}
								>
									{format(date, "d")}
								</button>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
