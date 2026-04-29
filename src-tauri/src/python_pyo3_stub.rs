use serde::de::DeserializeOwned;

const EMBEDDED_PYTHON_UNAVAILABLE_IN_LIB_TESTS: &str =
    "Embedded PyO3 execution is disabled in cargo lib tests on Windows so the \
     native test binary can run without importing python311.dll at process startup.";

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PythonEmbeddedSnippetRequest {
    pub code: String,
    pub callable_name: Option<String>,
    pub payload_json: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PythonEmbeddedSnippetResponse {
    pub callable_name: String,
    pub result_json: String,
    pub python_version: String,
}

#[derive(Debug, Clone)]
pub struct PythonEmbeddedDecodedResponse<TResult> {
    pub raw: PythonEmbeddedSnippetResponse,
    pub result: TResult,
}

fn decode_embedded_result_json<TResult: DeserializeOwned>(
    result_json: &str,
) -> Result<TResult, String> {
    serde_json::from_str(result_json)
        .map_err(|error| format!("Failed to decode embedded Python result JSON: {error}"))
}

fn embedded_python_unavailable_error() -> String {
    EMBEDDED_PYTHON_UNAVAILABLE_IN_LIB_TESTS.to_string()
}

pub fn execute_embedded_python(
    _request: PythonEmbeddedSnippetRequest,
) -> Result<PythonEmbeddedSnippetResponse, String> {
    Err(embedded_python_unavailable_error())
}

pub fn decode_embedded_python_result<TResult: DeserializeOwned>(
    response: &PythonEmbeddedSnippetResponse,
) -> Result<TResult, String> {
    decode_embedded_result_json(&response.result_json)
}

pub fn execute_embedded_python_json<TPayload, TResult>(
    _code: impl Into<String>,
    _callable_name: Option<String>,
    _payload: Option<TPayload>,
) -> Result<PythonEmbeddedDecodedResponse<TResult>, String>
where
    TPayload: serde::Serialize,
    TResult: DeserializeOwned,
{
    Err(embedded_python_unavailable_error())
}

#[tauri::command]
#[specta::specta]
pub async fn python_execute_embedded(
    _request: PythonEmbeddedSnippetRequest,
) -> Result<PythonEmbeddedSnippetResponse, String> {
    Err(embedded_python_unavailable_error())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embedded_python_stub_returns_clear_error() {
        let error = execute_embedded_python(PythonEmbeddedSnippetRequest {
            code: "def main(payload): return payload".to_string(),
            callable_name: Some("main".to_string()),
            payload_json: Some("{\"value\":41}".to_string()),
        })
        .expect_err("embedded python should stay disabled in lib tests");

        assert!(error.contains("disabled"));
        assert!(error.contains("cargo lib tests"));
    }

    #[test]
    fn embedded_python_stub_keeps_result_decoder_available() {
        let decoded = decode_embedded_python_result::<serde_json::Value>(&PythonEmbeddedSnippetResponse {
            callable_name: "main".to_string(),
            result_json: "{\"value\":42}".to_string(),
            python_version: "stub".to_string(),
        })
        .expect("stub should still decode JSON payloads");

        assert_eq!(decoded["value"], 42);
    }
}
