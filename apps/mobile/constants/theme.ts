export const colors = {
	// Background
	background: "#030712", // gray-950
	card: "#111827", // gray-900
	cardMuted: "#1f2937", // gray-800
	
	// Text
	text: "#f9fafb", // gray-50
	textMuted: "#9ca3af", // gray-400
	textSecondary: "#6b7280", // gray-500
	
	// Brand
	primary: "#8b5cf6", // purple-500
	primaryLight: "#a78bfa", // purple-400
	primaryDark: "#7c3aed", // purple-600
	
	// Accents
	accent: "#a855f7", // purple-600
	secondary: "#6366f1", // indigo-500
	
	// Status
	success: "#22c55e", // green-500
	error: "#ef4444", // red-500
	warning: "#f59e0b", // amber-500
	
	// Borders
	border: "#1f2937", // gray-800
	borderLight: "#374151", // gray-700
} as const;

export const spacing = {
	xs: 4,
	sm: 8,
	md: 16,
	lg: 24,
	xl: 32,
	xxl: 48,
} as const;

export const borderRadius = {
	sm: 4,
	md: 8,
	lg: 12,
	xl: 16,
	xxl: 24,
	full: 9999,
} as const;
