package com.opnshelf.widgetbridge

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * JS → widget bridge. The app pushes only identity-level state (handle, theme
 * preference, API base URL) and update triggers; the widget fetches and
 * renders everything itself. All functions are safe to call when no widget is
 * placed — [ShelfWidgetProvider.requestUpdate] is then a no-op.
 */
class WidgetBridgeModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("WidgetBridge")

		// null clears the widget (sign-out, expired session, account switch).
		Function("setWidgetHandle") { handle: String? ->
			appContext.reactContext?.let { context ->
				WidgetPrefs.setHandle(context, handle?.takeIf { it.isNotBlank() })
				ShelfWidgetProvider.requestUpdate(context)
			}
		}

		// "light" | "dark" | "system"; mirrors the in-app appearance setting.
		Function("setWidgetTheme") { theme: String ->
			appContext.reactContext?.let { context ->
				WidgetPrefs.setTheme(context, theme)
				ShelfWidgetProvider.requestUpdate(context)
			}
		}

		// Build-time API origin; written once at app startup.
		Function("setWidgetApiUrl") { apiUrl: String ->
			appContext.reactContext?.let { context ->
				WidgetPrefs.setApiUrl(context, apiUrl)
			}
		}

		// Called after watch log/remove so the widget converges immediately
		// instead of waiting for the 30-minute periodic tick.
		Function("requestWidgetUpdate") {
			appContext.reactContext?.let { context ->
				ShelfWidgetProvider.requestUpdate(context)
			}
		}
    }
}
