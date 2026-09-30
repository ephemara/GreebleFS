// Reconstructed Tauron guest binding types: dev-observatory.
export interface DevObservatoryEvent {
  source: string;
  severity?: string;
  message?: string;
  lane?: string;
  systemId?: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
}
export declare function recordDevObservatoryEvent(event: DevObservatoryEvent): Promise<void>;
