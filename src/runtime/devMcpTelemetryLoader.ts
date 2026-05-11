export async function getTelemetryStatusThroughLoader(): Promise<unknown> {
  const telemetryBackend = await import('./telemetryBackend');
  return telemetryBackend.getTelemetryStatus();
}

export async function getRecentTelemetryRecordsThroughLoader(limit?: number): Promise<unknown[]> {
  const telemetryBackend = await import('./telemetryBackend');
  return telemetryBackend.getRecentTelemetryRecords(limit);
}
