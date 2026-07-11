import { Star } from "lucide-react";
import { useState } from "react";

interface StarRatingProps {
	value?: number; // 1-10 scale
	onChange?: (value: number) => void;
	size?: "sm" | "md" | "lg";
	readOnly?: boolean;
	showValue?: boolean;
}

const sizeClasses = {
	sm: "h-3.5 w-3.5",
	md: "h-5 w-5",
	lg: "h-6 w-6",
};

function ratingToStars(rating: number): number {
	return rating / 2;
}

function starsToRating(stars: number): number {
	return Math.round(stars * 2);
}

export default function StarRating({
	value = 0,
	onChange,
	size = "md",
	readOnly = false,
	showValue = false,
}: StarRatingProps) {
	const [hoverValue, setHoverValue] = useState(0);

	const displayValue = hoverValue || value;
	const fillPercentage = (displayValue / 10) * 100;
	const getPointerRating = (
		e: React.MouseEvent<HTMLButtonElement>,
		starIndex: number,
	) => {
		const rect = e.currentTarget.getBoundingClientRect();
		const isLeftHalf = e.clientX - rect.left < rect.width / 2;
		return Math.min(starIndex * 2 + (isLeftHalf ? 1 : 2), 10);
	};

	const handleMouseMove = (
		e: React.MouseEvent<HTMLButtonElement>,
		starIndex: number,
	) => {
		setHoverValue(getPointerRating(e, starIndex));
	};

	const handleClick = (
		e: React.MouseEvent<HTMLButtonElement>,
		starIndex: number,
	) => {
		if (!onChange) return;
		onChange(getPointerRating(e, starIndex));
	};

	const handleMouseLeave = () => {
		setHoverValue(0);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (!onChange) return;
		if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
			e.preventDefault();
			const newValue = Math.max(1, value - 1);
			onChange(newValue);
		} else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
			e.preventDefault();
			const newValue = Math.min(10, value + 1);
			onChange(newValue);
		}
	};

	const starPositions = [
		"first",
		"second",
		"third",
		"fourth",
		"fifth",
	] as const;

	return (
		<div className="flex items-center gap-1">
			{readOnly ? (
				<div
					className="relative inline-flex"
					role="img"
					aria-label={`Rating: ${ratingToStars(value).toFixed(1)} out of 5`}
				>
					<div className="flex gap-0.5">
						{starPositions.map((pos) => (
							<Star
								key={`bg-${pos}`}
								className={`${sizeClasses[size]} shrink-0 text-yellow-500/30`}
							/>
						))}
					</div>
					<div
						className="absolute inset-0 flex gap-0.5 overflow-hidden"
						style={{ width: `${fillPercentage}%` }}
					>
						{starPositions.map((pos) => (
							<Star
								key={`fg-${pos}`}
								className={`${sizeClasses[size]} shrink-0 fill-yellow-500 text-yellow-500`}
							/>
						))}
					</div>
				</div>
			) : (
				<div
					className="relative inline-flex"
					onMouseLeave={handleMouseLeave}
					role="slider"
					aria-label="Set rating"
					aria-valuemin={0}
					aria-valuemax={10}
					aria-valuenow={value}
					onKeyDown={handleKeyDown}
					tabIndex={0}
				>
					<div className="flex gap-0.5">
						{starPositions.map((pos) => (
							<Star
								key={`bg-${pos}`}
								className={`${sizeClasses[size]} shrink-0 text-yellow-500/30`}
							/>
						))}
					</div>
					<div
						className="absolute inset-0 flex gap-0.5 overflow-hidden"
						style={{ width: `${fillPercentage}%` }}
					>
						{starPositions.map((pos) => (
							<Star
								key={`fg-${pos}`}
								className={`${sizeClasses[size]} shrink-0 fill-yellow-500 text-yellow-500`}
							/>
						))}
					</div>
					<div className="absolute inset-0 flex">
						{starPositions.map((pos, i) => (
							<button
								key={`hit-${pos}`}
								type="button"
								className="flex-1 cursor-pointer appearance-none bg-transparent"
								onMouseMove={(e) => handleMouseMove(e, i)}
								onClick={(e) => handleClick(e, i)}
								tabIndex={-1}
								aria-hidden="true"
							/>
						))}
					</div>
				</div>
			)}

			{showValue && value > 0 && (
				<span className="ml-1 font-medium text-(--foreground-muted) text-sm">
					{ratingToStars(value).toFixed(1)}
				</span>
			)}
		</div>
	);
}

export { ratingToStars, starsToRating };
