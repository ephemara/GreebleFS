import { beforeEach, describe, expect, it, vi } from "vitest";

const accelerationMocks = vi.hoisted(() => {
  const response = {
    serviceUrl: "http://127.0.0.1:12462",
    databasePath: "D:/GreebleFS/usr/profile/path-index.sqlite",
    profileRegistered: true,
    journalEnsured: false,
    taskId: null,
    driveRoot: null,
    state: "profileRegistered",
  };
  return {
    response,
    nativeAvailable: vi.fn(() => false),
    nativeCall: vi.fn(async () => response),
    commands: {
      pathIndexAccelerationStatus: vi.fn(),
      pathIndexAccelerationEnable: vi.fn(async () => ({
        status: "ok",
        data: response,
      })),
      pathIndexAccelerationRebuild: vi.fn(),
      pathIndexAccelerationInstallService: vi.fn(async () => ({
        status: "ok",
        data: {
          serviceName: "GreebleFSUsnIndexer",
          serviceUrl: "http://127.0.0.1:12462",
          daemonPath: "D:/GreebleFS/target/release/greeblefs-usn-daemon.exe",
          launchedElevated: true,
          state: "installLaunched",
        },
      })),
    },
  };
});

vi.mock("../runtime/nativeControl", () => ({
  isGreebleNativeControlAvailable: accelerationMocks.nativeAvailable,
  callGreebleNativeWithInvokeFallback: accelerationMocks.nativeCall,
}));

vi.mock("../config/nativeLaneMigration", () => ({
  resolveGreebleNativeLaneSelection: () => ({
    activeLane: accelerationMocks.nativeAvailable() ? "native_control" : "invoke",
  }),
}));

vi.mock("../runtime/tauriClient", () => ({
  commands: accelerationMocks.commands,
  unwrapTauriResult: (result: { status: "ok"; data: unknown } | { status: "error"; error: string }) => {
    if (result.status === "ok") {
      return result.data;
    }
    throw new Error(result.error);
  },
}));

import {
  enablePathIndexAcceleration,
  installPathIndexAccelerationService,
} from "../runtime/pathIndexAcceleration";

describe("path index acceleration runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accelerationMocks.nativeAvailable.mockReturnValue(false);
  });

  it("normalizes optional enable fields to the generated nullable request shape", async () => {
    await enablePathIndexAcceleration({ autoIndex: false });

    expect(accelerationMocks.commands.pathIndexAccelerationEnable).toHaveBeenCalledWith({
      driveRoot: null,
      autoIndex: false,
      journalMaximumSizeBytes: null,
      journalAllocationDeltaBytes: null,
    });
  });

  it("uses native-control for daemon commands when the lane is available", async () => {
    accelerationMocks.nativeAvailable.mockReturnValue(true);

    await enablePathIndexAcceleration({ driveRoot: "D:\\" });

    expect(accelerationMocks.nativeCall).toHaveBeenCalledWith(
      "explorer",
      "pathIndexAccelerationEnable",
      {
        driveRoot: "D:\\",
        autoIndex: null,
        journalMaximumSizeBytes: null,
        journalAllocationDeltaBytes: null,
      },
      expect.any(Function),
    );
  });

  it("normalizes the service install request for generated invoke", async () => {
    await installPathIndexAccelerationService();

    expect(accelerationMocks.commands.pathIndexAccelerationInstallService).toHaveBeenCalledWith({
      daemonPath: null,
    });
  });
});
