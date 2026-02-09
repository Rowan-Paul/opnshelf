import { configureApiClient, setSessionToken } from "@opnshelf/api";
import * as SecureStore from "expo-secure-store";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:3001";

const SESSION_TOKEN_KEY = "opnshelf_session_token";

export function initializeApiClient() {
	configureApiClient(API_URL);
}

export async function loadSessionToken(): Promise<string | null> {
	try {
		const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
		if (token) {
			setSessionToken(token);
		}
		return token;
	} catch (error) {
		console.error("Failed to load session token:", error);
		return null;
	}
}

export async function saveSessionToken(token: string | null): Promise<void> {
	try {
		if (token) {
			await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
			setSessionToken(token);
		} else {
			await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
			setSessionToken(null);
		}
	} catch (error) {
		console.error("Failed to save session token:", error);
	}
}
