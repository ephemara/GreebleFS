import { describe, expect, it } from "vitest";
import { summarizeTelemetryValue } from "../runtime/telemetry";

describe("telemetry summarizeTelemetryValue", () => {
  it("summarizes array buffers by byte length", () => {
    expect(summarizeTelemetryValue(new ArrayBuffer(64), "payload")).toBe(
      "payload<array-buffer:64>",
    );
  });

  it("summarizes typed arrays by byte length", () => {
    expect(summarizeTelemetryValue(new Uint8Array(32), "payload")).toBe(
      "payload<typed-array:32>",
    );
  });
});
