package com.opnshelf.widgetbridge

import android.content.Context
import android.content.SharedPreferences

/**
 * Shared state between the app and the Home-Screen Widget. Only the signed-in
 * user's handle, theme preference, and API base URL are ever stored here —
 * never a session token. The widget fetches the public profile endpoint, so
 * it needs no credentials (see ADR 0017). `lastData` caches the most recent
 * successful profile payload so the widget renders instantly and survives
 * transient network failures.
 */
object WidgetPrefs {
    private const val PREFS = "opnshelf_widget_bridge"
    private const val KEY_HANDLE = "handle"
    private const val KEY_THEME = "theme"
    private const val KEY_API_URL = "apiUrl"
    private const val KEY_LAST_DATA = "lastData"

    private fun prefs(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun getHandle(context: Context): String? = prefs(context).getString(KEY_HANDLE, null)

    fun setHandle(context: Context, handle: String?) {
        prefs(context).edit().apply {
            if (handle == null) {
                remove(KEY_HANDLE)
                remove(KEY_LAST_DATA)
            } else {
                putString(KEY_HANDLE, handle)
            }
            apply()
        }
    }

    fun getTheme(context: Context): String = prefs(context).getString(KEY_THEME, "system") ?: "system"

    fun setTheme(context: Context, theme: String) {
        prefs(context).edit().putString(KEY_THEME, theme).apply()
    }

    fun getApiUrl(context: Context): String? = prefs(context).getString(KEY_API_URL, null)

    fun setApiUrl(context: Context, apiUrl: String) {
        prefs(context).edit().putString(KEY_API_URL, apiUrl).apply()
    }

    fun getLastData(context: Context): String? = prefs(context).getString(KEY_LAST_DATA, null)

    fun setLastData(context: Context, data: String) {
        prefs(context).edit().putString(KEY_LAST_DATA, data).apply()
    }
}
