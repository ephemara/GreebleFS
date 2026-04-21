use pyo3::exceptions::PyRuntimeError;
use pyo3::prelude::*;
use pyo3::types::PyDict;

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

fn run_embedded_snippet(request: PythonEmbeddedSnippetRequest) -> Result<PythonEmbeddedSnippetResponse, String> {
    let callable_name = request
        .callable_name
        .unwrap_or_else(|| "main".to_string());
    let payload_json = request
        .payload_json
        .unwrap_or_else(|| "null".to_string());

    Python::with_gil(|py| -> PyResult<PythonEmbeddedSnippetResponse> {
        let globals = PyDict::new(py);
        py.run(&request.code, None, Some(globals))?;

        let callable = globals
            .get_item(&callable_name)
            ?
            .ok_or_else(|| PyRuntimeError::new_err(format!(
                "Embedded Python callable '{}' was not defined.",
                callable_name
            )))?;

        let json = py.import("json")?;
        let sys = py.import("sys")?;
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
}
