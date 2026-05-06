use bevy::prelude::*;
use std::collections::HashMap;

pub const PANEL_VIEWPORT: &str = "core.viewport";
pub const PANEL_CONTENT_BROWSER: &str = "core.content_browser";
pub const PANEL_UI_SURFACES: &str = "core.ui_surfaces";
pub const PANEL_RUNTIME_DIAGNOSTICS: &str = "bevy.runtime_diagnostics";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SuitePanelKind {
    Viewport,
    AssetBrowser,
    UiSurfaceStudio,
    KeyValueTable,
}

#[derive(Debug, Clone)]
pub struct SuitePanelDefinition {
    pub key: String,
    pub title: String,
    pub kind: SuitePanelKind,
    pub data_source_key: Option<String>,
    pub closeable: bool,
}

impl SuitePanelDefinition {
    pub fn new(
        key: impl Into<String>,
        title: impl Into<String>,
        kind: SuitePanelKind,
    ) -> Self {
        Self {
            key: key.into(),
            title: title.into(),
            kind,
            data_source_key: None,
            closeable: false,
        }
    }

    pub fn with_data_source(mut self, data_source_key: impl Into<String>) -> Self {
        self.data_source_key = Some(data_source_key.into());
        self
    }

    pub fn closeable(mut self, closeable: bool) -> Self {
        self.closeable = closeable;
        self
    }
}

#[derive(Resource, Default)]
pub struct SuitePanelRegistry {
    definitions: HashMap<String, SuitePanelDefinition>,
}

impl SuitePanelRegistry {
    pub fn register(&mut self, definition: SuitePanelDefinition) {
        self.definitions.insert(definition.key.clone(), definition);
    }

    pub fn contains(&self, key: &str) -> bool {
        self.definitions.contains_key(key)
    }

    pub fn get(&self, key: &str) -> Option<&SuitePanelDefinition> {
        self.definitions.get(key)
    }

    pub fn list(&self) -> impl Iterator<Item = &SuitePanelDefinition> {
        self.definitions.values()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PanelSplitAxis {
    Horizontal,
    Vertical,
}

#[derive(Debug, Clone)]
pub enum PanelLayoutNode {
    Leaf { panel_keys: Vec<String> },
    Split {
        axis: PanelSplitAxis,
        ratio: f32,
        first: Box<PanelLayoutNode>,
        second: Box<PanelLayoutNode>,
    },
}

#[derive(Resource, Debug, Clone)]
pub struct DockWorkspaceLayoutTemplate {
    pub root: PanelLayoutNode,
}

impl Default for DockWorkspaceLayoutTemplate {
    fn default() -> Self {
        Self {
            root: PanelLayoutNode::Split {
                axis: PanelSplitAxis::Horizontal,
                ratio: 0.76,
                first: Box::new(PanelLayoutNode::Split {
                    axis: PanelSplitAxis::Vertical,
                    ratio: 0.72,
                    first: Box::new(PanelLayoutNode::Leaf {
                        panel_keys: vec![PANEL_VIEWPORT.to_string()],
                    }),
                    second: Box::new(PanelLayoutNode::Leaf {
                        panel_keys: vec![PANEL_CONTENT_BROWSER.to_string()],
                    }),
                }),
                second: Box::new(PanelLayoutNode::Leaf {
                    panel_keys: vec![
                        PANEL_UI_SURFACES.to_string(),
                        PANEL_RUNTIME_DIAGNOSTICS.to_string(),
                    ],
                }),
            },
        }
    }
}

#[derive(Debug, Clone)]
pub struct KeyValuePanelRow {
    pub label: String,
    pub value: String,
}

impl KeyValuePanelRow {
    pub fn new(label: impl Into<String>, value: impl Into<String>) -> Self {
        Self {
            label: label.into(),
            value: value.into(),
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct KeyValuePanelData {
    pub summary: Option<String>,
    pub rows: Vec<KeyValuePanelRow>,
}

#[derive(Resource, Default)]
pub struct KeyValuePanelStore {
    panels: HashMap<String, KeyValuePanelData>,
}

impl KeyValuePanelStore {
    pub fn set_panel(&mut self, key: impl Into<String>, data: KeyValuePanelData) {
        self.panels.insert(key.into(), data);
    }

    pub fn get(&self, key: &str) -> Option<&KeyValuePanelData> {
        self.panels.get(key)
    }
}
