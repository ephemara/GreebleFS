from __future__ import annotations

import base64
import io
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT_DIR = Path(__file__).resolve().parents[1]
PYTHON_SRC_DIR = ROOT_DIR / "src-python"
if str(PYTHON_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_SRC_DIR))

from greeblefs_sidecar.actions import PythonActionContext
from greeblefs_sidecar import cutout_runtime


def build_test_image_data_url() -> str:
    if cutout_runtime.Image is None:
        raise RuntimeError("Pillow is required for cutout runtime tests.")
    image = cutout_runtime.Image.new("RGBA", (48, 48), (255, 255, 255, 255))
    pixels = image.load()
    for y in range(12, 36):
        for x in range(14, 34):
            pixels[x, y] = (16, 16, 16, 255)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def decode_png_data_url(data_url: str):
    if cutout_runtime.Image is None:
        raise RuntimeError("Pillow is required for cutout runtime tests.")
    _, _, payload = data_url.partition(",")
    return cutout_runtime.Image.open(io.BytesIO(base64.b64decode(payload))).convert("RGBA")


def decode_mask_data_url(data_url: str):
    if cutout_runtime.Image is None:
        raise RuntimeError("Pillow is required for cutout runtime tests.")
    _, _, payload = data_url.partition(",")
    return cutout_runtime.Image.open(io.BytesIO(base64.b64decode(payload))).convert("L")


def resolve_output_artifact_path(payload: dict[str, object], *, token: str) -> Path:
    output_artifacts = payload.get("outputArtifacts")
    if not isinstance(output_artifacts, list):
        raise AssertionError("Expected outputArtifacts in the cutout runtime payload.")

    for artifact in output_artifacts:
        if not isinstance(artifact, dict):
            continue
        if artifact.get("token") != token:
            continue
        file_path = artifact.get("filePath")
        if not isinstance(file_path, str) or not file_path.strip():
            raise AssertionError(f"Output artifact {token!r} did not include a filePath.")
        return Path(file_path)

    raise AssertionError(f"Output artifact token {token!r} was not present in the payload.")


def decode_mask_artifact(payload: dict[str, object]) -> object:
    token = payload["result"]["previewMaskArtifactToken"]
    artifact_path = resolve_output_artifact_path(payload, token=token)
    return cutout_runtime.Image.open(artifact_path).convert("L")


