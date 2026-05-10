use serde::{Deserialize, Serialize};
use std::cmp::Ordering as CmpOrdering;
use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::sync::oneshot;
use uuid::Uuid;

pub const NATIVE_TASK_CANCELLED_ERROR: &str = "Native task cancelled.";

pub type NativeTaskId = String;
pub type NativeTaskGeneration = u64;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct NativeTaskWorkKey(String);

impl NativeTaskWorkKey {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum NativeTaskLane {
    DirectoryScan,
    RecursiveSearch,
    Checksum,
    ThumbnailDecode,
    PreviewRead,
    Archive,
    Indexing,
    Maintenance,
}

impl NativeTaskLane {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::DirectoryScan => "directoryScan",
            Self::RecursiveSearch => "recursiveSearch",
            Self::Checksum => "checksum",
            Self::ThumbnailDecode => "thumbnailDecode",
            Self::PreviewRead => "previewRead",
            Self::Archive => "archive",
            Self::Indexing => "indexing",
            Self::Maintenance => "maintenance",
        }
    }

    pub fn all() -> &'static [Self] {
        &[
            Self::DirectoryScan,
            Self::RecursiveSearch,
            Self::Checksum,
            Self::ThumbnailDecode,
            Self::PreviewRead,
            Self::Archive,
            Self::Indexing,
            Self::Maintenance,
        ]
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum NativeTaskPriority {
    Interactive,
    Visible,
    UserInitiated,
    Prefetch,
    Background,
    Maintenance,
}

impl NativeTaskPriority {
    fn rank(self) -> u8 {
        match self {
            Self::Interactive => 0,
            Self::Visible => 1,
            Self::UserInitiated => 2,
            Self::Prefetch => 3,
            Self::Background => 4,
            Self::Maintenance => 5,
        }
    }
}

#[derive(Clone)]
pub struct NativeTaskCancellationToken {
    inner: Arc<AtomicBool>,
}

impl NativeTaskCancellationToken {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn cancel(&self) {
        self.inner.store(true, Ordering::SeqCst);
    }

    pub fn is_cancelled(&self) -> bool {
        self.inner.load(Ordering::SeqCst)
    }

    pub fn throw_if_cancelled(&self) -> Result<(), String> {
        if self.is_cancelled() {
            Err(NATIVE_TASK_CANCELLED_ERROR.to_string())
        } else {
            Ok(())
        }
    }
}

