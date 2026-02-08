import { useMemo, useState, useCallback } from 'react';
import {
	View,
	TextInput,
	Text,
	TouchableOpacity,
	Modal,
	Pressable,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface DateTimePickerModalProps {
	visible: boolean;
	date: Date | null;
	onConfirm: (date: Date) => void;
	onCancel: () => void;
}

const MONTHS = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec',
];

export function DateTimePickerModal({
	visible,
	date,
	onConfirm,
	onCancel,
}: DateTimePickerModalProps) {
	const initialDate = date || new Date();
	const [selectedDate, setSelectedDate] = useState(initialDate);
	const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth());
	const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());
	const [hourInput, setHourInput] = useState(
		initialDate.getHours().toString().padStart(2, '0'),
	);
	const [minuteInput, setMinuteInput] = useState(
		initialDate.getMinutes().toString().padStart(2, '0'),
	);

	const daysInMonth = useMemo(() => {
		return new Date(currentYear, currentMonth + 1, 0).getDate();
	}, [currentMonth, currentYear]);

	const firstDayOfMonth = useMemo(() => {
		return new Date(currentYear, currentMonth, 1).getDay();
	}, [currentMonth, currentYear]);

	const handleDayPress = useCallback(
		(day: number) => {
			const newDate = new Date(selectedDate);
			newDate.setFullYear(currentYear, currentMonth, day);
			setSelectedDate(newDate);
		},
		[selectedDate, currentMonth, currentYear],
	);

	const handleTimeChange = useCallback(() => {
		let hours = parseInt(hourInput, 10);
		let minutes = parseInt(minuteInput, 10);

		if (isNaN(hours) || hours < 0) hours = 0;
		if (hours > 23) hours = 23;
		if (isNaN(minutes) || minutes < 0) minutes = 0;
		if (minutes > 59) minutes = 59;

		const newDate = new Date(selectedDate);
		newDate.setHours(hours, minutes);
		setSelectedDate(newDate);
		setHourInput(hours.toString().padStart(2, '0'));
		setMinuteInput(minutes.toString().padStart(2, '0'));
	}, [hourInput, minuteInput, selectedDate]);

	const handleConfirm = useCallback(() => {
		handleTimeChange();
		const finalDate = new Date(selectedDate);
		finalDate.setHours(parseInt(hourInput, 10), parseInt(minuteInput, 10));
		onConfirm(finalDate);
	}, [selectedDate, hourInput, minuteInput, onConfirm, handleTimeChange]);

	const goToPreviousMonth = useCallback(() => {
		if (currentMonth === 0) {
			setCurrentMonth(11);
			setCurrentYear(currentYear - 1);
		} else {
			setCurrentMonth(currentMonth - 1);
		}
	}, [currentMonth, currentYear]);

	const goToNextMonth = useCallback(() => {
		if (currentMonth === 11) {
			setCurrentMonth(0);
			setCurrentYear(currentYear + 1);
		} else {
			setCurrentMonth(currentMonth + 1);
		}
	}, [currentMonth, currentYear]);

	const calendarDays = useMemo(() => {
		const days: (number | null)[] = [];
		for (let i = 0; i < firstDayOfMonth; i++) {
			days.push(null);
		}
		for (let i = 1; i <= daysInMonth; i++) {
			days.push(i);
		}
		return days;
	}, [firstDayOfMonth, daysInMonth]);

	const isSelectedDay = useCallback(
		(day: number) => {
			return (
				selectedDate.getDate() === day &&
				selectedDate.getMonth() === currentMonth &&
				selectedDate.getFullYear() === currentYear
			);
		},
		[selectedDate, currentMonth, currentYear],
	);

	const isToday = useCallback(
		(day: number) => {
			const today = new Date();
			return (
				today.getDate() === day &&
				today.getMonth() === currentMonth &&
				today.getFullYear() === currentYear
			);
		},
		[currentMonth, currentYear],
	);

	const isFutureDate = useCallback(
		(day: number) => {
			const checkDate = new Date(currentYear, currentMonth, day);
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			return checkDate > today;
		},
		[currentMonth, currentYear],
	);

	return (
		<Modal
			visible={visible}
			transparent
			animationType="slide"
			onRequestClose={onCancel}
		>
			<Pressable
				className="flex-1 bg-black/70 justify-center items-center p-4"
				onPress={onCancel}
			>
				<Pressable
					className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm"
					onPress={(e) => e.stopPropagation()}
				>
					<Text className="text-white text-xl font-semibold mb-4 text-center">
						Select Date & Time
					</Text>

					{/* Month Navigation */}
					<View className="flex-row justify-between items-center mb-4">
						<TouchableOpacity
							onPress={goToPreviousMonth}
							className="p-2"
						>
							<Ionicons name="chevron-back" size={24} color="#9ca3af" />
						</TouchableOpacity>
						<Text className="text-white text-lg font-medium">
							{MONTHS[currentMonth]} {currentYear}
						</Text>
						<TouchableOpacity onPress={goToNextMonth} className="p-2">
							<Ionicons name="chevron-forward" size={24} color="#9ca3af" />
						</TouchableOpacity>
					</View>

					{/* Weekday Headers */}
					<View className="flex-row justify-between mb-2">
						{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
							<Text
								key={index}
								className="text-gray-400 text-sm w-10 text-center"
							>
								{day}
							</Text>
						))}
					</View>

					{/* Calendar Grid */}
					<View className="flex-row flex-wrap justify-between">
						{calendarDays.map((day, index) => (
							<TouchableOpacity
								key={index}
								onPress={() => day && !isFutureDate(day) && handleDayPress(day)}
								disabled={!day || isFutureDate(day || 0)}
								className={`w-10 h-10 justify-center items-center m-0.5 rounded-lg ${
									day && isSelectedDay(day)
										? 'bg-purple-600'
										: day && isToday(day)
											? 'bg-gray-700'
											: ''
								} ${isFutureDate(day || 0) ? 'opacity-30' : ''}`}
							>
								{day && (
									<Text
										className={`text-base ${
											isSelectedDay(day)
												? 'text-white font-semibold'
												: isFutureDate(day)
													? 'text-gray-500'
													: 'text-white'
										}`}
									>
										{day}
									</Text>
								)}
							</TouchableOpacity>
						))}
					</View>

					{/* Time Selection */}
					<View className="mt-6 mb-4">
						<Text className="text-gray-400 text-sm mb-2 text-center">
							Time (24-hour format)
						</Text>
						<View className="flex-row justify-center items-center gap-2">
							<TextInput
								value={hourInput}
								onChangeText={setHourInput}
								onBlur={handleTimeChange}
								keyboardType="number-pad"
								maxLength={2}
								className="bg-gray-800 text-white text-center text-xl w-16 h-12 rounded-lg border border-gray-700"
								placeholder="HH"
								placeholderTextColor="#6b7280"
							/>
							<Text className="text-white text-xl">:</Text>
							<TextInput
								value={minuteInput}
								onChangeText={setMinuteInput}
								onBlur={handleTimeChange}
								keyboardType="number-pad"
								maxLength={2}
								className="bg-gray-800 text-white text-center text-xl w-16 h-12 rounded-lg border border-gray-700"
								placeholder="MM"
								placeholderTextColor="#6b7280"
							/>
						</View>
					</View>

					{/* Selected Date Display */}
					<Text className="text-white text-center mb-4">
						{selectedDate.toLocaleDateString('en-US', {
							weekday: 'short',
							month: 'short',
							day: 'numeric',
						})}{' '}
						at{' '}
						{hourInput}:{minuteInput}
					</Text>

					{/* Buttons */}
					<View className="flex-row gap-3">
						<TouchableOpacity
							onPress={onCancel}
							className="flex-1 bg-gray-800 py-3 rounded-xl"
						>
							<Text className="text-white text-center font-medium">Cancel</Text>
						</TouchableOpacity>
						<TouchableOpacity
							onPress={handleConfirm}
							className="flex-1 bg-purple-600 py-3 rounded-xl"
						>
							<Text className="text-white text-center font-medium">Confirm</Text>
						</TouchableOpacity>
					</View>
				</Pressable>
			</Pressable>
		</Modal>
	);
}
