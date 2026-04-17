use crate::bridge::{EvaluatedMeshSource, PipelineRendererUploadBridge, RendererUploadBridge};
use crate::types::{
    CameraState, FrameStats, RendererError, SelectionResult, ViewportConfig, ViewportHandle,
};
use crossbeam_channel::{unbounded, Receiver, Sender};
use k_os_eval::mesh_pipeline::ViewportBufferPayload;
use k_os_scene::MeshHandle;
use parking_lot::Mutex;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Instant;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MeshSyncFailureMode {
    SoftContinue,
    HardFail,
}

fn report_mesh_sync_error(
    mode: MeshSyncFailureMode,
    viewport: ViewportHandle,
    mesh: MeshHandle,
    error: &RendererError,
) {
    let mode_label = match mode {
        MeshSyncFailureMode::SoftContinue => "soft-continue",
        MeshSyncFailureMode::HardFail => "hard-fail",
    };
    eprintln!(
        "k-os-renderer mesh sync error ({mode_label}) viewport={} mesh={}: {error}",
        viewport.raw(),
        mesh.raw()
    );
}

#[derive(Clone)]
pub struct RendererService {
    sender: Sender<RendererCommand>,
    stats: Arc<Mutex<HashMap<ViewportHandle, FrameStats>>>,
}

#[derive(Debug)]
pub enum RendererCommand {
    CreateViewport {
        config: ViewportConfig,
        reply: std::sync::mpsc::Sender<Result<ViewportHandle, RendererError>>,
    },
    DisposeViewport {
        viewport: ViewportHandle,
        reply: std::sync::mpsc::Sender<Result<(), RendererError>>,
    },
    AttachMesh {
        viewport: ViewportHandle,
        mesh: MeshHandle,
        reply: std::sync::mpsc::Sender<Result<crate::types::RenderMeshHandle, RendererError>>,
    },
    DetachMesh {
        viewport: ViewportHandle,
        render_mesh: crate::types::RenderMeshHandle,
        reply: std::sync::mpsc::Sender<Result<(), RendererError>>,
    },
    SetCamera {
        viewport: ViewportHandle,
        camera: CameraState,
        reply: std::sync::mpsc::Sender<Result<(), RendererError>>,
    },
    RequestRedraw {
        viewport: ViewportHandle,
        reply: std::sync::mpsc::Sender<Result<(), RendererError>>,
    },
    RequestSelection {
        viewport: ViewportHandle,
        ndc: [f32; 2],
        reply: std::sync::mpsc::Sender<Result<SelectionResult, RendererError>>,
    },
    SyncViewportPayload {
        viewport: ViewportHandle,
        payload: ViewportBufferPayload,
        reply: std::sync::mpsc::Sender<Result<crate::types::RenderMeshHandle, RendererError>>,
    },
    SyncMeshFromSource {
        viewport: ViewportHandle,
        mesh: MeshHandle,
        reply: std::sync::mpsc::Sender<Result<crate::types::RenderMeshHandle, RendererError>>,
    },
    MarkMeshDirty {
        mesh: MeshHandle,
        reply: std::sync::mpsc::Sender<Result<usize, RendererError>>,
    },
}

pub fn spawn_headless_service() -> RendererService {
    spawn_headless_service_with_source(None)
}

pub fn spawn_headless_service_with_source(
    mesh_source: Option<Arc<dyn EvaluatedMeshSource>>,
) -> RendererService {
    spawn_headless_service_with_source_and_bridge(mesh_source, None)
}

pub fn spawn_headless_service_with_source_and_bridge(
    mesh_source: Option<Arc<dyn EvaluatedMeshSource>>,
    upload_bridge: Option<Arc<dyn RendererUploadBridge>>,
) -> RendererService {
    let (sender, receiver) = unbounded();
    let stats = Arc::new(Mutex::new(HashMap::new()));
    let stats_thread = Arc::clone(&stats);
    std::thread::Builder::new()
        .name("k-os-renderer-service".to_string())
        .spawn(move || service_loop(receiver, stats_thread, mesh_source, upload_bridge))
        .expect("failed to spawn renderer service thread");

    RendererService { sender, stats }
}