impl Default for NativeTaskCancellationToken {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum NativeTaskQueueOverflowPolicy {
    CancelStaleQueuedFirst,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeTaskLaneConcurrency {
    pub directory_scan: usize,
    pub recursive_search: usize,
    pub checksum: usize,
    pub thumbnail_decode: usize,
    pub preview_read: usize,
    pub archive: usize,
    pub indexing: usize,
    pub maintenance: usize,
}

impl NativeTaskLaneConcurrency {
    pub fn cap_for(self, lane: NativeTaskLane) -> usize {
        match lane {
            NativeTaskLane::DirectoryScan => self.directory_scan,
            NativeTaskLane::RecursiveSearch => self.recursive_search,
            NativeTaskLane::Checksum => self.checksum,
            NativeTaskLane::ThumbnailDecode => self.thumbnail_decode,
            NativeTaskLane::PreviewRead => self.preview_read,
            NativeTaskLane::Archive => self.archive,
            NativeTaskLane::Indexing => self.indexing,
            NativeTaskLane::Maintenance => self.maintenance,
        }
    }
}

impl Default for NativeTaskLaneConcurrency {
    fn default() -> Self {
        Self {
            directory_scan: 2,
            recursive_search: 2,
            checksum: 1,
            thumbnail_decode: 4,
            preview_read: 2,
            archive: 1,
            indexing: 0,
            maintenance: 0,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeTaskGraphPolicy {
    pub enabled: bool,
    pub max_queued_tasks: usize,
    pub stale_cancellation_enabled: bool,
    pub telemetry_enabled: bool,
    pub progress_emit_interval_ms: u64,
    pub overflow_policy: NativeTaskQueueOverflowPolicy,
    pub lane_concurrency: NativeTaskLaneConcurrency,
}

impl NativeTaskGraphPolicy {
    pub fn from_explorer_performance_json(manifest_text: &str) -> Self {
        serde_json::from_str::<ExplorerPerformanceManifest>(manifest_text)
            .ok()
            .and_then(|manifest| manifest.native_task_graph)
            .map(Self::from_shipped_policy)
            .unwrap_or_default()
    }

    fn from_shipped_policy(shipped: ShippedNativeTaskGraphPolicy) -> Self {
        let defaults = Self::default();
        let shipped_lanes = shipped.lane_concurrency.unwrap_or_default();
        let default_lanes = defaults.lane_concurrency;

        Self {
            enabled: shipped.enabled.unwrap_or(defaults.enabled),
            max_queued_tasks: clamp_usize(
                shipped.max_queued_tasks,
                defaults.max_queued_tasks,
                1,
                4096,
            ),
            stale_cancellation_enabled: shipped
                .stale_cancellation_enabled
                .unwrap_or(defaults.stale_cancellation_enabled),
            telemetry_enabled: shipped
                .telemetry_enabled
                .unwrap_or(defaults.telemetry_enabled),
            progress_emit_interval_ms: clamp_u64(
                shipped.progress_emit_interval_ms,
                defaults.progress_emit_interval_ms,
                16,
                1000,
            ),
            overflow_policy: shipped.overflow_policy.unwrap_or(defaults.overflow_policy),
            lane_concurrency: NativeTaskLaneConcurrency {
                directory_scan: clamp_usize(
                    shipped_lanes.directory_scan,
                    default_lanes.directory_scan,
                    1,
                    16,
                ),
                recursive_search: clamp_usize(
                    shipped_lanes.recursive_search,
                    default_lanes.recursive_search,
                    1,
                    16,
                ),
                checksum: clamp_usize(shipped_lanes.checksum, default_lanes.checksum, 1, 8),
                thumbnail_decode: clamp_usize(
                    shipped_lanes.thumbnail_decode,
                    default_lanes.thumbnail_decode,
                    1,
                    16,
                ),
                preview_read: clamp_usize(
                    shipped_lanes.preview_read,
                    default_lanes.preview_read,
                    0,
                    16,
                ),
                archive: clamp_usize(shipped_lanes.archive, default_lanes.archive, 0, 8),
                indexing: clamp_usize(shipped_lanes.indexing, default_lanes.indexing, 0, 8),
                maintenance: clamp_usize(
                    shipped_lanes.maintenance,
                    default_lanes.maintenance,
                    0,
                    4,
                ),
            },
        }
    }
}

impl Default for NativeTaskGraphPolicy {
    fn default() -> Self {
        Self {
            enabled: true,
            max_queued_tasks: 256,
            stale_cancellation_enabled: true,
            telemetry_enabled: true,
            progress_emit_interval_ms: 80,
            overflow_policy: NativeTaskQueueOverflowPolicy::CancelStaleQueuedFirst,
            lane_concurrency: NativeTaskLaneConcurrency::default(),
        }
    }
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeTaskLaneTelemetry {
    pub queued: u64,
    pub active: u64,
    pub completed: u64,
    pub failed: u64,
    pub cancelled: u64,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeTaskGraphTelemetry {
    pub queued_tasks: u64,
    pub queue_depth: usize,
    pub max_queue_depth: usize,
    pub active_tasks: usize,
    pub completed_tasks: u64,
    pub failed_tasks: u64,
    pub cancelled_tasks: u64,
    pub rejected_tasks: u64,
    pub stale_cancelled_tasks: u64,
    pub average_wait_ms: f64,
    pub average_run_ms: f64,
    pub lane_counts: HashMap<String, NativeTaskLaneTelemetry>,
}

#[derive(Debug, Clone)]
pub struct NativeTaskRequest {
    pub task_id: Option<NativeTaskId>,
    pub lane: NativeTaskLane,
    pub priority: NativeTaskPriority,
    pub work_key: Option<NativeTaskWorkKey>,
    pub generation: Option<NativeTaskGeneration>,
    pub cancel_stale: bool,
    pub parent_task_id: Option<NativeTaskId>,
    pub label: String,
    pub user_visible: bool,
}

impl NativeTaskRequest {
    pub fn new(
        lane: NativeTaskLane,
        priority: NativeTaskPriority,
        label: impl Into<String>,
    ) -> Self {
        Self {
            task_id: None,
            lane,
            priority,
            work_key: None,
            generation: None,
            cancel_stale: false,
            parent_task_id: None,
            label: label.into(),
            user_visible: false,
        }
    }

    pub fn with_task_id(mut self, task_id: impl Into<NativeTaskId>) -> Self {
        self.task_id = Some(task_id.into());
        self
    }

    pub fn with_work_key(mut self, work_key: NativeTaskWorkKey) -> Self {
        self.work_key = Some(work_key);
        self
    }

    pub fn with_generation(mut self, generation: NativeTaskGeneration) -> Self {
        self.generation = Some(generation);
        self
    }

    pub fn cancel_stale(mut self, cancel_stale: bool) -> Self {
        self.cancel_stale = cancel_stale;
        self
    }

    pub fn with_parent_task_id(mut self, parent_task_id: impl Into<NativeTaskId>) -> Self {
        self.parent_task_id = Some(parent_task_id.into());
        self
    }

    pub fn user_visible(mut self, user_visible: bool) -> Self {
        self.user_visible = user_visible;
        self
    }
}

pub struct NativeTaskSubmission<T> {
    task_id: NativeTaskId,
    receiver: oneshot::Receiver<Result<T, String>>,
}

impl<T> NativeTaskSubmission<T> {
    pub fn task_id(&self) -> &str {
        &self.task_id
    }

    pub async fn wait(self) -> Result<T, String> {
        self.receiver.await.unwrap_or_else(|_| {
            Err("Native task graph worker ended before sending a result.".into())
        })
    }
}

#[derive(Clone)]
pub struct NativeTaskGraphManager {
    inner: Arc<NativeTaskGraphInner>,
}

impl NativeTaskGraphManager {
    pub fn new(policy: NativeTaskGraphPolicy) -> Self {
        Self {
            inner: Arc::new(NativeTaskGraphInner {
                policy,
                state: Mutex::new(NativeTaskGraphState::new()),
            }),
        }
    }

    #[cfg(not(test))]
    pub fn from_app(app: &tauri::AppHandle) -> Self {
        let manifest_text = crate::usr::read_usr_text_file(
            app,
            "profiles/default/explorer-performance/greeblefs-core/explorer-performance.json",
        )
        .ok();
        let policy = manifest_text
            .as_deref()
            .map(NativeTaskGraphPolicy::from_explorer_performance_json)
            .unwrap_or_default();
        Self::new(policy)
    }

    pub fn policy(&self) -> NativeTaskGraphPolicy {
        self.inner.policy.clone()
    }

    pub fn telemetry_snapshot(&self) -> NativeTaskGraphTelemetry {
        let state = self.inner.state.lock().unwrap();
        state.telemetry.snapshot(&state.active_by_lane)
    }

    pub fn cancel(&self, task_id: &str) -> bool {
        let mut queued_to_cancel = Vec::new();
        let mut cancelled = false;

        {
            let mut state = self.inner.state.lock().unwrap();
            let related_ids: Vec<NativeTaskId> = state
                .records
                .iter()
                .filter_map(|(candidate_id, record)| {
                    if candidate_id == task_id
                        || record.parent_task_id.as_deref() == Some(task_id)
                        || record
                            .ancestor_task_ids
                            .iter()
                            .any(|ancestor| ancestor == task_id)
                    {
                        Some(candidate_id.clone())
                    } else {
                        None
                    }
                })
                .collect();

            for related_id in related_ids {
                if let Some(record) = state.records.get(&related_id) {
                    record.token.cancel();
                    cancelled = true;
                }
            }

            let mut retained = Vec::with_capacity(state.queue.len());
            let mut cancelled_queued_records = Vec::new();
            for task in state.queue.drain(..) {
                if task.token.is_cancelled() {
                    cancelled_queued_records.push((task.id.clone(), task.lane));
                    queued_to_cancel.push(task);
                } else {
                    retained.push(task);
                }
            }
            state.queue = retained;
            for (task_id, lane) in cancelled_queued_records {
                state.finish_queued_cancelled_by_id(&task_id, lane);
            }
            state.refresh_queue_depth();
        }

        for task in queued_to_cancel {
            task.complete_queued_cancelled(NATIVE_TASK_CANCELLED_ERROR.to_string());
        }

        self.dispatch_ready();
        cancelled
    }

    pub fn cancel_work_key(&self, work_key: &NativeTaskWorkKey) -> usize {
        let mut queued_to_cancel = Vec::new();
        let mut cancelled_count = 0usize;

        {
            let mut state = self.inner.state.lock().unwrap();
            let related_ids: Vec<NativeTaskId> = state
                .records
                .iter()
                .filter_map(|(task_id, record)| {
                    if record.work_key.as_ref() == Some(work_key) {
                        Some(task_id.clone())
                    } else {
                        None
                    }
                })
                .collect();

            for task_id in related_ids {
                if let Some(record) = state.records.get(&task_id) {
                    record.token.cancel();
                    cancelled_count += 1;
                }
            }

            let mut retained = Vec::with_capacity(state.queue.len());
            let mut cancelled_queued_records = Vec::new();
            for task in state.queue.drain(..) {
                if task.token.is_cancelled() {
                    cancelled_queued_records.push((task.id.clone(), task.lane));
                    queued_to_cancel.push(task);
                } else {
                    retained.push(task);
                }
            }
            state.queue = retained;
            for (task_id, lane) in cancelled_queued_records {
                state.finish_queued_cancelled_by_id(&task_id, lane);
            }
            state.refresh_queue_depth();
        }

        for task in queued_to_cancel {
            task.complete_queued_cancelled(NATIVE_TASK_CANCELLED_ERROR.to_string());
        }

        self.dispatch_ready();
        cancelled_count
    }

    pub fn submit_blocking<T, F>(
        &self,
        request: NativeTaskRequest,
        work: F,
    ) -> Result<NativeTaskSubmission<T>, String>
    where
        T: Send + 'static,
        F: FnOnce(NativeTaskCancellationToken) -> Result<T, String> + Send + 'static,
    {
        let (sender, receiver) = oneshot::channel::<Result<T, String>>();
        let sender_slot = Arc::new(Mutex::new(Some(sender)));
        let cancel_sender_slot = Arc::clone(&sender_slot);
        let execute_sender_slot = Arc::clone(&sender_slot);

        let execute = Box::new(move |token: NativeTaskCancellationToken| {
            Box::pin(async move {
                if token.is_cancelled() {
                    send_task_result(
                        &execute_sender_slot,
                        Err(NATIVE_TASK_CANCELLED_ERROR.to_string()),
                    );
                    return NativeTaskRunStatus::Cancelled;
                }

                let token_for_work = token.clone();
                let joined = tokio::task::spawn_blocking(move || work(token_for_work)).await;
                let mut result = joined.unwrap_or_else(|join_error| {
                    Err(format!("Native blocking task failed to join: {join_error}"))
                });

                if token.is_cancelled() && result.is_ok() {
                    result = Err(NATIVE_TASK_CANCELLED_ERROR.to_string());
                }

                let status = NativeTaskRunStatus::from_result(&result);
                send_task_result(&execute_sender_slot, result);
                status
            }) as NativeTaskFuture
        }) as NativeTaskExecutor;

        let cancel_queued = Box::new(move |reason: String| {
            send_task_result(&cancel_sender_slot, Err(reason));
        }) as NativeTaskQueuedCancel;

        self.enqueue(request, execute, cancel_queued, receiver)
    }

    pub fn submit_async<T, F, Fut>(
        &self,
        request: NativeTaskRequest,
        work: F,
    ) -> Result<NativeTaskSubmission<T>, String>
    where
        T: Send + 'static,
        F: FnOnce(NativeTaskCancellationToken) -> Fut + Send + 'static,
        Fut: Future<Output = Result<T, String>> + Send + 'static,
    {
        let (sender, receiver) = oneshot::channel::<Result<T, String>>();
        let sender_slot = Arc::new(Mutex::new(Some(sender)));
        let cancel_sender_slot = Arc::clone(&sender_slot);
        let execute_sender_slot = Arc::clone(&sender_slot);

        let execute = Box::new(move |token: NativeTaskCancellationToken| {
            Box::pin(async move {
                if token.is_cancelled() {
                    send_task_result(
                        &execute_sender_slot,
                        Err(NATIVE_TASK_CANCELLED_ERROR.to_string()),
                    );
                    return NativeTaskRunStatus::Cancelled;
                }

                let mut result = work(token.clone()).await;
                if token.is_cancelled() && result.is_ok() {
                    result = Err(NATIVE_TASK_CANCELLED_ERROR.to_string());
                }

                let status = NativeTaskRunStatus::from_result(&result);
                send_task_result(&execute_sender_slot, result);
                status
            }) as NativeTaskFuture
        }) as NativeTaskExecutor;

        let cancel_queued = Box::new(move |reason: String| {
            send_task_result(&cancel_sender_slot, Err(reason));
        }) as NativeTaskQueuedCancel;

        self.enqueue(request, execute, cancel_queued, receiver)
    }

    fn enqueue<T>(
        &self,
        request: NativeTaskRequest,
        execute: NativeTaskExecutor,
        cancel_queued: NativeTaskQueuedCancel,
        receiver: oneshot::Receiver<Result<T, String>>,
    ) -> Result<NativeTaskSubmission<T>, String>
    where
        T: Send + 'static,
    {
        let task_id = request
            .task_id
            .clone()
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        let token = NativeTaskCancellationToken::new();
        let queued_task = NativeQueuedTask {
            id: task_id.clone(),
            lane: request.lane,
            priority: request.priority,
            sequence: 0,
            work_key: request.work_key.clone(),
            generation: request.generation,
            parent_task_id: request.parent_task_id.clone(),
            label: request.label.clone(),
            user_visible: request.user_visible,
            token: token.clone(),
            queued_at: Instant::now(),
            execute,
            cancel_queued,
        };
        let mut stale_queued_tasks = Vec::new();
        let mut overflow_queued_tasks = Vec::new();

        {
            let mut state = self.inner.state.lock().unwrap();

            if self.inner.policy.stale_cancellation_enabled && request.cancel_stale {
                stale_queued_tasks.extend(state.cancel_stale_tasks_for_request(&request));
            }

            overflow_queued_tasks.extend(state.remove_cancelled_queued_tasks());

            if self.inner.policy.enabled && state.queue.len() >= self.inner.policy.max_queued_tasks
            {
                state.telemetry.rejected_tasks += 1;
                return Err(format!(
                    "Native task graph queue is full ({} queued, max {}). Try again after current Explorer work settles.",
                    state.queue.len(),
                    self.inner.policy.max_queued_tasks
                ));
            }

            let sequence = state.next_sequence;
            state.next_sequence += 1;
            let mut queued_task = queued_task;
            queued_task.sequence = sequence;
            let ancestor_task_ids = state.ancestors_for(&queued_task.parent_task_id);

            state.records.insert(
                task_id.clone(),
                NativeTaskRecord {
                    lane: queued_task.lane,
                    priority: queued_task.priority,
                    work_key: queued_task.work_key.clone(),
                    generation: queued_task.generation,
                    parent_task_id: queued_task.parent_task_id.clone(),
                    ancestor_task_ids,
                    label: queued_task.label.clone(),
                    user_visible: queued_task.user_visible,
                    token,
                    status: NativeTaskStatus::Queued,
                    queued_at: queued_task.queued_at,
                    started_at: None,
                    finished_at: None,
                },
            );
            state.telemetry.queued_tasks += 1;
            state.lane_mut(queued_task.lane).queued += 1;

            if self.inner.policy.enabled {
                state.queue.push(queued_task);
                state.refresh_queue_depth();
            } else {
                state.mark_task_running(&queued_task.id);
                let inner = Arc::clone(&self.inner);
                spawn_native_task(inner, queued_task);
            }
        }

        for task in stale_queued_tasks.into_iter().chain(overflow_queued_tasks) {
            task.complete_queued_cancelled(NATIVE_TASK_CANCELLED_ERROR.to_string());
        }

        self.dispatch_ready();

        Ok(NativeTaskSubmission { task_id, receiver })
    }

    fn dispatch_ready(&self) {
        loop {
            let next_task = {
                let mut state = self.inner.state.lock().unwrap();
                let Some(next_index) = state.select_next_ready_index(&self.inner.policy) else {
                    state.refresh_queue_depth();
                    return;
                };
                let task = state.queue.remove(next_index);
                state.mark_task_running(&task.id);
                state.refresh_queue_depth();
                task
            };

            let inner = Arc::clone(&self.inner);
            spawn_native_task(inner, next_task);
        }
    }
}

impl Default for NativeTaskGraphManager {
    fn default() -> Self {
        Self::new(NativeTaskGraphPolicy::default())
    }
}

struct NativeTaskGraphInner {
    policy: NativeTaskGraphPolicy,
    state: Mutex<NativeTaskGraphState>,
}

struct NativeTaskGraphState {
    queue: Vec<NativeQueuedTask>,
    records: HashMap<NativeTaskId, NativeTaskRecord>,
    active_by_lane: HashMap<NativeTaskLane, usize>,
    next_sequence: u64,
    telemetry: NativeTaskGraphTelemetryAccumulator,
}

impl NativeTaskGraphState {
    fn new() -> Self {
        let mut active_by_lane = HashMap::new();
        for lane in NativeTaskLane::all() {
            active_by_lane.insert(*lane, 0);
        }
        Self {
            queue: Vec::new(),
            records: HashMap::new(),
            active_by_lane,
            next_sequence: 0,
            telemetry: NativeTaskGraphTelemetryAccumulator::default(),
        }
    }

    fn ancestors_for(&self, parent_task_id: &Option<NativeTaskId>) -> Vec<NativeTaskId> {
        let Some(parent_task_id) = parent_task_id else {
            return Vec::new();
        };

        let mut ancestors = vec![parent_task_id.clone()];
        if let Some(parent) = self.records.get(parent_task_id) {
            ancestors.extend(parent.ancestor_task_ids.iter().cloned());
        }
        ancestors
    }

    fn cancel_stale_tasks_for_request(
        &mut self,
        request: &NativeTaskRequest,
    ) -> Vec<NativeQueuedTask> {
        let Some(work_key) = request.work_key.as_ref() else {
            return Vec::new();
        };
        let Some(new_generation) = request.generation else {
            return Vec::new();
        };

        let stale_task_ids = self
            .records
            .iter()
            .filter_map(|(task_id, record)| {
                if record.work_key.as_ref() == Some(work_key)
                    && record.generation.unwrap_or(0) < new_generation
                    && matches!(
                        record.status,
                        NativeTaskStatus::Queued | NativeTaskStatus::Running
                    )
                {
                    Some(task_id.clone())
                } else {
                    None
                }
            })
            .collect::<Vec<_>>();

        for task_id in stale_task_ids {
            if let Some(record) = self.records.get(&task_id) {
                record.token.cancel();
                self.telemetry.stale_cancelled_tasks += 1;
            }
        }

        self.remove_cancelled_queued_tasks()
    }

    fn remove_cancelled_queued_tasks(&mut self) -> Vec<NativeQueuedTask> {
        let mut cancelled = Vec::new();
        let mut retained = Vec::with_capacity(self.queue.len());

        let mut cancelled_queued_records = Vec::new();
        for task in self.queue.drain(..) {
            if task.token.is_cancelled() {
                cancelled_queued_records.push((task.id.clone(), task.lane));
                cancelled.push(task);
            } else {
                retained.push(task);
            }
        }

        self.queue = retained;
        for (task_id, lane) in cancelled_queued_records {
            self.finish_queued_cancelled_by_id(&task_id, lane);
        }
        self.refresh_queue_depth();
        cancelled
    }

    fn finish_queued_cancelled_by_id(&mut self, task_id: &str, lane: NativeTaskLane) {
        let mut marked = false;
        if let Some(record) = self.records.get_mut(task_id) {
            if matches!(record.status, NativeTaskStatus::Queued) {
                record.status = NativeTaskStatus::Cancelled;
                record.finished_at = Some(Instant::now());
                marked = true;
            }
        }

        if marked {
            self.telemetry.cancelled_tasks += 1;
            self.lane_mut(lane).cancelled += 1;
        }
    }

    fn mark_task_running(&mut self, task_id: &str) {
        let Some(record) = self.records.get_mut(task_id) else {
            return;
        };
        if !matches!(record.status, NativeTaskStatus::Queued) {
            return;
        }
        record.status = NativeTaskStatus::Running;
        record.started_at = Some(Instant::now());
        *self.active_by_lane.entry(record.lane).or_insert(0) += 1;
    }

    fn finish_running_task(
        &mut self,
        task_id: &str,
        lane: NativeTaskLane,
        status: NativeTaskRunStatus,
        wait: Duration,
        run: Duration,
    ) {
        if let Some(active) = self.active_by_lane.get_mut(&lane) {
            *active = active.saturating_sub(1);
        }

        if let Some(record) = self.records.get_mut(task_id) {
            record.status = match status {
                NativeTaskRunStatus::Succeeded => NativeTaskStatus::Completed,
                NativeTaskRunStatus::Failed => NativeTaskStatus::Failed,
                NativeTaskRunStatus::Cancelled => NativeTaskStatus::Cancelled,
            };
            record.finished_at = Some(Instant::now());
        }

        self.telemetry.record_finished(lane, status, wait, run);
    }

    fn select_next_ready_index(&self, policy: &NativeTaskGraphPolicy) -> Option<usize> {
        self.queue
            .iter()
            .enumerate()
            .filter(|(_, task)| {
                policy.lane_concurrency.cap_for(task.lane) > 0
                    && self
                        .active_by_lane
                        .get(&task.lane)
                        .copied()
                        .unwrap_or_default()
                        < policy.lane_concurrency.cap_for(task.lane)
            })
            .min_by(|(_, left), (_, right)| {
                match left.priority.rank().cmp(&right.priority.rank()) {
                    CmpOrdering::Equal => left.sequence.cmp(&right.sequence),
                    ordering => ordering,
                }
            })
            .map(|(index, _)| index)
    }

    fn refresh_queue_depth(&mut self) {
        self.telemetry.queue_depth = self.queue.len();
        self.telemetry.max_queue_depth = self.telemetry.max_queue_depth.max(self.queue.len());
    }

    fn lane_mut(&mut self, lane: NativeTaskLane) -> &mut NativeTaskLaneTelemetryAccumulator {
        self.telemetry
            .lane_counts
            .entry(lane)
            .or_insert_with(NativeTaskLaneTelemetryAccumulator::default)
    }
}

struct NativeQueuedTask {
    id: NativeTaskId,
    lane: NativeTaskLane,
    priority: NativeTaskPriority,
    sequence: u64,
    work_key: Option<NativeTaskWorkKey>,
    generation: Option<NativeTaskGeneration>,
    parent_task_id: Option<NativeTaskId>,
    label: String,
    user_visible: bool,
    token: NativeTaskCancellationToken,
    queued_at: Instant,
    execute: NativeTaskExecutor,
    cancel_queued: NativeTaskQueuedCancel,
}

impl NativeQueuedTask {
    fn complete_queued_cancelled(self, reason: String) {
        (self.cancel_queued)(reason);
    }
}

#[allow(dead_code)]
struct NativeTaskRecord {
    lane: NativeTaskLane,
    priority: NativeTaskPriority,
    work_key: Option<NativeTaskWorkKey>,
    generation: Option<NativeTaskGeneration>,
    parent_task_id: Option<NativeTaskId>,
    ancestor_task_ids: Vec<NativeTaskId>,
    label: String,
    user_visible: bool,
    token: NativeTaskCancellationToken,
    status: NativeTaskStatus,
    queued_at: Instant,
    started_at: Option<Instant>,
    finished_at: Option<Instant>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum NativeTaskStatus {
    Queued,
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum NativeTaskRunStatus {
    Succeeded,
    Failed,
    Cancelled,
}

impl NativeTaskRunStatus {
    fn from_result<T>(result: &Result<T, String>) -> Self {
        match result {
            Ok(_) => Self::Succeeded,
            Err(error) if is_native_task_cancelled_error(error) => Self::Cancelled,
            Err(_) => Self::Failed,
        }
    }
}

type NativeTaskFuture = Pin<Box<dyn Future<Output = NativeTaskRunStatus> + Send>>;
type NativeTaskExecutor = Box<dyn FnOnce(NativeTaskCancellationToken) -> NativeTaskFuture + Send>;
type NativeTaskQueuedCancel = Box<dyn FnOnce(String) + Send>;

#[derive(Default)]
struct NativeTaskGraphTelemetryAccumulator {
    queued_tasks: u64,
    queue_depth: usize,
    max_queue_depth: usize,
    completed_tasks: u64,
    failed_tasks: u64,
    cancelled_tasks: u64,
    rejected_tasks: u64,
    stale_cancelled_tasks: u64,
    total_wait_ms: u128,
    total_run_ms: u128,
    wait_samples: u64,
    run_samples: u64,
    lane_counts: HashMap<NativeTaskLane, NativeTaskLaneTelemetryAccumulator>,
}

impl NativeTaskGraphTelemetryAccumulator {
    fn record_finished(
        &mut self,
        lane: NativeTaskLane,
        status: NativeTaskRunStatus,
        wait: Duration,
        run: Duration,
    ) {
        self.total_wait_ms += wait.as_millis();
        self.total_run_ms += run.as_millis();
        self.wait_samples += 1;
        self.run_samples += 1;

        let lane_counts = self
            .lane_counts
            .entry(lane)
            .or_insert_with(NativeTaskLaneTelemetryAccumulator::default);

        match status {
            NativeTaskRunStatus::Succeeded => {
                self.completed_tasks += 1;
                lane_counts.completed += 1;
            }
            NativeTaskRunStatus::Failed => {
                self.failed_tasks += 1;
                lane_counts.failed += 1;
            }
            NativeTaskRunStatus::Cancelled => {
                self.cancelled_tasks += 1;
                lane_counts.cancelled += 1;
            }
        }
    }

    fn snapshot(
        &self,
        active_by_lane: &HashMap<NativeTaskLane, usize>,
    ) -> NativeTaskGraphTelemetry {
        let mut lane_counts = HashMap::new();

        for lane in NativeTaskLane::all() {
            let mut lane_snapshot = self
                .lane_counts
                .get(lane)
                .map(|counts| NativeTaskLaneTelemetry {
                    queued: counts.queued,
                    active: 0,
                    completed: counts.completed,
                    failed: counts.failed,
                    cancelled: counts.cancelled,
                })
                .unwrap_or_default();
            lane_snapshot.active = active_by_lane.get(lane).copied().unwrap_or_default() as u64;
            lane_counts.insert(lane.as_str().to_string(), lane_snapshot);
        }

        NativeTaskGraphTelemetry {
            queued_tasks: self.queued_tasks,
            queue_depth: self.queue_depth,
            max_queue_depth: self.max_queue_depth,
            active_tasks: active_by_lane.values().copied().sum(),
            completed_tasks: self.completed_tasks,
            failed_tasks: self.failed_tasks,
            cancelled_tasks: self.cancelled_tasks,
            rejected_tasks: self.rejected_tasks,
            stale_cancelled_tasks: self.stale_cancelled_tasks,
            average_wait_ms: average_ms(self.total_wait_ms, self.wait_samples),
            average_run_ms: average_ms(self.total_run_ms, self.run_samples),
            lane_counts,
        }
    }
}

#[derive(Default)]
struct NativeTaskLaneTelemetryAccumulator {
    queued: u64,
    completed: u64,
    failed: u64,
    cancelled: u64,
}

fn spawn_native_task(inner: Arc<NativeTaskGraphInner>, task: NativeQueuedTask) {
    tokio::spawn(async move {
        let queued_at = task.queued_at;
        let task_id = task.id.clone();
        let lane = task.lane;
        let run_started = Instant::now();
        let wait = run_started.saturating_duration_since(queued_at);
        let status = (task.execute)(task.token.clone()).await;
        let run = run_started.elapsed();

        {
            let mut state = inner.state.lock().unwrap();
            state.finish_running_task(&task_id, lane, status, wait, run);
        }

        NativeTaskGraphManager { inner }.dispatch_ready();
    });
}

fn send_task_result<T>(
    sender_slot: &Arc<Mutex<Option<oneshot::Sender<Result<T, String>>>>>,
    result: Result<T, String>,
) {
    if let Some(sender) = sender_slot.lock().unwrap().take() {
        let _ = sender.send(result);
    }
}

fn average_ms(total_ms: u128, samples: u64) -> f64 {
    if samples == 0 {
        0.0
    } else {
        total_ms as f64 / samples as f64
    }
}

pub fn is_native_task_cancelled_error(error: &str) -> bool {
    error == NATIVE_TASK_CANCELLED_ERROR || error.to_ascii_lowercase().contains("cancelled")
}

fn clamp_usize(value: Option<usize>, default_value: usize, min: usize, max: usize) -> usize {
    value.unwrap_or(default_value).clamp(min, max)
}

fn clamp_u64(value: Option<u64>, default_value: u64, min: u64, max: u64) -> u64 {
    value.unwrap_or(default_value).clamp(min, max)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExplorerPerformanceManifest {
    native_task_graph: Option<ShippedNativeTaskGraphPolicy>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ShippedNativeTaskGraphPolicy {
    enabled: Option<bool>,
    max_queued_tasks: Option<usize>,
    stale_cancellation_enabled: Option<bool>,
    telemetry_enabled: Option<bool>,
    progress_emit_interval_ms: Option<u64>,
    overflow_policy: Option<NativeTaskQueueOverflowPolicy>,
    lane_concurrency: Option<ShippedNativeTaskLaneConcurrency>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ShippedNativeTaskLaneConcurrency {
    directory_scan: Option<usize>,
    recursive_search: Option<usize>,
    checksum: Option<usize>,
    thumbnail_decode: Option<usize>,
    preview_read: Option<usize>,
    archive: Option<usize>,
    indexing: Option<usize>,
    maintenance: Option<usize>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering as AtomicOrdering};
    use std::sync::{Arc, Condvar, Mutex as StdMutex};
    use std::time::Duration;

    fn policy_with_caps(
        directory_scan: usize,
        recursive_search: usize,
        checksum: usize,
    ) -> NativeTaskGraphPolicy {
        NativeTaskGraphPolicy {
            lane_concurrency: NativeTaskLaneConcurrency {
                directory_scan,
                recursive_search,
                checksum,
                ..NativeTaskLaneConcurrency::default()
            },
            max_queued_tasks: 64,
            ..NativeTaskGraphPolicy::default()
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn priority_ordering_preserves_fifo_ties() {
        let manager = NativeTaskGraphManager::new(policy_with_caps(1, 1, 1));
        let gate = Arc::new((StdMutex::new(false), Condvar::new()));
        let starts = Arc::new(StdMutex::new(Vec::<String>::new()));

        let gate_for_blocker = Arc::clone(&gate);
        let blocker = manager
            .submit_blocking(
                NativeTaskRequest::new(
                    NativeTaskLane::DirectoryScan,
                    NativeTaskPriority::Interactive,
                    "blocker",
                ),
                move |_| {
                    let (lock, condvar) = &*gate_for_blocker;
                    let mut released = lock.lock().unwrap();
                    while !*released {
                        released = condvar.wait(released).unwrap();
                    }
                    Ok(())
                },
            )
            .unwrap();

        let low_starts = Arc::clone(&starts);
        let low = manager
            .submit_blocking(
                NativeTaskRequest::new(
                    NativeTaskLane::DirectoryScan,
                    NativeTaskPriority::Background,
                    "low",
                ),
                move |_| {
                    low_starts.lock().unwrap().push("low".into());
                    Ok(())
                },
            )
            .unwrap();

        let first_high_starts = Arc::clone(&starts);
        let first_high = manager
            .submit_blocking(
                NativeTaskRequest::new(
                    NativeTaskLane::DirectoryScan,
                    NativeTaskPriority::Visible,
                    "first-high",
                ),
                move |_| {
                    first_high_starts.lock().unwrap().push("first-high".into());
                    Ok(())
                },
            )
            .unwrap();

        let second_high_starts = Arc::clone(&starts);
        let second_high = manager
            .submit_blocking(
                NativeTaskRequest::new(
                    NativeTaskLane::DirectoryScan,
                    NativeTaskPriority::Visible,
                    "second-high",
                ),
                move |_| {
                    second_high_starts
                        .lock()
                        .unwrap()
                        .push("second-high".into());
                    Ok(())
                },
            )
            .unwrap();

        {
            let (lock, condvar) = &*gate;
            *lock.lock().unwrap() = true;
            condvar.notify_all();
        }

        blocker.wait().await.unwrap();
        first_high.wait().await.unwrap();
        second_high.wait().await.unwrap();
        low.wait().await.unwrap();

        assert_eq!(
            starts.lock().unwrap().clone(),
            vec!["first-high", "second-high", "low"]
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn lane_concurrency_caps_are_enforced() {
        let manager = NativeTaskGraphManager::new(policy_with_caps(2, 1, 1));
        let active = Arc::new(AtomicUsize::new(0));
        let max_active = Arc::new(AtomicUsize::new(0));
        let mut submissions = Vec::new();

        for _ in 0..8 {
            let active = Arc::clone(&active);
            let max_active = Arc::clone(&max_active);
            submissions.push(
                manager
                    .submit_blocking(
                        NativeTaskRequest::new(
                            NativeTaskLane::DirectoryScan,
                            NativeTaskPriority::UserInitiated,
                            "cap test",
                        ),
                        move |_| {
                            let current = active.fetch_add(1, AtomicOrdering::SeqCst) + 1;
                            max_active.fetch_max(current, AtomicOrdering::SeqCst);
                            std::thread::sleep(Duration::from_millis(30));
                            active.fetch_sub(1, AtomicOrdering::SeqCst);
                            Ok(())
                        },
                    )
                    .unwrap(),
            );
        }

        for submission in submissions {
            submission.wait().await.unwrap();
        }

        assert_eq!(max_active.load(AtomicOrdering::SeqCst), 2);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn bounded_queue_rejects_when_capacity_is_exhausted() {
        let manager = NativeTaskGraphManager::new(NativeTaskGraphPolicy {
            max_queued_tasks: 1,
            lane_concurrency: NativeTaskLaneConcurrency {
                maintenance: 0,
                ..NativeTaskLaneConcurrency::default()
            },
            ..NativeTaskGraphPolicy::default()
        });

        let first = manager.submit_blocking(
            NativeTaskRequest::new(
                NativeTaskLane::Maintenance,
                NativeTaskPriority::Maintenance,
                "parked",
            ),
            |_| Ok(()),
        );
        assert!(first.is_ok());

        let second = manager.submit_blocking(
            NativeTaskRequest::new(
                NativeTaskLane::Maintenance,
                NativeTaskPriority::Maintenance,
                "rejected",
            ),
            |_| Ok(()),
        );
        assert!(second.is_err());
        assert_eq!(manager.telemetry_snapshot().rejected_tasks, 1);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn stale_generation_cancels_older_work_for_same_key() {
        let manager = NativeTaskGraphManager::new(policy_with_caps(1, 1, 1));
        let work_key = NativeTaskWorkKey::new("search:C:/demo");
        let started = Arc::new(AtomicBool::new(false));
        let first_started = Arc::clone(&started);

        let first = manager
            .submit_blocking(
                NativeTaskRequest::new(
                    NativeTaskLane::RecursiveSearch,
                    NativeTaskPriority::Visible,
                    "old search",
                )
                .with_work_key(work_key.clone())
                .with_generation(1)
                .cancel_stale(true),
                move |token| {
                    first_started.store(true, Ordering::SeqCst);
                    while !token.is_cancelled() {
                        std::thread::sleep(Duration::from_millis(5));
                    }
                    token.throw_if_cancelled()
                },
            )
            .unwrap();

        while !started.load(Ordering::SeqCst) {
            tokio::time::sleep(Duration::from_millis(5)).await;
        }

        let second = manager
            .submit_blocking(
                NativeTaskRequest::new(
                    NativeTaskLane::RecursiveSearch,
                    NativeTaskPriority::Visible,
                    "new search",
                )
                .with_work_key(work_key)
                .with_generation(2)
                .cancel_stale(true),
                |_| Ok("new"),
            )
            .unwrap();

        assert!(first.wait().await.is_err());
        assert_eq!(second.wait().await.unwrap(), "new");
        assert_eq!(manager.telemetry_snapshot().stale_cancelled_tasks, 1);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn queued_cancellation_completes_waiter_as_cancelled() {
        let manager = NativeTaskGraphManager::new(NativeTaskGraphPolicy {
            lane_concurrency: NativeTaskLaneConcurrency {
                maintenance: 0,
                ..NativeTaskLaneConcurrency::default()
            },
            ..NativeTaskGraphPolicy::default()
        });
        let submission = manager
            .submit_blocking(
                NativeTaskRequest::new(
                    NativeTaskLane::Maintenance,
                    NativeTaskPriority::Maintenance,
                    "queued cancel",
                ),
                |_| Ok(()),
            )
            .unwrap();
        let task_id = submission.task_id().to_string();

        assert!(manager.cancel(&task_id));
        let result = submission.wait().await;
        assert!(result.is_err());
        assert_eq!(manager.telemetry_snapshot().cancelled_tasks, 1);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn running_cooperative_cancellation_reaches_worker() {
        let manager = NativeTaskGraphManager::new(policy_with_caps(1, 1, 1));
        let started = Arc::new(AtomicBool::new(false));
        let started_for_worker = Arc::clone(&started);
        let submission = manager
            .submit_blocking(
                NativeTaskRequest::new(
                    NativeTaskLane::Checksum,
                    NativeTaskPriority::UserInitiated,
                    "running cancel",
                ),
                move |token| {
                    started_for_worker.store(true, Ordering::SeqCst);
                    while !token.is_cancelled() {
                        std::thread::sleep(Duration::from_millis(5));
                    }
                    token.throw_if_cancelled()
                },
            )
            .unwrap();
        let task_id = submission.task_id().to_string();

        while !started.load(Ordering::SeqCst) {
            tokio::time::sleep(Duration::from_millis(5)).await;
        }

        assert!(manager.cancel(&task_id));
        assert!(submission.wait().await.is_err());
        assert_eq!(manager.telemetry_snapshot().cancelled_tasks, 1);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn parent_cancellation_propagates_to_child_metadata() {
        let manager = NativeTaskGraphManager::new(NativeTaskGraphPolicy {
            lane_concurrency: NativeTaskLaneConcurrency {
                maintenance: 0,
                ..NativeTaskLaneConcurrency::default()
            },
            ..NativeTaskGraphPolicy::default()
        });

        let parent = manager
            .submit_blocking(
                NativeTaskRequest::new(
                    NativeTaskLane::Maintenance,
                    NativeTaskPriority::Maintenance,
                    "parent",
                )
                .with_task_id("parent-task"),
                |_| Ok(()),
            )
            .unwrap();
        let child = manager
            .submit_blocking(
                NativeTaskRequest::new(
                    NativeTaskLane::Maintenance,
                    NativeTaskPriority::Maintenance,
                    "child",
                )
                .with_task_id("child-task")
                .with_parent_task_id("parent-task"),
                |_| Ok(()),
            )
            .unwrap();

        assert!(manager.cancel("parent-task"));
        assert!(parent.wait().await.is_err());
        assert!(child.wait().await.is_err());
        assert_eq!(manager.telemetry_snapshot().cancelled_tasks, 2);
    }

    #[test]
    fn policy_normalizes_defaults_malformed_and_clamps() {
        let defaults = NativeTaskGraphPolicy::from_explorer_performance_json("{}");
        assert_eq!(defaults, NativeTaskGraphPolicy::default());

        let malformed = NativeTaskGraphPolicy::from_explorer_performance_json("{ nope");
        assert_eq!(malformed, NativeTaskGraphPolicy::default());

        let clamped = NativeTaskGraphPolicy::from_explorer_performance_json(
            r#"{
                "nativeTaskGraph": {
                    "enabled": false,
                    "maxQueuedTasks": 999999,
                    "progressEmitIntervalMs": 1,
                    "laneConcurrency": {
                        "directoryScan": 999,
                        "recursiveSearch": 0,
                        "checksum": 100,
                        "thumbnailDecode": 3,
                        "previewRead": 4,
                        "archive": 2
                    }
                }
            }"#,
        );

        assert!(!clamped.enabled);
        assert_eq!(clamped.max_queued_tasks, 4096);
        assert_eq!(clamped.progress_emit_interval_ms, 16);
        assert_eq!(clamped.lane_concurrency.directory_scan, 16);
        assert_eq!(clamped.lane_concurrency.recursive_search, 1);
        assert_eq!(clamped.lane_concurrency.checksum, 8);
        assert_eq!(clamped.lane_concurrency.thumbnail_decode, 3);
        assert_eq!(clamped.lane_concurrency.preview_read, 4);
        assert_eq!(clamped.lane_concurrency.archive, 2);

        let zero_thumbnail_lane = NativeTaskGraphPolicy::from_explorer_performance_json(
            r#"{
                "nativeTaskGraph": {
                    "laneConcurrency": {
                        "thumbnailDecode": 0
                    }
                }
            }"#,
        );
        assert_eq!(zero_thumbnail_lane.lane_concurrency.thumbnail_decode, 1);
    }
}
