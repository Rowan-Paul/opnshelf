import SwiftUI
import WidgetKit

/// Home-Screen Widget: the signed-in user's 30-day activity graph plus its
/// total Watch count, the iOS twin of `ShelfWidgetProvider.kt` /
/// `ShelfWidgetRenderer.kt`. Data comes from the unauthenticated
/// `GET /users/:handle/profile` endpoint — the app shares only the handle,
/// never a session token (ADR 0017). The payload already buckets
/// `activityLast30Days` in the owner's timezone (ADR 0005), so no date math
/// happens here.

// MARK: - Shared state

/// Mirrors `modules/widget-bridge/ios/WidgetBridgeModule.swift`. Extensions are
/// separate compilation units; duplicating four keys beats a shared framework.
private enum Prefs {
	static let appGroup = "group.com.rowanpaul.opnshelf"

	private static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }

	static var handle: String? {
		defaults?.string(forKey: "handle").flatMap { $0.isEmpty ? nil : $0 }
	}
	static var theme: String { defaults?.string(forKey: "theme") ?? "system" }
	static var apiUrl: String? { defaults?.string(forKey: "apiUrl") }

	/// Last successful payload, so the widget renders instantly on a cold
	/// timeline refresh and survives transient network failures.
	static var lastData: Data? { defaults?.data(forKey: "lastData") }
	static func cache(_ data: Data) { defaults?.set(data, forKey: "lastData") }
}

// MARK: - Data

private struct DayCount: Decodable {
	let date: String
	let count: Int
}

private struct ProfilePayload: Decodable {
	let activityLast30Days: [DayCount]
}

private func decodeDays(_ data: Data) -> [DayCount] {
	(try? JSONDecoder().decode(ProfilePayload.self, from: data))?.activityLast30Days ?? []
}

/// One tiny JSON GET against the public profile endpoint; nil on any failure.
private func fetchProfile(handle: String) async -> Data? {
	guard
		let base = Prefs.apiUrl,
		let escaped = handle.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed),
		let url = URL(string: "\(base.hasSuffix("/") ? String(base.dropLast()) : base)/users/\(escaped)/profile")
	else { return nil }

	var request = URLRequest(url: url, timeoutInterval: 8)
	request.setValue("application/json", forHTTPHeaderField: "Accept")

	guard
		let (data, response) = try? await URLSession.shared.data(for: request),
		let status = (response as? HTTPURLResponse)?.statusCode,
		(200..<300).contains(status)
	else { return nil }

	return data
}

// MARK: - Timeline

private struct ActivityEntry: TimelineEntry {
	let date: Date
	/// nil renders the signed-out placeholder.
	let handle: String?
	let days: [DayCount]

	static let placeholder = ActivityEntry(
		date: Date(),
		handle: "you",
		days: (0..<30).map { DayCount(date: "", count: [0, 0, 1, 3, 2, 0, 5][$0 % 7]) }
	)
}

private struct Provider: TimelineProvider {
	func placeholder(in context: Context) -> ActivityEntry { .placeholder }

	func getSnapshot(in context: Context, completion: @escaping (ActivityEntry) -> Void) {
		guard let handle = Prefs.handle else {
			completion(ActivityEntry(date: Date(), handle: nil, days: []))
			return
		}
		// Snapshots must be fast: render the cache, never the network.
		completion(
			ActivityEntry(date: Date(), handle: handle, days: Prefs.lastData.map(decodeDays) ?? [])
		)
	}

	func getTimeline(in context: Context, completion: @escaping (Timeline<ActivityEntry>) -> Void) {
		Task {
			let entry = await load()
			// Hourly refresh, matching Android's periodic tick. App-triggered
			// reloads (watch log/remove, login, logout, theme change) come
			// through WidgetCenter and pre-empt this.
			completion(Timeline(entries: [entry], policy: .after(entry.date.addingTimeInterval(3600))))
		}
	}

	private func load() async -> ActivityEntry {
		guard let handle = Prefs.handle else {
			return ActivityEntry(date: Date(), handle: nil, days: [])
		}
		if let fresh = await fetchProfile(handle: handle) {
			Prefs.cache(fresh)
			return ActivityEntry(date: Date(), handle: handle, days: decodeDays(fresh))
		}
		// Fetch failed: fall back to the cache, or an empty graph if there is none.
		return ActivityEntry(date: Date(), handle: handle, days: Prefs.lastData.map(decodeDays) ?? [])
	}
}