impl RendererService {
    pub fn create_viewport(&self, config: ViewportConfig) -> Result<ViewportHandle, RendererError> {
        let (reply_tx, reply_rx) = std::sync::mpsc::channel();
        self.sender
            .send(RendererCommand::CreateViewport {
                config,
                reply: reply_tx,
            })
            .map_err(|_| RendererError::ServiceUnavailable)?;
        reply_rx
            .recv()
            .map_err(|_| RendererError::ServiceUnavailable)?
    }

    pub fn dispose_viewport(&self, viewport: ViewportHandle) -> Result<(), RendererError> {
        let (reply_tx, reply_rx) = std::sync::mpsc::channel();
        self.sender
            .send(RendererCommand::DisposeViewport {
                viewport,
                reply: reply_tx,
            })
            .map_err(|_| RendererError::ServiceUnavailable)?;
        reply_rx
            .recv()
            .map_err(|_| RendererError::ServiceUnavailable)?
    }

    pub fn attach_mesh(
        &self,
        viewport: ViewportHandle,
        mesh: MeshHandle,
    ) -> Result<crate::types::RenderMeshHandle, RendererError> {
        let (reply_tx, reply_rx) = std::sync::mpsc::channel();
        self.sender
            .send(RendererCommand::AttachMesh {
                viewport,
                mesh,
                reply: reply_tx,
            })
            .map_err(|_| RendererError::ServiceUnavailable)?;
        reply_rx
            .recv()
            .map_err(|_| RendererError::ServiceUnavailable)?
    }

    pub fn detach_mesh(
        &self,
        viewport: ViewportHandle,
        render_mesh: crate::types::RenderMeshHandle,
    ) -> Result<(), RendererError> {
        let (reply_tx, reply_rx) = std::sync::mpsc::channel();
        self.sender
            .send(RendererCommand::DetachMesh {
                viewport,
                render_mesh,
                reply: reply_tx,
            })
            .map_err(|_| RendererError::ServiceUnavailable)?;
        reply_rx
            .recv()
            .map_err(|_| RendererError::ServiceUnavailable)?
    }

    pub fn set_camera(
        &self,
        viewport: ViewportHandle,
        camera: CameraState,
    ) -> Result<(), RendererError> {
        let (reply_tx, reply_rx) = std::sync::mpsc::channel();
        self.sender
            .send(RendererCommand::SetCamera {
                viewport,
                camera,
                reply: reply_tx,
            })
            .map_err(|_| RendererError::ServiceUnavailable)?;
        reply_rx
            .recv()
            .map_err(|_| RendererError::ServiceUnavailable)?
    }

    pub fn request_redraw(&self, viewport: ViewportHandle) -> Result<(), RendererError> {
        let (reply_tx, reply_rx) = std::sync::mpsc::channel();
        self.sender
            .send(RendererCommand::RequestRedraw {
                viewport,
                reply: reply_tx,
            })
            .map_err(|_| RendererError::ServiceUnavailable)?;
        reply_rx
            .recv()
            .map_err(|_| RendererError::ServiceUnavailable)?
    }

    pub fn request_selection(
        &self,
        viewport: ViewportHandle,
        ndc: [f32; 2],
    ) -> Result<SelectionResult, RendererError> {
        let (reply_tx, reply_rx) = std::sync::mpsc::channel();
        self.sender
            .send(RendererCommand::RequestSelection {
                viewport,
                ndc,
                reply: reply_tx,
            })
            .map_err(|_| RendererError::ServiceUnavailable)?;
        reply_rx
            .recv()
            .map_err(|_| RendererError::ServiceUnavailable)?
    }

    pub fn get_stats(&self, viewport: ViewportHandle) -> Result<FrameStats, RendererError> {
        self.stats
            .lock()
            .get(&viewport)
            .cloned()
            .ok_or(RendererError::ViewportNotFound(viewport.raw()))
    }

    pub fn sync_viewport_payload(
        &self,
        viewport: ViewportHandle,
        payload: ViewportBufferPayload,
    ) -> Result<crate::types::RenderMeshHandle, RendererError> {
        let (reply_tx, reply_rx) = std::sync::mpsc::channel();
        self.sender
            .send(RendererCommand::SyncViewportPayload {
                viewport,
                payload,
                reply: reply_tx,
            })
            .map_err(|_| RendererError::ServiceUnavailable)?;
        reply_rx
            .recv()
            .map_err(|_| RendererError::ServiceUnavailable)?
    }

