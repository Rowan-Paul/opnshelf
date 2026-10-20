import AppIntents
internal import ExpoAppIntents

/// Opens the chooser only. Authentication and Onboarding stay in the app.
struct PickForMeIntent: AppIntent {
  static let title: LocalizedStringResource = "Pick for me"
  static let description = IntentDescription("Open Pick for me to choose what to watch.")
  static let openAppWhenRun = true

  @MainActor
  func perform() async throws -> some IntentResult {
    try Task.checkCancellation()
    await AppIntentDispatcher.shared.dispatch(name: "openPickForMe")
    return .result()
  }
}

struct OpnshelfShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: PickForMeIntent(),
      phrases: ["Pick for me in \(.applicationName)", "Choose what to watch in \(.applicationName)"],
      shortTitle: "Pick for me",
      systemImageName: "shuffle"
    )
    AppShortcut(intent: OpenUpNextIntent(), phrases: ["Show my Up Next in \(.applicationName)"], shortTitle: "Up Next", systemImageName: "play.rectangle")
    AppShortcut(intent: SearchTitlesIntent(), phrases: ["Find a title in \(.applicationName)"], shortTitle: "Search for a title", systemImageName: "magnifyingglass")
    AppShortcut(intent: PickForAvailableTimeIntent(), phrases: ["Pick for my available time in \(.applicationName)"], shortTitle: "Pick for my time", systemImageName: "clock")
    AppShortcut(intent: OpenWatchlistIntent(), phrases: ["Open my watchlist in \(.applicationName)"], shortTitle: "My watchlist", systemImageName: "bookmark")
    AppShortcut(intent: AddToWatchlistIntent(), phrases: ["Add to my watchlist in \(.applicationName)"], shortTitle: "Add to watchlist", systemImageName: "bookmark.fill")
  }
}
