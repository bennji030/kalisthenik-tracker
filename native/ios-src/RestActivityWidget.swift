import ActivityKit
import SwiftUI
import WidgetKit

// Nur RestWidget-Target.

// Akzentfarbe der App: --accent aus src/styles.css, dunkles Thema (#ff7a3d). Auch für die immer dunkle Dynamic Island.
private let accent = Color(red: 1.0, green: 0.478, blue: 0.239)
// --accent im hellen Thema (#c4470f): genug Kontrast auf dem hellen Sperrbildschirm
private let accentLight = Color(red: 0.769, green: 0.278, blue: 0.059)

@main
struct RestWidgetBundle: WidgetBundle {
    var body: some Widget {
        RestActivityWidget()
    }
}

struct RestActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RestActivityAttributes.self) { context in
            RestLockScreen(state: context.state, isStale: context.isStale)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.center) {
                    RestTitle(state: context.state)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    RestCountdown(state: context.state, isStale: context.isStale, color: accent)
                        .font(.title2.weight(.semibold))
                        .frame(maxWidth: 110, alignment: .trailing)
                }
            } compactLeading: {
                Image(systemName: "timer")
                    .foregroundStyle(accent)
            } compactTrailing: {
                if context.isStale {
                    Image(systemName: "checkmark")
                        .foregroundStyle(accent)
                } else {
                    // feste Breite, sonst füllt der Timer-Text die ganze Insel
                    RestCountdown(state: context.state, isStale: false, color: accent)
                        .frame(maxWidth: 48)
                }
            } minimal: {
                Image(systemName: context.isStale ? "checkmark" : "timer")
                    .foregroundStyle(accent)
            }
            .keylineTint(accent)
        }
    }
}

// Sperrbildschirm und Banner; die Farbe folgt dem hellen oder dunklen Erscheinungsbild.
struct RestLockScreen: View {
    @Environment(\.colorScheme) private var colorScheme
    let state: RestActivityAttributes.ContentState
    let isStale: Bool

    var body: some View {
        HStack(spacing: 12) {
            RestTitle(state: state)
            Spacer(minLength: 8)
            RestCountdown(state: state, isStale: isStale, color: colorScheme == .dark ? accent : accentLight)
                .font(.system(size: 40, weight: .semibold))
                .frame(maxWidth: 150, alignment: .trailing)
        }
        .padding(16)
    }
}

// Übung und Satz; der Satz fällt weg, wenn er leer ist.
struct RestTitle: View {
    let state: RestActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(state.exercise)
                .font(.headline)
                .lineLimit(1)
            if !state.set.isEmpty {
                Text(state.set)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
    }
}

// Nativer Countdown, läuft ohne die App weiter. Nach Pausenende (isStale) steht dort "Pause vorbei".
struct RestCountdown: View {
    let state: RestActivityAttributes.ContentState
    let isStale: Bool
    let color: Color

    var body: some View {
        if isStale {
            Text("Pause vorbei")
                .font(.headline)
                .foregroundStyle(color)
        } else {
            // min(): ein Bereich mit Anfang nach Ende würde abstürzen
            Text(timerInterval: min(state.startedAt, state.endsAt)...state.endsAt, countsDown: true)
                .monospacedDigit()
                .multilineTextAlignment(.trailing)
                .foregroundStyle(color)
        }
    }
}
