use serde::de::DeserializeOwned;
use tauri::ipc::{InvokeBody, InvokeMessage};

pub fn parse_json_invoke_args<T: DeserializeOwned>(
    message: &InvokeMessage<tauri::Wry>,
) -> Result<T, String> {
    match message.payload() {
        InvokeBody::Json(payload) => serde_json::from_value(payload.clone())
            .map_err(|error| format!("Invalid command payload: {error}")),
        InvokeBody::Raw(_) => Err("Command expects JSON arguments.".to_string()),
    }
}

pub fn spawn_raw_invoke_response<T, TFut>(
    resolver: tauri::ipc::InvokeResolver<tauri::Wry>,
    future: TFut,
) where
    T: serde::Serialize + Send + 'static,
    TFut: std::future::Future<Output = Result<T, String>> + Send + 'static,
{
    tauri::async_runtime::spawn(async move {
        resolver.respond(future.await.map_err(Into::into));
    });
}
