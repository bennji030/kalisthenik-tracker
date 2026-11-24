import ActivityKit
import Foundation

// Gemeinsame Datei: gehört zu beiden Targets (App und RestWidget).
// Alle Daten reisen im ContentState mit, deshalb ist keine App Group nötig.
struct RestActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var startedAt: Date
        var endsAt: Date
        var exercise: String
        // z. B. "Satz 2/4"; darf leer sein
        var set: String
    }
}
