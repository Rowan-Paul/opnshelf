import AppIntents
import Foundation
internal import ExpoAppIntents

struct OpenUpNextIntent: AppIntent {
  static let title: LocalizedStringResource = "Open Up Next"
  static let openAppWhenRun = true
  @MainActor func perform() async throws -> some IntentResult {
    try Task.checkCancellation()
    await AppIntentDispatcher.shared.dispatch(name: "openUpNext")
    return .result()
  }
}

struct OpenWatchlistIntent: AppIntent {
  static let title: LocalizedStringResource = "Open my watchlist"
  static let openAppWhenRun = true
  @MainActor func perform() async throws -> some IntentResult {
    try Task.checkCancellation()
    await AppIntentDispatcher.shared.dispatch(name: "openWatchlist")
    return .result()
  }
}

struct SearchTitlesIntent: AppIntent {
  static let title: LocalizedStringResource = "Search for a title"
  static let openAppWhenRun = true
  @Parameter(title: "Title", requestValueDialog: "What title are you looking for?")
  var query: String
  static var parameterSummary: some ParameterSummary { Summary("Search for \(\.$query)") }
  @MainActor func perform() async throws -> some IntentResult {
    let title = query.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !title.isEmpty, title.count <= 200 else {
      throw $query.needsValueError("Enter a title between 1 and 200 characters.")
    }
    try Task.checkCancellation()
    await AppIntentDispatcher.shared.dispatch(name: "searchTitles", params: ["query": .string(title)])
    return .result()
  }
}

struct AddToWatchlistIntent: AppIntent {
  static let title: LocalizedStringResource = "Add to watchlist"
  static let description = IntentDescription("Find a title or open an Opnshelf or TMDB movie/show link, then confirm in the app.")
  static let openAppWhenRun = true
  @Parameter(title: "Title or link", requestValueDialog: "What movie or show would you like to add?")
  var input: String
  static var parameterSummary: some ParameterSummary { Summary("Add \(\.$input) to my watchlist") }
  @MainActor func perform() async throws -> some IntentResult {
    let value = input.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !value.isEmpty, value.count <= 2048 else {
      throw $input.needsValueError("Enter a title or an Opnshelf or TMDB movie/show link.")
    }
    if value.contains("://") || value.lowercased().hasPrefix("www.") {
      guard let url = URLComponents(string: value),
        ["https", "http"].contains(url.scheme?.lowercased() ?? ""),
        ["opnshelf.xyz", "www.opnshelf.xyz", "staging.opnshelf.xyz", "themoviedb.org", "www.themoviedb.org"].contains(url.host?.lowercased() ?? ""),
        url.user == nil, url.password == nil, url.port == nil,
        url.path.range(of: (url.host?.contains("themoviedb.org") == true ? "^/(movie|tv)/[1-9][0-9]*(?:-[^/]+)?/?$" : "^/(movies|shows)/[1-9][0-9]*(?:/[^/]+)?/?$"), options: .regularExpression) != nil
      else { throw $input.needsValueError("Use an Opnshelf or TMDB movie/show link, or enter a title.") }
    } else if value.count > 200 {
      throw $input.needsValueError("Enter a title of at most 200 characters, or a supported movie/show link.")
    }
    try Task.checkCancellation()
    await AppIntentDispatcher.shared.dispatch(name: "addToWatchlist", params: ["input": .string(value)])
    return .result()
  }
}

enum PickerMediaType: String, AppEnum {
  case both, movie, show
  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Media type"
  static let caseDisplayRepresentations: [PickerMediaType: DisplayRepresentation] = [
    .both: "Movies and shows", .movie: "Movies", .show: "Shows"
  ]
}

struct PickForAvailableTimeIntent: AppIntent {
  static let title: LocalizedStringResource = "Pick for my available time"
  static let openAppWhenRun = true
  @Parameter(title: "Minutes", inclusiveRange: (1, 1440), requestValueDialog: "How many minutes do you have?")
  var minutes: Int
  @Parameter(title: "Media type", default: .both)
  var mediaType: PickerMediaType
  static var parameterSummary: some ParameterSummary {
    Summary("Pick for \(\.$minutes) minutes") { \.$mediaType }
  }
  @MainActor func perform() async throws -> some IntentResult {
    guard (1...1440).contains(minutes) else {
      throw $minutes.needsValueError("Choose between 1 and 1440 minutes.")
    }
    try Task.checkCancellation()
    await AppIntentDispatcher.shared.dispatch(name: "openTimedPickForMe", params: [
      "minutes": .int(minutes), "type": .string(mediaType.rawValue)
    ])
    return .result()
  }
}
