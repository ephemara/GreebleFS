use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum FileSearchMatchKind {
    Name,
    Content,
    NameAndContent,
}
