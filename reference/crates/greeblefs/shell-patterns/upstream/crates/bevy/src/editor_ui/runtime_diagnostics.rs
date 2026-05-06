use super::super::{GamePipelineBootstrapState, GameRuntimeAgentAnchor, GameRuntimeAgentMotion};
use bevy::ecs::system::SystemParam;
use bevy::prelude::*;
use bevy_egui::{egui, EguiContexts, EguiPrimaryContextPass};
use k_os_game_ai::{GameAiDecisionRuntimeState, GameAiRuntimeState};
use k_os_game_camera::{GameCameraDispatchState, GameCameraRuntimeState};
use k_os_game_framework::GameRuntimeActionBindings;
use k_os_game_input::{GameInputIntentState, GameInputRuntimeState};
use k_os_game_play::{
    GameExecutionApplicationState, GameExecutionCommandState, GameExecutionEffectsState,
    GameExecutionTransportBackendState, GameExecutionTransportState, RuntimeReadinessState,
};
use k_os_game_sequencer::{GameSequencerRuntimeState, GameSequencerTrackDispatchState};
use k_os_ui::{
    DockWorkspaceState, KeyValuePanelData, KeyValuePanelRow, KeyValuePanelStore,
    SuitePanelDefinition, SuitePanelKind, SuitePanelRegistry, PANEL_RUNTIME_DIAGNOSTICS,
};

#[derive(Resource)]
struct RuntimeDiagnosticsUiState {
    enabled: bool,
}

impl Default for RuntimeDiagnosticsUiState {
    fn default() -> Self {
        Self { enabled: true }
    }
}

#[derive(Event, Clone, Copy, Debug)]
pub struct SetRuntimeDiagnosticsEnabledEvent(pub bool);
impl Message for SetRuntimeDiagnosticsEnabledEvent {}

pub struct RuntimeDiagnosticsUiPlugin;

impl Plugin for RuntimeDiagnosticsUiPlugin {
    fn build(&self, app: &mut App) {
        app.insert_resource(RuntimeDiagnosticsUiState::default())
            .add_message::<SetRuntimeDiagnosticsEnabledEvent>()
            .add_systems(Startup, register_runtime_diagnostics_panel)
            .add_systems(Update, (apply_runtime_diagnostics_toggle, sync_runtime_diagnostics_panel_data))
            .add_systems(EguiPrimaryContextPass, runtime_diagnostics_ui_system);
    }
}

fn register_runtime_diagnostics_panel(mut registry: ResMut<SuitePanelRegistry>) {
    registry.register(
        SuitePanelDefinition::new(
            PANEL_RUNTIME_DIAGNOSTICS,
            "Game Runtime",
            SuitePanelKind::KeyValueTable,
        )
        .with_data_source(PANEL_RUNTIME_DIAGNOSTICS),
    );
}

fn apply_runtime_diagnostics_toggle(
    mut events: MessageReader<SetRuntimeDiagnosticsEnabledEvent>,
    mut ui_state: ResMut<RuntimeDiagnosticsUiState>,
) {
    for event in events.read() {
        ui_state.enabled = event.0;
    }
}

#[derive(SystemParam)]
struct GameRuntimeDebugCtx<'w, 's> {
    bootstrap_state: Option<Res<'w, GamePipelineBootstrapState>>,
    readiness_state: Option<Res<'w, RuntimeReadinessState>>,
    ai_state: Option<Res<'w, GameAiRuntimeState>>,
    ai_decision_state: Option<Res<'w, GameAiDecisionRuntimeState>>,
    action_bindings: Option<Res<'w, GameRuntimeActionBindings>>,
    camera_dispatch_state: Option<Res<'w, GameCameraDispatchState>>,
    camera_state: Option<Res<'w, GameCameraRuntimeState>>,
    sequencer_state: Option<Res<'w, GameSequencerRuntimeState>>,
    sequencer_dispatch_state: Option<Res<'w, GameSequencerTrackDispatchState>>,
    input_state: Option<Res<'w, GameInputRuntimeState>>,
    intent_state: Option<Res<'w, GameInputIntentState>>,
    command_state: Option<Res<'w, GameExecutionCommandState>>,
    execution_application_state: Option<Res<'w, GameExecutionApplicationState>>,
    execution_effects_state: Option<Res<'w, GameExecutionEffectsState>>,
    execution_transport_state: Option<Res<'w, GameExecutionTransportState>>,
    execution_transport_backend_state: Option<Res<'w, GameExecutionTransportBackendState>>,
    agent_q: Query<
        'w,
        's,
        (
            &'static GameRuntimeAgentAnchor,
            &'static Transform,
            Option<&'static GameRuntimeAgentMotion>,
        ),
    >,
}

