from __future__ import annotations

import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT_DIR = Path(__file__).resolve().parents[1]
PYTHON_SRC_DIR = ROOT_DIR / "src-python"
if str(PYTHON_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_SRC_DIR))

from greeblefs_sidecar.actions import PythonActionContext
from greeblefs_sidecar import actions


class AccelerationActionProbeTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        runtime_root = Path(self.temp_dir.name)
        self.context = PythonActionContext(
            action_id="acceleration.cuda_probe",
            runtime_root=runtime_root,
            workspace_root=PYTHON_SRC_DIR,
            cwd=ROOT_DIR,
            environment={},
        )

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_acceleration_cuda_probe_surfaces_mocked_cuda_and_provider_state(self) -> None:
        fake_cuda = types.SimpleNamespace(
            is_available=lambda: True,
            device_count=lambda: 2,
            get_device_capability=lambda index: (8, 6) if index == 0 else (8, 9),
            get_device_properties=lambda index: types.SimpleNamespace(
                total_memory=(8 if index == 0 else 12) * 1024 * 1024 * 1024,
            ),
            get_device_name=lambda index: ["Quadro RTX 3000", "RTX 4090"][index],
        )
        fake_torch = types.SimpleNamespace(
            __version__="2.7.0",
            cuda=fake_cuda,
            version=types.SimpleNamespace(cuda="12.4"),
            backends=types.SimpleNamespace(
                cudnn=types.SimpleNamespace(is_available=lambda: True),
            ),
        )
        fake_onnxruntime = types.SimpleNamespace(
            get_available_providers=lambda: ["CUDAExecutionProvider", "CPUExecutionProvider"],
        )

        def fake_module_installed(module_name: str) -> bool:
            return module_name in {"torch", "onnxruntime", "numpy"}

        def fake_safe_import(module_name: str):
            if module_name == "torch":
                return True, None, fake_torch
            if module_name == "onnxruntime":
                return True, None, fake_onnxruntime
            if module_name == "numpy":
                return True, None, types.SimpleNamespace(__version__="2.1.0")
            return False, f"{module_name} unavailable", None

        with (
            patch("greeblefs_sidecar.actions._module_installed", side_effect=fake_module_installed),
            patch("greeblefs_sidecar.actions._safe_import", side_effect=fake_safe_import),
            patch.dict(
                "os.environ",
                {"CUDA_VISIBLE_DEVICES": "0,1", "CUDA_HOME": "C:/CUDA", "CUDA_PATH": "C:/CUDA"},
                clear=False,
            ),
        ):
            payload = actions.acceleration_cuda_probe_action({}, self.context)

        self.assertEqual(payload["cudaVisibleDevices"], "0,1")
        self.assertEqual(payload["cudaHome"], "C:/CUDA")
        self.assertEqual(payload["torch"]["version"], "2.7.0")
        self.assertTrue(payload["torch"]["cudaAvailable"])
        self.assertEqual(payload["torch"]["deviceCount"], 2)
        self.assertEqual(payload["torch"]["devices"][0]["name"], "Quadro RTX 3000")
        self.assertEqual(payload["onnxruntime"]["availableProviders"], ["CUDAExecutionProvider", "CPUExecutionProvider"])
        numpy_probe = next(
            probe for probe in payload["optionalModules"] if probe["id"] == "numpy"
        )
        self.assertTrue(numpy_probe["installed"])
        self.assertTrue(numpy_probe["imported"])


if __name__ == "__main__":
    unittest.main()
