import { ExtensionContext } from "@foxglove/studio";

import { initWebcamPanel } from "./WebcamPanel";

export function activate(extensionContext: ExtensionContext): void {
  extensionContext.registerPanel({ name: "Webcam", initPanel: initWebcamPanel });
}