@unittest.skipIf(cutout_runtime.Image is None, "Pillow is unavailable in this environment.")
class CutoutRuntimeWorkflowModeTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        runtime_root = Path(self.temp_dir.name)
        self.context = PythonActionContext(
            action_id="image.cutout_open_session",
            runtime_root=runtime_root,
            workspace_root=PYTHON_SRC_DIR,
            cwd=ROOT_DIR,
            environment={},
        )
        self.image_data_url = build_test_image_data_url()
        cutout_runtime._CUTOUT_SESSION_CACHE.clear()

        self.resolve_model_descriptor_patcher = patch(
            "greeblefs_sidecar.cutout_runtime.resolve_model_descriptor",
            return_value={
                "modelId": "test-image-cutout-model",
                "providerModelId": "test-provider-model",
                "label": "Test Cutout Model",
                "family": "image-cutout",
                "hardwareProfileId": None,
                "capabilityIds": ["image-cutout"],
            },
        )
        self.resolve_model_descriptor_patcher.start()

    def tearDown(self) -> None:
        self.resolve_model_descriptor_patcher.stop()
        cutout_runtime._CUTOUT_SESSION_CACHE.clear()
        self.temp_dir.cleanup()

    def test_cutout_open_and_reset_stay_empty_until_prompted(self) -> None:
        payload = cutout_runtime.image_cutout_open_session_action(
            {
                "sessionId": "cutout-session",
                "inputDataUrl": self.image_data_url,
                "workflowMode": cutout_runtime.WORKFLOW_MODE_CUTOUT,
                "previewMaxDimension": 128,
            },
            self.context,
        )

        session = cutout_runtime._CUTOUT_SESSION_CACHE["cutout-session"]
        self.assertEqual(session.workflow_mode, cutout_runtime.WORKFLOW_MODE_CUTOUT)
        self.assertEqual(session.base_mask.getextrema(), (0, 0))
        self.assertEqual(session.current_mask.getextrema(), (0, 0))
        self.assertIn(
            "No automatic background removal",
            payload["result"]["diagnostics"]["message"],
        )
        self.assertEqual(payload["result"]["promptCount"], 0)
        open_mask = decode_mask_artifact(payload)
        self.assertEqual(open_mask.getextrema(), (0, 0))

        reset_payload = cutout_runtime.image_cutout_reset_session_action(
            {"sessionId": "cutout-session"},
            self.context,
        )

        reset_session = cutout_runtime._CUTOUT_SESSION_CACHE["cutout-session"]
        self.assertEqual(reset_session.base_mask.getextrema(), (0, 0))
        self.assertEqual(reset_session.current_mask.getextrema(), (0, 0))
        reset_mask = decode_mask_artifact(reset_payload)
        self.assertEqual(reset_mask.getextrema(), (0, 0))

    def test_remove_background_open_and_reset_restore_the_auto_mask(self) -> None:
        payload = cutout_runtime.image_cutout_open_session_action(
            {
                "sessionId": "remove-background-session",
                "inputDataUrl": self.image_data_url,
                "workflowMode": cutout_runtime.WORKFLOW_MODE_REMOVE_BACKGROUND,
                "previewMaxDimension": 128,
            },
            self.context,
        )

        session = cutout_runtime._CUTOUT_SESSION_CACHE["remove-background-session"]
        self.assertEqual(
            session.workflow_mode,
            cutout_runtime.WORKFLOW_MODE_REMOVE_BACKGROUND,
        )
        self.assertGreater(session.base_mask.getextrema()[1], 0)
        self.assertGreater(session.current_mask.getextrema()[1], 0)
        self.assertIn(
            "Auto background removal",
            payload["result"]["diagnostics"]["message"],
        )
        self.assertEqual(payload["result"]["promptCount"], 0)
        open_mask = decode_mask_artifact(payload)
        self.assertGreater(open_mask.getextrema()[1], 0)

        cutout_runtime.image_cutout_apply_prompts_action(
            {
                "sessionId": "remove-background-session",
                "prompts": [{"xNorm": 0.5, "yNorm": 0.5, "kind": "negative"}],
            },
            self.context,
        )
        reset_payload = cutout_runtime.image_cutout_reset_session_action(
            {"sessionId": "remove-background-session"},
            self.context,
        )

        reset_session = cutout_runtime._CUTOUT_SESSION_CACHE["remove-background-session"]
        self.assertEqual(reset_session.prompts, [])
        self.assertGreater(reset_session.base_mask.getextrema()[1], 0)
        self.assertGreater(reset_session.current_mask.getextrema()[1], 0)
        reset_mask = decode_mask_artifact(reset_payload)
        self.assertGreater(reset_mask.getextrema()[1], 0)

    def test_stage_export_writes_pngs_for_both_workflow_modes(self) -> None:
        cutout_runtime.image_cutout_open_session_action(
            {
                "sessionId": "cutout-export-session",
                "inputDataUrl": self.image_data_url,
                "workflowMode": cutout_runtime.WORKFLOW_MODE_CUTOUT,
                "previewMaxDimension": 128,
            },
            self.context,
        )
        cutout_runtime.image_cutout_open_session_action(
            {
                "sessionId": "remove-background-export-session",
                "inputDataUrl": self.image_data_url,
                "workflowMode": cutout_runtime.WORKFLOW_MODE_REMOVE_BACKGROUND,
                "previewMaxDimension": 128,
            },
            self.context,
        )

        cutout_output_path = Path(self.temp_dir.name) / "cutout-output.png"
        remove_background_output_path = Path(self.temp_dir.name) / "remove-background-output.png"

        cutout_runtime.image_cutout_stage_export_action(
            {
                "sessionId": "cutout-export-session",
                "outputPath": str(cutout_output_path),
            },
            self.context,
        )
        cutout_runtime.image_cutout_stage_export_action(
            {
                "sessionId": "remove-background-export-session",
                "outputPath": str(remove_background_output_path),
            },
            self.context,
        )

        self.assertTrue(cutout_output_path.is_file())
        self.assertTrue(remove_background_output_path.is_file())

        cutout_alpha = decode_png_data_url(
            "data:image/png;base64,"
            + base64.b64encode(cutout_output_path.read_bytes()).decode("ascii")
        ).getchannel("A")
        remove_background_alpha = decode_png_data_url(
            "data:image/png;base64,"
            + base64.b64encode(remove_background_output_path.read_bytes()).decode("ascii")
        ).getchannel("A")

        self.assertEqual(cutout_alpha.getextrema(), (0, 0))
        self.assertGreater(remove_background_alpha.getextrema()[1], 0)


if __name__ == "__main__":
    unittest.main()
