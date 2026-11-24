import Capacitor
import Foundation
import HealthKit

// Achtung, ungetestet: ohne Mac geschrieben, nie kompiliert. Kompiliert und nachgebessert wird auf dem Mac
// (native/README.md, Abschnitt 17).
// Nur App-Target. Von src/native.ts als Plugin "HealthDays" aufgerufen.
// Liest nur (nichts wird in Health geschrieben): Schritte, gegessene Kalorien, Protein, Aktiv- und Ruheenergie
// als Tagessummen. Aktiv- und Ruheenergie gehen getrennt zurück, addiert wird in src/healthKit.ts.
@objc(HealthDaysPlugin)
public class HealthDaysPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthDaysPlugin"
    public let jsName = "HealthDays"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readDays", returnType: CAPPluginReturnPromise)
    ]

    private let store = HKHealthStore()

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject(unavailable)
            return
        }
        let store = self.store
        let reply = Reply(call: call)
        Task {
            do {
                let types = Set(Metric.allCases.map { $0.type as HKObjectType })
                try await store.requestAuthorization(toShare: [], read: types)
                await reply.resolve([:])
            } catch {
                await reply.reject(error.localizedDescription)
            }
        }
    }

    // since: "YYYY-MM-DD" (lokaler Tag). Antwort: { days: [{ date, steps?, kcal?, proteinG?, activeKcal?, basalKcal? }] }.
    @objc func readDays(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject(unavailable)
            return
        }
        guard let text = call.getString("since"), text.count == 10, let since = dayFormatter().date(from: text) else {
            call.reject("since fehlt oder ist kein Datum (JJJJ-MM-TT)")
            return
        }
        let start = Calendar.current.startOfDay(for: since)
        let end = Date()
        guard start <= end else {
            call.resolve(["days": [[String: Any]]()])
            return
        }
        let store = self.store
        let reply = Reply(call: call)
        Task {
            do {
                var byDate: [String: [String: Any]] = [:]
                for metric in Metric.allCases {
                    let sums = try await dailySums(store: store, metric: metric, start: start, end: end)
                    for (date, value) in sums {
                        var day = byDate[date] ?? ["date": date]
                        day[metric.rawValue] = value
                        byDate[date] = day
                    }
                }
                let days: [[String: Any]] = byDate.keys.sorted().compactMap { byDate[$0] }
                await reply.resolve(["days": days])
            } catch {
                await reply.reject(error.localizedDescription)
            }
        }
    }
}

private let unavailable = "Apple Health ist auf diesem Gerät nicht verfügbar"

// Der rawValue ist der Schlüssel in der Antwort an die App.
private enum Metric: String, CaseIterable {
    case steps, kcal, proteinG, activeKcal, basalKcal

    var type: HKQuantityType {
        switch self {
        case .steps: return HKQuantityType(.stepCount)
        case .kcal: return HKQuantityType(.dietaryEnergyConsumed)
        case .proteinG: return HKQuantityType(.dietaryProtein)
        case .activeKcal: return HKQuantityType(.activeEnergyBurned)
        case .basalKcal: return HKQuantityType(.basalEnergyBurned)
        }
    }

    var unit: HKUnit {
        switch self {
        case .steps: return HKUnit.count()
        case .proteinG: return HKUnit.gram()
        case .kcal, .activeKcal, .basalKcal: return HKUnit.kilocalorie()
        }
    }
}

// "yyyy-MM-dd" in der lokalen Zeitzone, unabhängig von Sprache und Kalender des iPhones.
private func dayFormatter() -> DateFormatter {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.timeZone = TimeZone.current
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.isLenient = false
    return formatter
}

// Tagessummen eines Typs ab start (lokale Mitternacht), Schlüssel = lokaler Tag; Tage ohne Wert fehlen.
// Die Statistik von HealthKit zählt Schritte von iPhone und Uhr nicht doppelt.
private func dailySums(store: HKHealthStore, metric: Metric, start: Date, end: Date) async throws -> [String: Double] {
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<[String: Double], Error>) in
        let query = HKStatisticsCollectionQuery(
            quantityType: metric.type,
            quantitySamplePredicate: HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate),
            options: .cumulativeSum,
            anchorDate: start,
            intervalComponents: DateComponents(day: 1)
        )
        // Nur das erste Ergebnis, kein Update-Handler: der Handler läuft genau einmal.
        query.initialResultsHandler = { _, collection, error in
            if let error {
                // "Keine Daten" ist kein Fehler: dann gibt es für diesen Typ einfach keine Werte.
                if (error as? HKError)?.code == .errorNoData {
                    continuation.resume(returning: [:])
                } else {
                    continuation.resume(throwing: error)
                }
                return
            }
            guard let collection else {
                continuation.resume(returning: [:])
                return
            }
            let formatter = dayFormatter()
            let unit = metric.unit
            var sums: [String: Double] = [:]
            // Eine einfache Schleife statt enumerateStatistics: kein Block, der sums von außen verändert.
            for statistics in collection.statistics() {
                if let sum = statistics.sumQuantity() {
                    sums[formatter.string(from: statistics.startDate)] = sum.doubleValue(for: unit)
                }
            }
            continuation.resume(returning: sums)
        }
        store.execute(query)
    }
}

// CAPPluginCall ist nicht Sendable. Die Hülle reicht den Aufruf in den Task und antwortet nur auf dem Main Actor
// (wie in RestActivityPlugin.swift).
private struct Reply: @unchecked Sendable {
    let call: CAPPluginCall

    @MainActor func resolve(_ data: [String: Any]) {
        call.resolve(data)
    }

    @MainActor func reject(_ message: String) {
        call.reject(message)
    }
}