// MARK: - Rendering

/// Palette mirrors the app theme tokens (src/theme/index.ts, global.css) and
/// the Android widget's.
private struct Palette {
	let background: Color
	let accent: Color
	let emptyBar: Color
	let textMuted: Color

	static let light = Palette(
		background: Color(red: 1, green: 1, blue: 1),
		accent: Color(red: 0.953, green: 0.737, blue: 0),
		emptyBar: Color(red: 0.886, green: 0.910, blue: 0.941),
		textMuted: Color(red: 0.392, green: 0.455, blue: 0.545)
	)

	static let dark = Palette(
		background: Color(red: 0.059, green: 0.090, blue: 0.165),
		accent: Color(red: 0.984, green: 0.749, blue: 0.141),
		emptyBar: Color(red: 0.118, green: 0.161, blue: 0.231),
		textMuted: Color(red: 0.580, green: 0.639, blue: 0.722)
	)

	/// Resolves the in-app appearance preference, falling back to the OS for
	/// `system`.
	static func resolve(preference: String, system: ColorScheme) -> Palette {
		switch preference {
		case "light": return .light
		case "dark": return .dark
		default: return system == .dark ? .dark : .light
		}
	}
}

private struct ActivityGraph: View {
	let days: [DayCount]
	let palette: Palette

	var body: some View {
		let max = Swift.max(days.map(\.count).max() ?? 1, 1)
		GeometryReader { geometry in
			HStack(alignment: .bottom, spacing: 2) {
				ForEach(Array(days.enumerated()), id: \.offset) { _, day in
					// Bar math mirrors the in-app activity graph exactly: zero
					// days get a 4% stub, watched days at least 12% so single
					// watches stay visible.
					let fraction = day.count > 0
						? Swift.max(Double(day.count) / Double(max), 0.12)
						: 0.04
					RoundedRectangle(cornerRadius: 2)
						.fill(day.count > 0 ? palette.accent : palette.emptyBar)
						.frame(height: Swift.max(geometry.size.height * fraction, 1))
				}
			}
			.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
		}
	}
}

private struct ShelfWidgetView: View {
	@Environment(\.colorScheme) private var colorScheme
	let entry: ActivityEntry

	var body: some View {
		let palette = Palette.resolve(preference: Prefs.theme, system: colorScheme)

		Group {
			if let handle = entry.handle {
				VStack(alignment: .leading, spacing: 8) {
					// systemSmall is narrow enough that the two labels collide;
					// shrink rather than wrap to a second line.
					HStack {
						Text("Last 30 days")
						Spacer(minLength: 4)
						Text("\(entry.days.reduce(0) { $0 + $1.count }) watched")
					}
					.font(.caption)
					.lineLimit(1)
					.minimumScaleFactor(0.7)
					.foregroundStyle(palette.textMuted)

					ActivityGraph(days: entry.days, palette: palette)
				}
				.widgetURL(URL(string: "opnshelf://profile/\(handle)"))
			} else {
				Text("Sign in to opnshelf to see your watch activity")
					.font(.footnote)
					.multilineTextAlignment(.center)
					.foregroundStyle(palette.textMuted)
					.frame(maxWidth: .infinity, maxHeight: .infinity)
					.widgetURL(URL(string: "opnshelf://login"))
			}
		}
		.containerBackground(palette.background, for: .widget)
	}
}

// MARK: - Widget

struct ShelfWidget: Widget {
	var body: some WidgetConfiguration {
		StaticConfiguration(kind: "ShelfActivityWidget", provider: Provider()) { entry in
			ShelfWidgetView(entry: entry)
		}
		.configurationDisplayName("Watch activity")
		.description("Your opnshelf watch activity over the last 30 days")
		.supportedFamilies([.systemSmall, .systemMedium])
	}
}

@main
struct ShelfWidgetBundle: WidgetBundle {
	var body: some Widget {
		ShelfWidget()
	}
}
