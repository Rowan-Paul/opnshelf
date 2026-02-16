import { M3SnackbarProvider, useSnackbar } from "@/components/ui/m3/M3Snackbar";

export const ToastProvider = M3SnackbarProvider;

export function useToast() {
	const { showSnackbar } = useSnackbar();
	return { showToast: showSnackbar };
}
