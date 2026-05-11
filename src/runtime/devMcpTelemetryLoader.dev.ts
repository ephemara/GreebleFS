type TelemetryBackendModule = {
  getTelemetryStatus: () => Promise<unknown>;
  getRecentTelemetryRecords: (limit?: number) => Promise<unknown[]>;
};

const importUnanalyzedModule = new Function("modulePath", "return import(modulePath)") as <Module>(
  modulePath: string,
) => Promise<Module>;

async function loadTelemetryBackendModule(): Promise<TelemetryBackendModule> {
  return importUnanalyzedModule<TelemetryBackendModule>('/src/runtime/telemetryBackend.ts');
}

export async function getTelemetryStatusThroughLoader(): Promise<unknown> {
  const telemetryBackend = await loadTelemetryBackendModule();
  return telemetryBackend.getTelemetryStatus();
}

export async function getRecentTelemetryRecordsThroughLoader(limit?: number): Promise<unknown[]> {
  const telemetryBackend = await loadTelemetryBackendModule();
  return telemetryBackend.getRecentTelemetryRecords(limit);
}
