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
  }
}
