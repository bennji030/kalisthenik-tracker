import Capacitor
import UIKit

// Nur App-Target. Im Main.storyboard als Custom Class des Bridge View Controllers eingetragen.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(RestActivityPlugin())
        bridge?.registerPluginInstance(HealthDaysPlugin())
    }
}
