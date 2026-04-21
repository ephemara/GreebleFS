use pyo3::exceptions::PyRuntimeError;
use pyo3::prelude::*;
use pyo3::types::PyDict;
use serde::de::DeserializeOwned;

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

fn encode_embedded_payload_json<T: serde::Serialize>(
    payload: Option<&T>,
) -> Result<Option<String>, String> {
    payload
        .map(|value| {
            serde_json::to_string(value)
                .map_err(|error| format!("Failed to serialize embedded Python payload: {error}"))
        })
        .transpose()
}

fn decode_embedded_result_json<TResult: DeserializeOwned>(
    result_json: &str,
) -> Result<TResult, String> {
    serde_json::from_str(result_json)
        .map_err(|error| format!("Failed to decode embedded Python result JSON: {error}"))
}

fn run_embedded_snippet(
    request: PythonEmbeddedSnippetRequest,
) -> Result<PythonEmbeddedSnippetResponse, String> {
    let callable_name = request.callable_name.unwrap_or_else(|| "main".to_string());
    let payload_json = request.payload_json.unwrap_or_else(|| "null".to_string());

    Python::with_gil(|py| -> PyResult<PythonEmbeddedSnippetResponse> {
        let globals = PyDict::new_bound(py);
        py.run_bound(&request.code, None, Some(&globals))?;

        let callable = globals.get_item(&callable_name)?.ok_or_else(|| {
            PyRuntimeError::new_err(format!(
                "Embedded Python callable '{}' was not defined.",
                callable_name
            ))
        })?;

        let json = py.import_bound("json")?;
        let sys = py.import_bound("sys")?;
        let payload = json.call_method1("loads", (payload_json.clone(),))?;
        let result = callable.call1((payload,))?;
        let result_json = json.call_method1("dumps", (result,))?.extract::<String>()?;
        let python_version = sys
            .getattr("version")?
            .extract::<String>()?
            .split_whitespace()
            .next()
            .unwrap_or("unknown")
            .to_string();

        Ok(PythonEmbeddedSnippetResponse {
            callable_name,
            result_json,
            python_version,
        })
    })
    .map_err(|error| format!("PyO3 execution failed: {error}"))
}

pub fn execute_embedded_python(
    request: PythonEmbeddedSnippetRequest,
) -> Result<PythonEmbeddedSnippetResponse, String> {
    run_embedded_snippet(request)
}

pub fn decode_embedded_python_result<TResult: DeserializeOwned>(
    response: &PythonEmbeddedSnippetResponse,
) -> Result<TResult, String> {
    decode_embedded_result_json(&response.result_json)
}

pub fn execute_embedded_python_json<TPayload, TResult>(
    code: impl Into<String>,
    callable_name: Option<String>,
    payload: Option<TPayload>,
) -> Result<PythonEmbeddedDecodedResponse<TResult>, String>
where
    TPayload: serde::Serialize,
    TResult: DeserializeOwned,
{
    let raw = run_embedded_snippet(PythonEmbeddedSnippetRequest {
        code: code.into(),
        callable_name,
        payload_json: encode_embedded_payload_json(payload.as_ref())?,
    })?;
    let result = decode_embedded_python_result(&raw)?;

    Ok(PythonEmbeddedDecodedResponse { raw, result })
}

#[tauri::command]
#[specta::specta]
pub async fn python_execute_embedded(
    request: PythonEmbeddedSnippetRequest,
) -> Result<PythonEmbeddedSnippetResponse, String> {
    tokio::task::spawn_blocking(move || run_embedded_snippet(request))
        .await
        .map_err(|error| format!("Embedded Python task failed to join: {error}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embedded_python_executes_json_returning_callable() {
        let response = run_embedded_snippet(PythonEmbeddedSnippetRequest {
            code: [
                "def main(payload):",
                "    return {",
                "        'message': 'ok',",
                "        'value': payload.get('value', 0) + 1,",
                "    }",
            ]
            .join("\n"),
            callable_name: Some("main".to_string()),
            payload_json: Some("{\"value\":41}".to_string()),
        })
        .expect("embedded Python should run");

        assert_eq!(response.callable_name, "main");
        assert!(response.result_json.contains("\"value\": 42"));
    }

    #[test]
    fn embedded_python_json_helper_decodes_typed_result() {
        let response = execute_embedded_python_json::<serde_json::Value, serde_json::Value>(
            [
                "def main(payload):",
                "    return {",
                "        'doubled': payload['value'] * 2,",
                "    }",
            ]
            .join("\n"),
            Some("main".to_string()),
            Some(serde_json::json!({ "value": 21 })),
        )
        .expect("embedded Python JSON helper should run");

        assert_eq!(response.raw.callable_name, "main");
        assert_eq!(response.result["doubled"], 42);
    }
}
