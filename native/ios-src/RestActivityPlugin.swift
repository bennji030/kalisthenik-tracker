import ActivityKit
import Capacitor
import Foundation

// Nur App-Target. Von src/native.ts als Plugin "RestActivity" aufgerufen.
@objc(RestActivityPlugin)
public class RestActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RestActivityPlugin"
    public let jsName = "RestActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startRest", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateRest", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endRest", returnType: CAPPluginReturnPromise)
    ]

    @objc func startRest(_ call: CAPPluginCall) {
        guard let endsAt = endDate(call) else { return }
        let exercise = call.getString("exercise") ?? ""
        let set = call.getString("set") ?? ""
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.resolve()
            return
        }
        Task {
            await Self.endAll()
            let state = RestActivityAttributes.ContentState(startedAt: Date(), endsAt: endsAt, exercise: exercise, set: set)
            do {
                _ = try Activity<RestActivityAttributes>.request(
                    attributes: RestActivityAttributes(),
                    content: ActivityContent(state: state, staleDate: endsAt),
                    pushType: nil
                )
                call.resolve()
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func updateRest(_ call: CAPPluginCall) {
        guard let endsAt = endDate(call) else { return }
        Task {
            for activity in Activity<RestActivityAttributes>.activities {
                var state = activity.content.state
                state.endsAt = endsAt
                await activity.update(ActivityContent(state: state, staleDate: endsAt))
            }
            call.resolve()
        }
    }

    @objc func endRest(_ call: CAPPluginCall) {
        Task {
            await Self.endAll()
            call.resolve()
        }
    }

    // endsAt kommt als Millisekunden seit 1970; ohne endsAt wird der Aufruf abgelehnt.
    private func endDate(_ call: CAPPluginCall) -> Date? {
        guard let ms = call.getDouble("endsAt") else {
            call.reject("endsAt fehlt")
            return nil
        }
        return Date(timeIntervalSince1970: ms / 1000)
    }

    private static func endAll() async {
        for activity in Activity<RestActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }
}
