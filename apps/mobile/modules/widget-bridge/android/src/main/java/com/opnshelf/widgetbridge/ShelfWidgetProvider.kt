package com.opnshelf.widgetbridge

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.os.Bundle

/**
 * Home-Screen Widget provider: renders the signed-in user's 30-day activity
 * graph plus total Watch count (see CONTEXT.md, "Home-Screen Widget"). All
 * rendering logic lives in [ShelfWidgetRenderer]; this class only routes the
 * system callbacks. Refreshes come from Android's 30-minute periodic tick and
 * from app-triggered updates via [requestUpdate] (watch log/remove, login,
 * logout, theme change).
 */
class ShelfWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        for (id in appWidgetIds) {
            ShelfWidgetRenderer.refresh(context, appWidgetManager, id)
        }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle?,
    ) {
        // The graph bitmap is sized to the widget, so a resize needs a redraw.
        ShelfWidgetRenderer.refresh(context, appWidgetManager, appWidgetId)
    }

    companion object {
        /** Redraw every placed widget instance. No-op when none are placed. */
        fun requestUpdate(context: Context) {
            val manager = AppWidgetManager.getInstance(context) ?: return
            val ids = manager.getAppWidgetIds(
                ComponentName(context, ShelfWidgetProvider::class.java),
            )
            for (id in ids) {
                ShelfWidgetRenderer.refresh(context, manager, id)
            }
        }
    }
}
