#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct VstParameterState {
    pub id: u32,
    pub title: String,
    pub short_title: String,
    pub units: String,
    pub default_normalized: f64,
    pub min: f64,
    pub max: f64,
    pub value_normalized: f64,
}