fn sync_runtime_diagnostics_panel_data(
    runtime_debug: GameRuntimeDebugCtx,
    mut panels: ResMut<KeyValuePanelStore>,
) {
    panels.set_panel(PANEL_RUNTIME_DIAGNOSTICS, build_runtime_diagnostics_panel_data(&runtime_debug));
}

fn runtime_diagnostics_ui_system(
    mut contexts: EguiContexts,
    ui_state: Res<RuntimeDiagnosticsUiState>,
    workspace: Option<Res<DockWorkspaceState>>,
    runtime_debug: GameRuntimeDebugCtx,
) -> Result {
    if !ui_state.enabled {
        return Ok(());
    }

    if workspace.as_deref().is_some_and(|workspace| workspace.open) {
        return Ok(());
    }

    let ctx = contexts.ctx_mut()?;
    let panel_data = build_runtime_diagnostics_panel_data(&runtime_debug);
    egui::Window::new("Game Runtime")
        .default_open(true)
        .resizable(true)
        .show(ctx, |ui| {
            if let Some(summary) = panel_data.summary.as_ref() {
                ui.label(egui::RichText::new(summary).strong());
                ui.separator();
            }

            egui::ScrollArea::vertical().show(ui, |ui| {
                for row in panel_data.rows.iter() {
                    ui.horizontal_wrapped(|ui| {
                        ui.label(
                            egui::RichText::new(format!("{}:", row.label))
                                .color(egui::Color32::from_rgb(150, 160, 175)),
                        );
                        ui.label(row.value.as_str());
                    });
                }
            });
        });

    Ok(())
}