    pub fn sync_mesh_from_source(
        &self,
        viewport: ViewportHandle,
        mesh: MeshHandle,
    ) -> Result<crate::types::RenderMeshHandle, RendererError> {
        let (reply_tx, reply_rx) = std::sync::mpsc::channel();
        self.sender
            .send(RendererCommand::SyncMeshFromSource {
                viewport,
                mesh,
                reply: reply_tx,
            })
            .map_err(|_| RendererError::ServiceUnavailable)?;
        reply_rx
            .recv()
            .map_err(|_| RendererError::ServiceUnavailable)?
    }

    pub fn mark_mesh_dirty(&self, mesh: MeshHandle) -> Result<usize, RendererError> {
        let (reply_tx, reply_rx) = std::sync::mpsc::channel();
        self.sender
            .send(RendererCommand::MarkMeshDirty {
                mesh,
                reply: reply_tx,
            })
            .map_err(|_| RendererError::ServiceUnavailable)?;
        reply_rx
            .recv()
            .map_err(|_| RendererError::ServiceUnavailable)?
    }
}

fn service_loop(
    receiver: Receiver<RendererCommand>,
    stats: Arc<Mutex<HashMap<ViewportHandle, FrameStats>>>,
    mesh_source: Option<Arc<dyn EvaluatedMeshSource>>,
    upload_bridge: Option<Arc<dyn RendererUploadBridge>>,
) {
    let mut renderer = crate::Renderer::with_optional_gpu();
    let upload_bridge = upload_bridge.or_else(|| {
        let source = mesh_source.as_ref()?.clone();
        let (device, queue) = renderer.gpu_device_queue()?;
        Some(
            Arc::new(PipelineRendererUploadBridge::new(device, queue, source))
                as Arc<dyn RendererUploadBridge>,
        )
    });
    let mut dirty_meshes: HashSet<MeshHandle> = HashSet::new();
    while let Ok(command) = receiver.recv() {
        match command {
            RendererCommand::CreateViewport { config, reply } => {
                let result = renderer.create_viewport(config);
                if let Ok(handle) = result {
                    stats.lock().insert(handle, FrameStats::default());
                    let _ = reply.send(Ok(handle));
                } else {
                    let _ = reply.send(result);
                }
            }
            RendererCommand::DisposeViewport { viewport, reply } => {
                stats.lock().remove(&viewport);
                let _ = reply.send(renderer.dispose_viewport(viewport));
            }
            RendererCommand::AttachMesh {
                viewport,
                mesh,
                reply,
            } => {
                let _ = reply.send(renderer.attach_mesh(viewport, mesh));
            }
            RendererCommand::DetachMesh {
                viewport,
                render_mesh,
                reply,
            } => {
                let _ = reply.send(renderer.detach_mesh(viewport, render_mesh));
            }
            RendererCommand::SetCamera {
                viewport,
                camera,
                reply,
            } => {
                let _ = reply.send(renderer.set_camera(viewport, camera));
            }
            RendererCommand::RequestRedraw { viewport, reply } => {
                let mut mesh_sync_time_ms = 0.0_f32;
                let mut result = renderer.request_redraw(viewport);
                if result.is_ok() {
                    if let Some(bridge) = upload_bridge.as_ref() {
                        match renderer.attached_meshes(viewport) {
                            Ok(attached_meshes) => {
                                for mesh in attached_meshes {
                                    if !dirty_meshes.contains(&mesh) {
                                        continue;
                                    }
                                    let sync_started = Instant::now();
                                    let sync_result =
                                        bridge.sync_mesh(&mut renderer, viewport, mesh);
                                    mesh_sync_time_ms +=
                                        sync_started.elapsed().as_secs_f32() * 1000.0;
                                    match sync_result {
                                        Ok(_) => {
                                            dirty_meshes.remove(&mesh);
                                        }
                                        Err(err) => {
                                            report_mesh_sync_error(
                                                MeshSyncFailureMode::SoftContinue,
                                                viewport,
                                                mesh,
                                                &RendererError::from(err),
                                            );
                                        }
                                    }
                                }
                            }
                            Err(err) => result = Err(err),
                        }
                    } else if let Some(source) = mesh_source.as_ref() {
                        match renderer.attached_meshes(viewport) {
                            Ok(attached_meshes) => {
                                for mesh in attached_meshes {
                                    if !dirty_meshes.contains(&mesh) {
                                        continue;
                                    }
                                    let sync_started = Instant::now();
                                    let sync_result = renderer.sync_mesh_from_source(
                                        viewport,
                                        mesh,
                                        source.as_ref(),
                                    );
                                    mesh_sync_time_ms +=
                                        sync_started.elapsed().as_secs_f32() * 1000.0;
                                    match sync_result {
                                        Ok(_) => {
                                            dirty_meshes.remove(&mesh);
                                        }
                                        Err(err) => {
                                            report_mesh_sync_error(
                                                MeshSyncFailureMode::SoftContinue,
                                                viewport,
                                                mesh,
                                                &RendererError::from(err),
                                            );
                                        }
                                    }
                                }
                            }
                            Err(err) => result = Err(err),
                        }
                    }
                }
                if result.is_ok() {
                    let viewports_to_execute = renderer.redraw_requested_viewports();
                    let mut guard = stats.lock();
                    for redraw_viewport in viewports_to_execute {
                        let entry = guard.entry(redraw_viewport).or_default();
                        match renderer.execute_viewport(redraw_viewport) {
                            Ok(report) => {
                                if let Ok(next) = renderer.current_frame_stats(redraw_viewport) {
                                    *entry = next;
                                }
                                if let Some(report) = report {
                                    entry.frame_time_ms = report.duration.as_secs_f32() * 1000.0;
                                    if entry.frame_time_ms > 0.0 {
                                        entry.fps = 1000.0 / entry.frame_time_ms;
                                    }
                                    entry.gpu_upload_bytes = entry
                                        .gpu_upload_bytes
                                        .saturating_add(report.allocated_bytes);
                                }
                                if redraw_viewport == viewport {
                                    entry.mesh_sync_time_ms = mesh_sync_time_ms;
                                }
                            }
                            Err(err) => {
                                if redraw_viewport == viewport {
                                    result = Err(err);
                                } else {
                                    eprintln!(
                                        "k-os-renderer redraw propagation error viewport={}: {err}",
                                        redraw_viewport.raw()
                                    );
                                }
                            }
                        }
                    }
                }
                let _ = reply.send(result);
            }
            RendererCommand::RequestSelection {
                viewport,
                ndc,
                reply,
            } => {
                let started = Instant::now();
                let selection_result = renderer.request_selection(viewport, ndc);
                let latency_ms = started.elapsed().as_secs_f32() * 1000.0;
                if let Some(entry) = stats.lock().get_mut(&viewport) {
                    if entry.selection_latency_ms <= 0.0 {
                        entry.selection_latency_ms = latency_ms;
                    } else {
                        // Exponential smoothing avoids noisy per-pick spikes.
                        entry.selection_latency_ms =
                            (entry.selection_latency_ms * 0.8) + (latency_ms * 0.2);
                    }
                }
                let _ = reply.send(selection_result);
            }
            RendererCommand::SyncViewportPayload {
                viewport,
                payload,
                reply,
            } => {
                let result = renderer.sync_viewport_payload(viewport, payload);
                if result.is_ok() {
                    if let Ok(next) = renderer.current_frame_stats(viewport) {
                        stats.lock().insert(viewport, next);
                    }
                }
                let _ = reply.send(result);
            }
            RendererCommand::SyncMeshFromSource {
                viewport,
                mesh,
                reply,
            } => {
                let sync_started = Instant::now();
                let result = if let Some(bridge) = upload_bridge.as_ref() {
                    let outcome = bridge.sync_mesh(&mut renderer, viewport, mesh);
                    if outcome.is_ok() {
                        dirty_meshes.remove(&mesh);
                    }
                    let mapped = outcome.map_err(RendererError::from);
                    if let Err(err) = &mapped {
                        report_mesh_sync_error(MeshSyncFailureMode::HardFail, viewport, mesh, err);
                    }
                    mapped
                } else if let Some(source) = mesh_source.as_ref() {
                    let outcome = renderer.sync_mesh_from_source(viewport, mesh, source.as_ref());
                    if outcome.is_ok() {
                        dirty_meshes.remove(&mesh);
                    }
                    let mapped = outcome.map_err(RendererError::from);
                    if let Err(err) = &mapped {
                        report_mesh_sync_error(MeshSyncFailureMode::HardFail, viewport, mesh, err);
                    }
                    mapped
                } else {
                    Err(RendererError::MeshSyncFailed(
                        "evaluated mesh source is not configured".to_string(),
                    ))
                };
                let sync_time_ms = sync_started.elapsed().as_secs_f32() * 1000.0;

                if result.is_ok() {
                    if let Ok(next) = renderer.current_frame_stats(viewport) {
                        let mut guard = stats.lock();
                        let entry = guard.entry(viewport).or_default();
                        let selection_latency_ms = entry.selection_latency_ms;
                        let cumulative_upload_bytes =
                            entry.gpu_upload_bytes.saturating_add(next.gpu_upload_bytes);
                        *entry = next;
                        entry.selection_latency_ms = selection_latency_ms;
                        entry.mesh_sync_time_ms = sync_time_ms;
                        entry.gpu_upload_bytes = cumulative_upload_bytes;
                    }
                }
                let _ = reply.send(result);
            }
            RendererCommand::MarkMeshDirty { mesh, reply } => {
                let touched = if let Some(bridge) = upload_bridge.as_ref() {
                    bridge.mark_mesh_dirty(&mut renderer, mesh)
                } else {
                    renderer.mark_mesh_dirty(mesh)
                };
                dirty_meshes.insert(mesh);
                let _ = reply.send(Ok(touched));
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bridge::BridgeError;
    use crate::types::{RendererMode, ShadingMode};
    use k_os_eval::mesh_pipeline::ViewportBufferPayload;
    use k_os_scene::MeshHandle;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;

    struct FlakyMeshSource {
        payload: ViewportBufferPayload,
        fail: AtomicBool,
    }

    impl FlakyMeshSource {
        fn new(payload: ViewportBufferPayload) -> Self {
            Self {
                payload,
                fail: AtomicBool::new(false),
            }
        }

        fn set_fail(&self, fail: bool) {
            self.fail.store(fail, Ordering::Relaxed);
        }
    }

    impl EvaluatedMeshSource for FlakyMeshSource {
        fn viewport_payload(&self, mesh: MeshHandle) -> Result<ViewportBufferPayload, BridgeError> {
            if self.fail.load(Ordering::Relaxed) {
                return Err(BridgeError::PayloadUnavailable {
                    mesh: mesh.raw(),
                    reason: "simulated evaluation failure".to_string(),
                });
            }
            Ok(self.payload.clone())
        }
    }

    fn config() -> ViewportConfig {
        ViewportConfig {
            width: 1280,
            height: 720,
            shading_mode: ShadingMode::Solid,
            background_color: [0.1, 0.1, 0.1, 1.0],
            enable_selection: true,
            enable_shadows: false,
            msaa_samples: 1,
            renderer_mode: RendererMode::Native,
        }
    }

    #[test]
    fn creates_and_disposes_viewports() {
        let service = spawn_headless_service();
        let viewport = service.create_viewport(config()).unwrap();
        assert!(service.get_stats(viewport).is_ok());
        service.dispose_viewport(viewport).unwrap();
        assert!(service.get_stats(viewport).is_err());
    }

    #[test]
    fn validates_camera_updates() {
        let service = spawn_headless_service();
        let viewport = service.create_viewport(config()).unwrap();
        let invalid = CameraState {
            position: [0.0, 0.0, 5.0],
            target: [0.0, 0.0, 0.0],
            up: [0.0, 0.0, 0.0],
            fov_degrees: 60.0,
            near: 0.1,
            far: 100.0,
        };
        assert!(service.set_camera(viewport, invalid).is_err());
    }

    #[test]
    fn syncs_payload_and_supports_selection() {
        let service = spawn_headless_service();
        let viewport = service.create_viewport(config()).unwrap();
        service
            .set_camera(
                viewport,
                CameraState {
                    position: [0.0, 0.0, 2.0],
                    target: [0.0, 0.0, 0.0],
                    up: [0.0, 1.0, 0.0],
                    fov_degrees: 60.0,
                    near: 0.1,
                    far: 100.0,
                },
            )
            .unwrap();

        let payload = ViewportBufferPayload {
            mesh_handle: MeshHandle(11),
            positions: vec![-0.5, -0.5, 0.0, 0.5, -0.5, 0.0, 0.0, 0.5, 0.0],
            normals: vec![0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0],
            indices: vec![0, 1, 2],
            shading_mode: k_os_scene::ShadingMode::Solid,
            vertex_count: 3,
            index_count: 3,
        };

        service.sync_viewport_payload(viewport, payload).unwrap();
        let selection = service.request_selection(viewport, [0.0, 0.0]).unwrap();
        assert!(selection.hit);
        assert_eq!(selection.mesh_handle, Some(11));
    }

    #[test]
    fn redraw_soft_continues_when_source_sync_fails() {
        let mesh = MeshHandle(77);
        let payload = ViewportBufferPayload {
            mesh_handle: mesh,
            positions: vec![-0.5, -0.5, 0.0, 0.5, -0.5, 0.0, 0.0, 0.5, 0.0],
            normals: vec![0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0],
            indices: vec![0, 1, 2],
            shading_mode: k_os_scene::ShadingMode::Solid,
            vertex_count: 3,
            index_count: 3,
        };
        let source = Arc::new(FlakyMeshSource::new(payload));
        let service = spawn_headless_service_with_source(Some(source.clone()));
        let viewport = service.create_viewport(config()).unwrap();
        service
            .set_camera(
                viewport,
                CameraState {
                    position: [0.0, 0.0, 2.0],
                    target: [0.0, 0.0, 0.0],
                    up: [0.0, 1.0, 0.0],
                    fov_degrees: 60.0,
                    near: 0.1,
                    far: 100.0,
                },
            )
            .unwrap();

        service.sync_mesh_from_source(viewport, mesh).unwrap();
        let initial = service.request_selection(viewport, [0.0, 0.0]).unwrap();
        assert!(initial.hit);

        source.set_fail(true);
        service.mark_mesh_dirty(mesh).unwrap();
        assert!(service.request_redraw(viewport).is_ok());

        let retained = service.request_selection(viewport, [0.0, 0.0]).unwrap();
        assert!(retained.hit);
        assert_eq!(retained.mesh_handle, Some(mesh.raw()));
    }

    #[test]
    fn dirty_mesh_redraw_propagates_to_other_viewports() {
        let mesh = MeshHandle(88);
        let payload = ViewportBufferPayload {
            mesh_handle: mesh,
            positions: vec![-0.5, -0.5, 0.0, 0.5, -0.5, 0.0, 0.0, 0.5, 0.0],
            normals: vec![0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0],
            indices: vec![0, 1, 2],
            shading_mode: k_os_scene::ShadingMode::Solid,
            vertex_count: 3,
            index_count: 3,
        };
        let source = Arc::new(FlakyMeshSource::new(payload));
        let service = spawn_headless_service_with_source(Some(source));
        let viewport_a = service.create_viewport(config()).unwrap();
        let viewport_b = service.create_viewport(config()).unwrap();
        service
            .set_camera(
                viewport_a,
                CameraState {
                    position: [0.0, 0.0, 2.0],
                    target: [0.0, 0.0, 0.0],
                    up: [0.0, 1.0, 0.0],
                    fov_degrees: 60.0,
                    near: 0.1,
                    far: 100.0,
                },
            )
            .unwrap();
        service
            .set_camera(
                viewport_b,
                CameraState {
                    position: [0.0, 0.0, 2.0],
                    target: [0.0, 0.0, 0.0],
                    up: [0.0, 1.0, 0.0],
                    fov_degrees: 60.0,
                    near: 0.1,
                    far: 100.0,
                },
            )
            .unwrap();

        service.attach_mesh(viewport_b, mesh).unwrap();
        service.sync_mesh_from_source(viewport_a, mesh).unwrap();
        assert_eq!(service.mark_mesh_dirty(mesh).unwrap(), 2);
        service.request_redraw(viewport_a).unwrap();

        let stats_b = service.get_stats(viewport_b).unwrap();
        assert_eq!(stats_b.vertex_count, 3);
        assert_eq!(stats_b.face_count, 1);
    }
}
