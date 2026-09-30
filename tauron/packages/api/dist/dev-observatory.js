// Reconstructed Tauron guest binding: dev-observatory.
//
// See transport.js header for why this file exists. Telemetry recording is a
// fire-and-forget no-op until the real guest ships; every caller already
// tolerates rejection (`.catch(() => undefined)` / `void`).

export async function recordDevObservatoryEvent(event) {
  void event;
}
