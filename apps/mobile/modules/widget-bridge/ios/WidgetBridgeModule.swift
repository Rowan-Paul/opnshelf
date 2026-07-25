import ExpoModulesCore
import WidgetKit

/// JS → widget bridge, the iOS twin of `WidgetBridgeModule.kt`. The app pushes
/// only identity-level state (handle, theme preference, API base URL) into the
/// shared app group; the widget fetches and renders everything itself. Never a
/// session token — the profile endpoint the widget reads is public (ADR 0017).
///
/// The app group suite name and keys are duplicated in the widget target
/// (`targets/widget/index.swift`) — Apple extensions are separate compilation
/// units, and a shared framework for four string constants isn't worth it.
public class WidgetBridgeModule: Module {
  private static let appGroup = "group.com.rowanpaul.opnshelf"

  private var defaults: UserDefaults? {
    UserDefaults(suiteName: Self.appGroup)
  }

  public func definition() -> ModuleDefinition {
    Name("WidgetBridge")

    // nil clears the widget (sign-out, expired session, account switch).
    Function("setWidgetHandle") { (handle: String?) in
      let trimmed = handle?.trimmingCharacters(in: .whitespacesAndNewlines)
      if let trimmed, !trimmed.isEmpty {
        self.defaults?.set(trimmed, forKey: "handle")
      } else {
        self.defaults?.removeObject(forKey: "handle")
        self.defaults?.removeObject(forKey: "lastData")
      }
      self.reload()
    }

    // "light" | "dark" | "system"; mirrors the in-app appearance setting.
    Function("setWidgetTheme") { (theme: String) in
      self.defaults?.set(theme, forKey: "theme")
      self.reload()
    }

    // Build-time API origin; written once at app startup.
    Function("setWidgetApiUrl") { (apiUrl: String) in
      self.defaults?.set(apiUrl, forKey: "apiUrl")
    }

    // Called after watch log/remove so the widget converges immediately
    // instead of waiting for the next hourly timeline entry.
    Function("requestWidgetUpdate") {
      self.reload()
    }
  }

  /// No-op when no widget is placed.
  private func reload() {
    WidgetCenter.shared.reloadAllTimelines()
  }
}
