"use client";

import { Clock } from "lucide-react";
import * as React from "react";
import { Label } from "@/components/ui/label";
import { TimePickerInput } from "./time-picker-input";

interface TimePickerProps {
	date: Date | undefined;
	setDate: (date: Date | undefined) => void;
}

export function TimePicker({ date, setDate }: TimePickerProps) {
	const minuteRef = React.useRef<HTMLInputElement>(null);
	const hourRef = React.useRef<HTMLInputElement>(null);

	return (
		<div className="flex items-center gap-2">
			<div className="grid gap-1 text-center">
				<Label htmlFor="hours" className="text-xs text-gray-400">
					Hours
				</Label>
				<TimePickerInput
					picker="hours"
					date={date}
					setDate={setDate}
					ref={hourRef}
					onRightFocus={() => minuteRef.current?.focus()}
					className="w-[60px] bg-gray-800 border-gray-700 text-white focus:border-purple-500"
				/>
			</div>
			<span className="text-gray-400 mt-5">:</span>
			<div className="grid gap-1 text-center">
				<Label htmlFor="minutes" className="text-xs text-gray-400">
					Minutes
				</Label>
				<TimePickerInput
					picker="minutes"
					date={date}
					setDate={setDate}
					ref={minuteRef}
					onLeftFocus={() => hourRef.current?.focus()}
					className="w-[60px] bg-gray-800 border-gray-700 text-white focus:border-purple-500"
				/>
			</div>
			<div className="flex h-10 items-center mt-4">
				<Clock className="ml-2 h-4 w-4 text-gray-400" />
			</div>
		</div>
	);
}
