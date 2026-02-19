import { cva, type VariantProps } from "class-variance-authority";
import { Eye, EyeOff, X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Material Design 3 Text Field Component
 *
 * Two variants following Material 3 specifications:
 * - outlined: 1px outline that animates to 2px on focus
 * - filled: Surface variant background with underline
 */

const m3TextFieldVariants = cva(
	["relative w-full", "transition-all duration-200"].join(" "),
	{
		variants: {
			variant: {
				/**
				 * Outlined Text Field
				 * - 1px outline by default
				 * - 2px primary color outline on focus
				 */
				outlined: [
					"rounded-[var(--md-sys-shape-corner-extra-small)]",
					"border border-[var(--md-sys-color-outline)]",
					"bg-transparent",
					"focus-within:border-[var(--md-sys-color-primary)]",
					"focus-within:border-2",
				].join(" "),

				/**
				 * Filled Text Field
				 * - Surface variant background
				 * - Underline that animates on focus
				 */
				filled: [
					"rounded-t-[var(--md-sys-shape-corner-extra-small)]",
					"bg-[var(--md-sys-color-surface-container-highest)]",
					"border-b border-[var(--md-sys-color-on-surface-variant)]",
					"focus-within:border-b-2",
					"focus-within:border-[var(--md-sys-color-primary)]",
				].join(" "),
			},
			/**
			 * Error state
			 */
			error: {
				true: [
					"border-[var(--md-sys-color-error)]",
					"focus-within:border-[var(--md-sys-color-error)]",
				].join(" "),
				false: "",
			},
		},
		defaultVariants: {
			variant: "outlined",
			error: false,
		},
	},
);

const m3TextFieldInputVariants = cva(
	[
		"w-full bg-transparent",
		"text-[var(--md-sys-color-on-surface)]",
		"placeholder:text-[var(--md-sys-color-on-surface-variant)]",
		"outline-none",
		"md-body-large",
	].join(" "),
	{
		variants: {
			variant: {
				outlined: "py-4 px-4",
				filled: "py-4 px-4 pt-6",
			},
			hasLeadingIcon: {
				true: "pl-12",
				false: "",
			},
			hasTrailingIcon: {
				true: "pr-12",
				false: "",
			},
		},
		defaultVariants: {
			variant: "outlined",
			hasLeadingIcon: false,
			hasTrailingIcon: false,
		},
	},
);

interface M3TextFieldProps
	extends Omit<React.ComponentProps<"input">, "size">,
		VariantProps<typeof m3TextFieldVariants> {
	label?: string;
	supportingText?: string;
	leadingIcon?: React.ReactNode;
	trailingIcon?: React.ReactNode;
	errorMessage?: string;
	onClear?: () => void;
}

const M3TextField = React.forwardRef<HTMLInputElement, M3TextFieldProps>(
	(
		{
			className,
			variant = "outlined",
			error,
			label,
			supportingText,
			leadingIcon,
			trailingIcon,
			errorMessage,
			onClear,
			type = "text",
			disabled,
			value,
			defaultValue,
			...props
		},
		ref,
	) => {
		const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);
		const [isFocused, setIsFocused] = React.useState(false);
		const [hasValue, setHasValue] = React.useState(!!value || !!defaultValue);
		const inputRef = React.useRef<HTMLInputElement>(null);

		// Handle password visibility toggle
		const inputType =
			type === "password" ? (isPasswordVisible ? "text" : "password") : type;

		// Merge refs
		React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

		// Handle input changes
		const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
			setHasValue(e.target.value.length > 0);
			props.onChange?.(e);
		};

		// Determine if label should float
		const isLabelFloating = isFocused || hasValue || !!props.placeholder;

		// Clear button for text input
		const showClearButton = onClear && hasValue && !disabled;

		return (
			<div className={cn("w-full", className)}>
				<div
					className={cn(
						m3TextFieldVariants({ variant, error: !!error }),
						disabled && "opacity-38 cursor-not-allowed",
					)}
				>
					{/* Leading Icon */}
					{leadingIcon && (
						<div className="absolute left-4 top-1/2 -translate-y-1/2 text-(--md-sys-color-on-surface-variant)">
							{leadingIcon}
						</div>
					)}

					{/* Floating Label */}
					{label && (
						<label
							htmlFor={props.id || props.name}
							className={cn(
								"absolute left-4 pointer-events-none transition-all duration-200",
								variant === "filled" && "top-4",
								variant === "outlined" && "top-1/2 -translate-y-1/2",
								isLabelFloating && [
									"md-label-small",
									variant === "filled" && "top-2",
									variant === "outlined" &&
										"top-0 -translate-y-1/2 bg-(--md-sys-color-surface) px-1",
								],
								!isLabelFloating &&
									"md-body-large text-(--md-sys-color-on-surface-variant)",
								isLabelFloating &&
									(error
										? "text-(--md-sys-color-error)"
										: "text-(--md-sys-color-primary)"),
								leadingIcon && !isLabelFloating && "left-12",
							)}
						>
							{label}
						</label>
					)}

					{/* Input */}
					<input
						ref={inputRef}
						type={inputType}
						disabled={disabled}
						value={value}
						defaultValue={defaultValue}
						className={cn(
							m3TextFieldInputVariants({
								variant,
								hasLeadingIcon: !!leadingIcon,
								hasTrailingIcon:
									!!trailingIcon || showClearButton || type === "password",
							}),
						)}
						onFocus={(e) => {
							setIsFocused(true);
							props.onFocus?.(e);
						}}
						onBlur={(e) => {
							setIsFocused(false);
							props.onBlur?.(e);
						}}
						onChange={handleChange}
						{...props}
					/>

					{/* Trailing Icons */}
					<div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
						{/* Clear Button */}
						{showClearButton && (
							<button
								type="button"
								onClick={() => {
									if (inputRef.current) {
										inputRef.current.value = "";
										setHasValue(false);
										onClear();
									}
								}}
								className="text-(--md-sys-color-on-surface-variant) hover:text-(--md-sys-color-on-surface)"
							>
								<X className="w-5 h-5" />
							</button>
						)}

						{/* Password Toggle */}
						{type === "password" && (
							<button
								type="button"
								onClick={() => setIsPasswordVisible(!isPasswordVisible)}
								className="text-(--md-sys-color-on-surface-variant) hover:text-(--md-sys-color-on-surface)"
							>
								{isPasswordVisible ? (
									<EyeOff className="w-5 h-5" />
								) : (
									<Eye className="w-5 h-5" />
								)}
							</button>
						)}

						{/* Custom Trailing Icon */}
						{trailingIcon && type !== "password" && !showClearButton && (
							<span className="text-(--md-sys-color-on-surface-variant)">
								{trailingIcon}
							</span>
						)}
					</div>
				</div>

				{/* Supporting Text / Error Message */}
				{(supportingText || errorMessage) && (
					<p
						className={cn(
							"mt-1 ml-4 md-body-small",
							errorMessage
								? "text-(--md-sys-color-error)"
								: "text-(--md-sys-color-on-surface-variant)",
						)}
					>
						{errorMessage || supportingText}
					</p>
				)}
			</div>
		);
	},
);
M3TextField.displayName = "M3TextField";

export { M3TextField };
