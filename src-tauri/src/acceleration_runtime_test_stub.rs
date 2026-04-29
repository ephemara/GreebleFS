use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum AccelerationRoutingMode {
    Auto,
    PreferNative,
    PreferCuda,
    CpuOnly,
}
