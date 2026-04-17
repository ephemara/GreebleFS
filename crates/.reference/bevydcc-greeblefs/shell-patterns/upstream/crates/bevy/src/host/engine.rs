use bevy::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub struct HostEnginePlugin;

impl Plugin for HostEnginePlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<HostEngineCatalog>()
            .init_resource::<HostEngineState>();
    }
}

#[derive(Resource, Clone, Debug)]
pub struct HostEngineCatalog {
    domains: BTreeMap<String, HostEngineDomainDescriptor>,
}

impl Default for HostEngineCatalog {
    fn default() -> Self {
        let mut domains = BTreeMap::new();

        register_domain(
            &mut domains,
            "sculpt",
            "Sculpt",
            HostEngineDomainStatus::ActiveLane,
            HostEngineDockTarget::Viewport,
            "unified-sculpt-viewport",
            "Primary digital clay lane. Mirrors the old sculpt host with Bevy-native viewport, brush, layer, and import flows.",
            &[
                "crates/.reference/apps/sculpting/sculpt/KSculptBevy.tsx",
                "crates/.reference/apps/sculpting/sculpt/KSculpt.tsx",
            ],
            &["crates/sculpt", "crates/brushes", "crates/gpu-pipeline"],
            &[
                "sculpt.clay",
                "sculpt.smooth",
                "sculpt.grab",
                "sculpt.flatten",
                "sculpt.remesh",
            ],
        );
        register_domain(
            &mut domains,
            "rig",
            "Rig",
            HostEngineDomainStatus::BridgeLane,
            HostEngineDockTarget::Viewport,
            "rig-authoring",
            "Rigging and weight workflow lane. Mirrors the old rig app family and should converge on Bevy-native skeleton, binding, and motion tooling.",
            &["crates/.reference/apps/anim/rig/KRig.tsx"],
            &["crates/rig", "crates/animation"],
            &["rig.bind", "rig.weight_paint", "rig.physics"],
        );
        register_domain(
            &mut domains,
            "surface.paint",
            "Surface Paint",
            HostEngineDomainStatus::BridgeLane,
            HostEngineDockTarget::UiSurfaces,
            "surface-paint",
            "Bevy-native PBR painting lane backed by SVT, material presets, and shared brush state.",
            &["crates/.reference/apps/surface/paint/KPainter.tsx"],
            &[
                "crates/material",
                "crates/gpu-pipeline",
                "crates/brushes",
                "crates/ui",
            ],
            &["paint.pbr", "paint.color", "paint.mask", "paint.projection"],
        );
        register_domain(
            &mut domains,
            "surface.autopbr",
            "AutoPBR",
            HostEngineDomainStatus::BridgeLane,
            HostEngineDockTarget::UiSurfaces,
            "autopbr-authoring",
            "Procedural material authoring lane tied to AutoPBR schemas and presets.",
            &["crates/.reference/apps/surface/autopbr/KAutopbr.tsx"],
            &["crates/material", "crates/hdr"],
            &["material.author", "material.preview", "material.export"],
        );
        register_domain(
            &mut domains,
            "surface.atlas",
            "Atlas UV",
            HostEngineDomainStatus::BridgeLane,
            HostEngineDockTarget::UiSurfaces,
            "atlas-uv",
            "UV and packing lane for atlas editing and unwrap workflows.",
            &["crates/.reference/apps/surface/atlas/KAtlas.tsx"],
            &["crates/mesh-processing", "crates/io"],
            &["uv.unwrap", "uv.pack", "uv.preview"],
        );
        register_domain(
            &mut domains,
            "modeling.scatter",
            "Scatter",
            HostEngineDomainStatus::BridgeLane,
            HostEngineDockTarget::Viewport,
            "scatter-authoring",
            "Instancing and distribution lane for scatter-based modeling workflows.",
            &["crates/.reference/apps/modeling/scatter/KScatter.tsx"],
            &["crates/scatter", "crates/scene"],
            &["scatter.paint", "scatter.distribute", "scatter.seed"],
        );
        register_domain(
            &mut domains,
            "simulation.tecton",
            "Tecton",
            HostEngineDomainStatus::PlannedLane,
            HostEngineDockTarget::Viewport,
            "terrain-simulation",
            "Terrain and tectonic simulation lane intended to converge on native simulation tooling.",
            &["crates/.reference/apps/sim/tecton/KTecton.tsx"],
            &["crates/sim", "crates/scene-runtime"],
            &["sim.heightfield", "sim.erosion", "sim.tectonics"],
        );
        register_domain(
            &mut domains,
            "render.inspect",
            "Inspect",
            HostEngineDomainStatus::BridgeLane,
            HostEngineDockTarget::UiSurfaces,
            "render-inspection",
            "Renderer inspection and debug lane for material, viewport, and frame analysis.",
            &["crates/.reference/apps/render/inspect/KInspect.tsx"],
            &["crates/renderer", "crates/hdr"],
            &["render.inspect", "render.capture", "render.debug"],
        );

        Self { domains }
    }
}

impl HostEngineCatalog {
    pub fn resolve_domain(&self, domain_key: &str) -> Option<&HostEngineDomainDescriptor> {
        self.domains.get(domain_key)
    }
}

#[derive(Resource, Clone, Debug)]
pub struct HostEngineState {
    pub active_domain_key: String,
    pub active_tool_key: Option<String>,
}

impl Default for HostEngineState {
    fn default() -> Self {
        Self {
            active_domain_key: "sculpt".to_string(),
            active_tool_key: Some("sculpt.clay".to_string()),
        }
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct HostEngineDomainDescriptor {
    pub domain_key: String,
    pub title: String,
    pub status: HostEngineDomainStatus,
    pub preferred_dock_target: HostEngineDockTarget,
    pub viewport_profile: String,
    pub summary: String,
    pub reference_paths: Vec<String>,
    pub crate_bindings: Vec<String>,
    pub tool_keys: Vec<String>,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum HostEngineDomainStatus {
    ActiveLane,
    BridgeLane,
    PlannedLane,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum HostEngineDockTarget {
    Viewport,
    ContentBrowser,
    UiSurfaces,
}

fn register_domain(
    domains: &mut BTreeMap<String, HostEngineDomainDescriptor>,
    domain_key: &str,
    title: &str,
    status: HostEngineDomainStatus,
    preferred_dock_target: HostEngineDockTarget,
    viewport_profile: &str,
    summary: &str,
    reference_paths: &[&str],
    crate_bindings: &[&str],
    tool_keys: &[&str],
) {
    domains.insert(
        domain_key.to_string(),
        HostEngineDomainDescriptor {
            domain_key: domain_key.to_string(),
            title: title.to_string(),
            status,
            preferred_dock_target,
            viewport_profile: viewport_profile.to_string(),
            summary: summary.to_string(),
            reference_paths: reference_paths
                .iter()
                .map(|value| (*value).to_string())
                .collect(),
            crate_bindings: crate_bindings
                .iter()
                .map(|value| (*value).to_string())
                .collect(),
            tool_keys: tool_keys.iter().map(|value| (*value).to_string()).collect(),
        },
    );
}
