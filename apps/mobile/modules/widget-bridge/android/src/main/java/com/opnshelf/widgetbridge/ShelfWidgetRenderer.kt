package com.opnshelf.widgetbridge

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Fetches the public profile payload and renders it into RemoteViews: a
 * 30-bar activity graph drawn to a [Bitmap] (RemoteViews can't draw custom
 * views, so charts go through `setImageViewBitmap`) plus the total Watch
 * count. Signed-out state shows a placeholder deep-linking to login.
 *
 * Data comes from the unauthenticated `GET /users/:handle/profile` endpoint —
 * the payload already includes `activityLast30Days` bucketed in the owner's
 * timezone (ADR 0005), so no date math happens here.
 */
object ShelfWidgetRenderer {
    private val executor = Executors.newSingleThreadExecutor()

    private data class DayCount(val date: String, val count: Int)

    /** Palette mirrors the app theme tokens (src/theme/index.ts, global.css). */
    private data class Palette(
        val backgroundRes: Int,
        val accent: Int,
        val emptyBar: Int,
        val textMuted: Int,
    )

    private val LIGHT = Palette(
        backgroundRes = R.drawable.widget_bg_light,
        accent = Color.parseColor("#f3bc00"),
        emptyBar = Color.parseColor("#e2e8f0"),
        textMuted = Color.parseColor("#64748b"),
    )

    private val DARK = Palette(
        backgroundRes = R.drawable.widget_bg_dark,
        accent = Color.parseColor("#fbbf24"),
        emptyBar = Color.parseColor("#1e293b"),
        textMuted = Color.parseColor("#94a3b8"),
    )

    /**
     * Re-render one widget instance: last-known data immediately when present,
     * then a fresh fetch on a background thread. Called by the periodic tick,
     * resize, and every app-triggered update.
     */
    fun refresh(context: Context, manager: AppWidgetManager, widgetId: Int) {
        val handle = WidgetPrefs.getHandle(context)
        if (handle.isNullOrBlank()) {
            renderSignedOut(context, manager, widgetId)
            return
        }

        val cached = WidgetPrefs.getLastData(context)
        if (cached != null) {
            renderData(context, manager, widgetId, handle, parseDays(cached))
        }

        val apiUrl = WidgetPrefs.getApiUrl(context)
        executor.execute {
            val fresh = apiUrl?.let { fetchProfile(it, handle) }
            when {
                fresh != null -> {
                    WidgetPrefs.setLastData(context, fresh)
                    renderData(context, manager, widgetId, handle, parseDays(fresh))
                }
                cached == null -> {
                    // Nothing cached and the fetch failed: render an empty
                    // graph rather than leaving a stale or blank widget.
                    renderData(context, manager, widgetId, handle, emptyList())
                }
            }
        }
    }

    private fun renderSignedOut(context: Context, manager: AppWidgetManager, widgetId: Int) {
        val palette = resolvePalette(context)
        val views = baseViews(context, palette)
        views.setViewVisibility(R.id.widget_header, View.GONE)
        views.setViewVisibility(R.id.widget_graph, View.GONE)
        views.setViewVisibility(R.id.widget_signed_out, View.VISIBLE)
        views.setTextColor(R.id.widget_signed_out, palette.textMuted)
        views.setOnClickPendingIntent(
            R.id.widget_root,
            contentIntent(context, widgetId, "opnshelf://login"),
        )
        manager.updateAppWidget(widgetId, views)
    }

    private fun renderData(
        context: Context,
        manager: AppWidgetManager,
        widgetId: Int,
        handle: String,
        days: List<DayCount>,
    ) {
        val palette = resolvePalette(context)
        val views = baseViews(context, palette)
        views.setViewVisibility(R.id.widget_header, View.VISIBLE)
        views.setViewVisibility(R.id.widget_graph, View.VISIBLE)
        views.setViewVisibility(R.id.widget_signed_out, View.GONE)
        views.setTextViewText(
            R.id.widget_total,
            context.getString(R.string.widget_total_watched, days.sumOf { it.count }),
        )
        views.setImageViewBitmap(R.id.widget_graph, drawGraph(context, manager, widgetId, days, palette))
        views.setOnClickPendingIntent(
            R.id.widget_root,
            contentIntent(context, widgetId, "opnshelf://profile/$handle"),
        )
        manager.updateAppWidget(widgetId, views)
    }

