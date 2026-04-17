use std::time::Duration;

use bevy::prelude::*;
use bevy_egui::{EguiContexts, EguiPrimaryContextPass};
use egui_notify::Toasts;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EditorNotificationLevel {
    Success,
    Info,
    Warning,
    Error,
}

#[derive(Event, Debug, Clone)]
pub struct EditorNotificationEvent {
    pub level: EditorNotificationLevel,
    pub message: String,
    pub duration: Duration,
}

impl EditorNotificationEvent {
    pub fn success(message: impl Into<String>) -> Self {
        Self::new(EditorNotificationLevel::Success, message)
    }

    pub fn info(message: impl Into<String>) -> Self {
        Self::new(EditorNotificationLevel::Info, message)
    }

    pub fn warning(message: impl Into<String>) -> Self {
        Self::new(EditorNotificationLevel::Warning, message)
    }

    pub fn error(message: impl Into<String>) -> Self {
        Self::new(EditorNotificationLevel::Error, message)
    }

    pub fn new(level: EditorNotificationLevel, message: impl Into<String>) -> Self {
        Self {
            level,
            message: message.into(),
            duration: Duration::from_secs(4),
        }
    }
}

impl Message for EditorNotificationEvent {}

#[derive(Resource, Default)]
struct EditorNotificationState {
    toasts: Toasts,
}

pub struct EditorNotificationsPlugin;

impl Plugin for EditorNotificationsPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<EditorNotificationState>()
            .add_message::<EditorNotificationEvent>()
            .add_systems(Update, consume_notification_events)
            .add_systems(EguiPrimaryContextPass, render_notification_toasts);
    }
}

fn consume_notification_events(
    mut events: MessageReader<EditorNotificationEvent>,
    mut state: ResMut<EditorNotificationState>,
) {
    for event in events.read() {
        let toast = match event.level {
            EditorNotificationLevel::Success => state.toasts.success(event.message.clone()),
            EditorNotificationLevel::Info => state.toasts.info(event.message.clone()),
            EditorNotificationLevel::Warning => state.toasts.warning(event.message.clone()),
            EditorNotificationLevel::Error => state.toasts.error(event.message.clone()),
        };

        toast.duration(Some(event.duration));
    }
}

fn render_notification_toasts(
    mut contexts: EguiContexts,
    mut state: ResMut<EditorNotificationState>,
) -> Result {
    let ctx = contexts.ctx_mut()?;
    state.toasts.show(ctx);
    Ok(())
}