fn build_runtime_diagnostics_panel_data(runtime_debug: &GameRuntimeDebugCtx) -> KeyValuePanelData {
    let mut rows = Vec::new();

    if let Some(bootstrap_state) = runtime_debug.bootstrap_state.as_deref() {
        rows.push(KeyValuePanelRow::new(
            "Bootstrap",
            format!(
                "enabled={} completed={} stages={}/{} registry_loaded={} registry_errors={}",
                bootstrap_state.enabled,
                bootstrap_state.completed,
                bootstrap_state
                    .stage_total
                    .saturating_sub(bootstrap_state.stage_failed),
                bootstrap_state.stage_total,
                bootstrap_state.registry_loaded,
                bootstrap_state.registry_errors
            ),
        ));
        if let Some(error) = &bootstrap_state.error {
            rows.push(KeyValuePanelRow::new("Bootstrap Error", error.clone()));
        }
    } else {
        rows.push(KeyValuePanelRow::new("Bootstrap", "pending"));
    }

    if let Some(readiness_state) = runtime_debug.readiness_state.as_deref() {
        rows.push(KeyValuePanelRow::new(
            "Readiness",
            format!("{} | {}", readiness_state.status, readiness_state.detail),
        ));
    }
    if let Some(ai_state) = runtime_debug.ai_state.as_deref() {
        rows.push(KeyValuePanelRow::new(
            "AI",
            format!(
                "{} agents={} issues={}",
                ai_state.status,
                ai_state.agent_ids.len(),
                ai_state.issues.len()
            ),
        ));
    }
    if let Some(ai_decision_state) = runtime_debug.ai_decision_state.as_deref() {
        rows.push(KeyValuePanelRow::new(
            "AI Tick",
            format!(
                "phase={} tick={} decisions={}",
                ai_decision_state.active_phase,
                ai_decision_state.tick_index,
                ai_decision_state.agent_decisions.len()
            ),
        ));
    }
    if let Some(action_bindings) = runtime_debug.action_bindings.as_deref() {
        rows.push(KeyValuePanelRow::new(
            "Actions",
            format!(
                "{} projected={} routes={}",
                action_bindings.status,
                action_bindings.agent_actions.len(),
                action_bindings.routes_loaded
            ),
        ));
    }
    if let Some(camera_dispatch_state) = runtime_debug.camera_dispatch_state.as_deref() {
        rows.push(KeyValuePanelRow::new(
            "Camera Dispatch",
            format!(
                "{} rig={} routes={} track={}",
                camera_dispatch_state.status,
                camera_dispatch_state.active_rig.as_deref().unwrap_or("none"),
                camera_dispatch_state.routes_loaded,
                camera_dispatch_state
                    .selected_track_id
                    .as_deref()
                    .unwrap_or("none")
            ),
        ));
    }
    if let Some(camera_state) = runtime_debug.camera_state.as_deref() {
        rows.push(KeyValuePanelRow::new(
            "Camera",
            format!(
                "{} rig={} detail={}",
                camera_state.status,
                camera_state.active_rig.as_deref().unwrap_or("none"),
                camera_state.detail
            ),
        ));
    }
    if let Some(sequencer_state) = runtime_debug.sequencer_state.as_deref() {
        rows.push(KeyValuePanelRow::new(
            "Sequencer",
            format!(
                "{} timeline={} routes={} events={}",
                sequencer_state.status,
                sequencer_state.active_timeline.as_deref().unwrap_or("none"),
                sequencer_state.routes_loaded,
                sequencer_state.pending_events.len()
            ),
        ));
    }
    if let Some(dispatch_state) = runtime_debug.sequencer_dispatch_state.as_deref() {
        rows.push(KeyValuePanelRow::new(
            "Sequencer Dispatch",
            format!(
                "{} tracks={} events={} routes={}",
                dispatch_state.status,
                dispatch_state.tracks_loaded,
                dispatch_state.events_emitted,
                dispatch_state.routes_loaded
            ),
        ));
    }
    if let Some(input_state) = runtime_debug.input_state.as_deref() {
        rows.push(KeyValuePanelRow::new(
            "Input",
            format!(
                "{} mappings={} gated={} camera_mode={}",
                input_state.status,
                input_state.agent_input_actions.len(),
                input_state.agent_gates.len(),
                input_state.active_camera_mode.as_deref().unwrap_or("default")
            ),
        ));
    }
    if let Some(intent_state) = runtime_debug.intent_state.as_deref() {
        rows.push(KeyValuePanelRow::new(
            "Intents",
            format!(
                "{} frame={} agents={}",
                intent_state.status,
                intent_state.frame_index,
                intent_state.agent_intents.len()
            ),
        ));
    }
    if let Some(command_state) = runtime_debug.command_state.as_deref() {
        rows.push(KeyValuePanelRow::new(
            "Execution",
            format!(
                "{} frame={} commands={} routes={}",
                command_state.status,
                command_state.frame_index,
                command_state.agent_commands.len(),
                command_state.routes_loaded
            ),
        ));
    }
    if let Some(application_state) = runtime_debug.execution_application_state.as_deref() {
        rows.push(KeyValuePanelRow::new(
            "Execution Apply",
            format!(
                "{} frame={} applied={} steps={}",
                application_state.status,
                application_state.frame_index,
                application_state.agent_applications.len(),
                application_state.applied_steps
            ),
        ));
    }
    if let Some(effects_state) = runtime_debug.execution_effects_state.as_deref() {
        rows.push(KeyValuePanelRow::new(
            "Execution Effects",
            format!(
                "{} events={} routes={} next_seq={}",
                effects_state.status,
                effects_state.events_emitted,
                effects_state.routes_loaded,
                effects_state.next_sequence
            ),
        ));
    }
    if let Some(transport_state) = runtime_debug.execution_transport_state.as_deref() {
        rows.push(KeyValuePanelRow::new(
            "Execution Transport",
            format!(
                "{} ingested={} retained={} routes={} rollback_floor={} fp={}",
                transport_state.status,
                transport_state.events_ingested,
                transport_state.journal_retained,
                transport_state.channel_routes_loaded,
                transport_state.rollback_floor_sequence,
                transport_state.replay_fingerprint
            ),
        ));
    }
    if let Some(transport_backend_state) = runtime_debug.execution_transport_backend_state.as_deref() {
        rows.push(KeyValuePanelRow::new(
            "Execution Backends",
            format!(
                "{} payloads={} lanes={} routes={} exported={} rollback_floor={} fp={}",
                transport_backend_state.status,
                transport_backend_state.payloads_emitted,
                transport_backend_state.lanes_emitted,
                transport_backend_state.routes_loaded,
                transport_backend_state.exported_through_sequence,
                transport_backend_state.rollback_floor_sequence,
                transport_backend_state.backend_fingerprint
            ),
        ));
    }

    for (anchor, transform, motion) in runtime_debug.agent_q.iter() {
        let (last_linear, last_angular, last_frame) = motion
            .map(|motion| (motion.last_linear, motion.last_angular, motion.last_frame))
            .unwrap_or((Vec3::ZERO, Vec3::ZERO, 0));
        rows.push(KeyValuePanelRow::new(
            format!("Agent {}", anchor.agent_id),
            format!(
                "pos=({:.2}, {:.2}, {:.2}) linear=({:.2}, {:.2}, {:.2}) angular=({:.2}, {:.2}, {:.2}) frame={}",
                transform.translation.x,
                transform.translation.y,
                transform.translation.z,
                last_linear.x,
                last_linear.y,
                last_linear.z,
                last_angular.x,
                last_angular.y,
                last_angular.z,
                last_frame
            ),
        ));
    }

    KeyValuePanelData {
        summary: Some("Runtime diagnostics published through the shared suite panel registry.".to_string()),
        rows,
    }
}