    private fun baseViews(context: Context, palette: Palette): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_activity_graph)
        views.setInt(R.id.widget_root, "setBackgroundResource", palette.backgroundRes)
        views.setTextColor(R.id.widget_title, palette.textMuted)
        views.setTextColor(R.id.widget_total, palette.textMuted)
        return views
    }

    /** Resolves the in-app theme preference, falling back to the OS for `system`. */
    private fun resolvePalette(context: Context): Palette {
        return when (WidgetPrefs.getTheme(context)) {
            "light" -> LIGHT
            "dark" -> DARK
            else -> {
                val night = context.resources.configuration.uiMode and
                    Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
                if (night) DARK else LIGHT
            }
        }
    }

    /**
     * Bar math mirrors the in-app activity graph exactly: zero days get a 4%
     * stub, watched days at least 12% so single watches stay visible.
     */
    private fun drawGraph(
        context: Context,
        manager: AppWidgetManager,
        widgetId: Int,
        days: List<DayCount>,
        palette: Palette,
    ): Bitmap {
        val density = context.resources.displayMetrics.density
        val options = manager.getAppWidgetOptions(widgetId)
        val widthDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 250)
        val heightDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 80)
        // The header row and the layout's 12dp padding live outside the bitmap.
        val headerDp = 28
        val paddingDp = 24
        val graphHeightDp = (heightDp - headerDp - paddingDp).coerceAtLeast(24)

        val widthPx = (widthDp * density).toInt().coerceAtLeast(1)
        val heightPx = (graphHeightDp * density).toInt().coerceAtLeast(1)
        val bitmap = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888)
        if (days.isEmpty()) return bitmap

        val canvas = Canvas(bitmap)
        val gap = 3f * density
        val barWidth = (widthPx - gap * (days.size - 1)) / days.size
        val max = days.maxOf { it.count }.coerceAtLeast(1)
        val cornerRadius = 2f * density
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)

        days.forEachIndexed { index, day ->
            val heightPct = if (day.count > 0) {
                (day.count.toFloat() / max).coerceAtLeast(0.12f)
            } else {
                0.04f
            }
            val left = index * (barWidth + gap)
            val top = heightPx * (1f - heightPct)
            paint.color = if (day.count > 0) palette.accent else palette.emptyBar
            canvas.drawRoundRect(
                RectF(left, top, left + barWidth, heightPx.toFloat()),
                cornerRadius,
                cornerRadius,
                paint,
            )
        }
        return bitmap
    }

    private fun contentIntent(context: Context, widgetId: Int, deepLink: String): PendingIntent {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(deepLink)).apply {
            setPackage(context.packageName)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        return PendingIntent.getActivity(
            context,
            widgetId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    /** One tiny JSON GET against the public profile endpoint; null on any failure. */
    private fun fetchProfile(apiUrl: String, handle: String): String? {
        val url = URL("${apiUrl.trimEnd('/')}/users/${Uri.encode(handle)}/profile")
        val connection = (url.openConnection() as? HttpURLConnection) ?: return null
        return try {
            connection.connectTimeout = 8000
            connection.readTimeout = 8000
            connection.requestMethod = "GET"
            connection.setRequestProperty("Accept", "application/json")
            if (connection.responseCode !in 200..299) return null
            connection.inputStream.bufferedReader().use { it.readText() }
        } catch (_: Exception) {
            null
        } finally {
            connection.disconnect()
        }
    }

    private fun parseDays(json: String): List<DayCount> {
        return try {
            val array = JSONObject(json).optJSONArray("activityLast30Days") ?: return emptyList()
            (0 until array.length()).mapNotNull { index ->
                array.optJSONObject(index)?.let { day ->
                    DayCount(date = day.optString("date"), count = day.optInt("count"))
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }
}
