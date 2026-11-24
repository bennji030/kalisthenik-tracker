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
        let reply = Reply(call: call)
        Task {
            await endAllRests()
            let state = RestActivityAttributes.ContentState(startedAt: Date(), endsAt: endsAt, exercise: exercise, set: set)
            do {
                _ = try Activity<RestActivityAttributes>.request(
                    attributes: RestActivityAttributes(),
                    content: ActivityContent(state: state, staleDate: endsAt),
                    pushType: nil
                )
                await reply.resolve()
            } catch {
                await reply.reject(error.localizedDescription)
            }
        }
    }

    @objc func updateRest(_ call: CAPPluginCall) {
        guard let endsAt = endDate(call) else { return }
        let reply = Reply(call: call)
        Task {
            for activity in Activity<RestActivityAttributes>.activities {
                var state = activity.content.state
                state.endsAt = endsAt
                await activity.update(ActivityContent(state: state, staleDate: endsAt))
            }
            await reply.resolve()
        }
    }

    @objc func endRest(_ call: CAPPluginCall) {
        let reply = Reply(call: call)
        Task {
            await endAllRests()
            await reply.resolve()
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
}

private func endAllRests() async {
    for activity in Activity<RestActivityAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
    }
}

// CAPPluginCall ist nicht Sendable. Die Hülle reicht den Aufruf in den Task und antwortet nur auf dem Main Actor,
// so bleibt der Code auch im Swift-6-Modus ohne Fehler.
private struct Reply: @unchecked Sendable {
    let call: CAPPluginCall

    @MainActor func resolve() {
        call.resolve()
    }

    @MainActor func reject(_ message: String) {
        call.reject(message)
    }
}
