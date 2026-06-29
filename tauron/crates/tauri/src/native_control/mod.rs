use std::{
  collections::HashMap,
  sync::{Arc, RwLock},
};

use serde::{Deserialize, Serialize};

use crate::{
  plugin::{Builder as PluginBuilder, TauriPlugin},
  Manager, Runtime, Webview,
};

pub const NATIVE_CONTROL_PLUGIN_NAME: &str = "native-control";

type NativeControlHandler =
  dyn Fn(NativeControlRequest) -> Result<serde_json::Value, String> + Send + Sync + 'static;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct NativeControlRequest {
  pub namespace: String,
  pub method: String,
  pub args: serde_json::Value,
  pub correlation_id: Option<String>,
  pub webview_label: Option<String>,
}

impl Default for NativeControlRequest {
  fn default() -> Self {
    Self {
      namespace: String::new(),
      method: String::new(),
      args: serde_json::Value::Null,
      correlation_id: None,
      webview_label: None,
    }
  }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeControlCapabilities {
  pub available: bool,
  pub host_object: &'static str,
  pub protocol_version: u32,
  pub data_plane: &'static str,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeControlEnvelope {
  ok: bool,
  result: Option<serde_json::Value>,
  error: Option<String>,
  correlation_id: Option<String>,
}

#[derive(Default)]
struct NativeControlRegistry {
  handlers: RwLock<HashMap<String, Arc<NativeControlHandler>>>,
}

#[derive(Clone, Default)]
pub struct NativeControlState {
  registry: Arc<NativeControlRegistry>,
}

impl NativeControlState {
  fn register_handler<F>(&self, namespace: &str, method: &str, handler: F) -> Result<(), String>
  where
    F: Fn(NativeControlRequest) -> Result<serde_json::Value, String> + Send + Sync + 'static,
  {
    let key = native_control_key(namespace, method);
    let mut handlers = self
      .registry
      .handlers
      .write()
      .map_err(|_| "native control registry lock poisoned".to_string())?;
    handlers.insert(key, Arc::new(handler));
    Ok(())
  }

  fn dispatch(&self, mut request: NativeControlRequest) -> Result<serde_json::Value, String> {
    if request.namespace.is_empty() || request.method.is_empty() {
      return Err("native control request requires namespace and method".to_string());
    }
    let key = native_control_key(&request.namespace, &request.method);
    if key == native_control_key("system", "capabilities") {
      return serde_json::to_value(native_control_capabilities())
        .map_err(|error| format!("failed to serialize native control capabilities: {error}"));
    }
    if key == native_control_key("system", "ping") {
      return Ok(serde_json::json!({
        "pong": true,
        "args": std::mem::take(&mut request.args),
        "webviewLabel": request.webview_label,
      }));
    }

    let handler = self
      .registry
      .handlers
      .read()
      .map_err(|_| "native control registry lock poisoned".to_string())?
      .get(&key)
      .cloned()
      .ok_or_else(|| format!("native control handler not found: {key}"))?;
    handler(request)
  }
}

pub fn register_handler<R: Runtime, M: Manager<R>, F>(
  manager: &M,
  namespace: &str,
  method: &str,
  handler: F,
) -> Result<(), String>
where
  F: Fn(NativeControlRequest) -> Result<serde_json::Value, String> + Send + Sync + 'static,
{
  manager
    .state::<NativeControlState>()
    .register_handler(namespace, method, handler)
}

fn native_control_key(namespace: &str, method: &str) -> String {
  format!("{namespace}.{method}")
}

fn native_control_capabilities() -> NativeControlCapabilities {
  NativeControlCapabilities {
    available: cfg!(all(windows, feature = "wry")),
    host_object: "tauronNativeControl",
    protocol_version: 1,
    data_plane: "native-stream",
  }
}

fn dispatch_request_json(
  state: &NativeControlState,
  webview_label: &str,
  request_json: &str,
) -> String {
  let mut request = match serde_json::from_str::<NativeControlRequest>(request_json) {
    Ok(request) => request,
    Err(error) => {
      return serialize_envelope(NativeControlEnvelope {
        ok: false,
        result: None,
        error: Some(format!("failed to parse native control request: {error}")),
        correlation_id: None,
      });
    }
  };
  let correlation_id = request.correlation_id.clone();
  request.webview_label = Some(webview_label.to_string());
  match state.dispatch(request) {
    Ok(result) => serialize_envelope(NativeControlEnvelope {
      ok: true,
      result: Some(result),
      error: None,
      correlation_id,
    }),
    Err(error) => serialize_envelope(NativeControlEnvelope {
      ok: false,
      result: None,
      error: Some(error),
      correlation_id,
    }),
  }
}

fn serialize_envelope(envelope: NativeControlEnvelope) -> String {
  serde_json::to_string(&envelope).unwrap_or_else(|error| {
    format!(
      r#"{{"ok":false,"result":null,"error":"failed to serialize native control envelope: {error}","correlationId":null}}"#
    )
  })
}

#[cfg(all(windows, feature = "wry"))]
fn install_native_control_host_object<R: Runtime>(
  webview: Webview<R>,
  state: NativeControlState,
) -> Result<(), String> {
  use std::{
    mem::ManuallyDrop,
    sync::{mpsc, Arc, Mutex},
    time::Duration,
  };

  use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2;
  use windows::{
    core::{implement, Error, BSTR, PCWSTR},
    Win32::{
      Foundation::{DISP_E_BADINDEX, DISP_E_MEMBERNOTFOUND, DISP_E_TYPEMISMATCH, E_INVALIDARG},
      System::{
        Com::{
          IDispatch, IDispatch_Impl, ITypeInfo, DISPATCH_FLAGS, DISPATCH_METHOD,
          DISPATCH_PROPERTYGET, DISPATCH_PROPERTYPUT, DISPPARAMS, EXCEPINFO,
        },
        Ole::DispGetParam,
        Variant::{
          VariantClear, VARIANT, VARIANT_0, VARIANT_0_0, VARIANT_0_0_0, VT_BSTR, VT_BYREF,
          VT_DISPATCH,
        },
      },
    },
  };

  const DISPID_REQUEST_JSON: i32 = 1;
  const DISPID_RESPONSE_JSON: i32 = 2;
  const DISPID_CALL: i32 = 3;
  const HOST_OBJECT_NAME: &str = "tauronNativeControl";

  #[implement(IDispatch)]
  struct NativeControlDispatch {
    state: NativeControlState,
    webview_label: String,
    last_response: Arc<Mutex<String>>,
  }

  #[allow(non_snake_case)]
  impl IDispatch_Impl for NativeControlDispatch_Impl {
    fn GetTypeInfoCount(&self) -> windows::core::Result<u32> {
      Ok(0)
    }

    fn GetTypeInfo(&self, _itinfo: u32, _lcid: u32) -> windows::core::Result<ITypeInfo> {
      Err(Error::from_hresult(DISP_E_BADINDEX))
    }

    fn GetIDsOfNames(
      &self,
      _riid: *const windows::core::GUID,
      rgsznames: *const PCWSTR,
      cnames: u32,
      _lcid: u32,
      rgdispid: *mut i32,
    ) -> windows::core::Result<()> {
      if rgsznames.is_null() || rgdispid.is_null() || cnames == 0 {
        return Err(Error::from_hresult(E_INVALIDARG));
      }
      let name = unsafe { pcwstr_to_string(*rgsznames) };
      unsafe {
        *rgdispid = match name.as_str() {
          "requestJson" => DISPID_REQUEST_JSON,
          "responseJson" => DISPID_RESPONSE_JSON,
          "invoke" | "Invoke" | "call" | "Call" => DISPID_CALL,
          _ => return Err(Error::from_hresult(DISP_E_MEMBERNOTFOUND)),
        };
      }
      Ok(())
    }

    fn Invoke(
      &self,
      dispidmember: i32,
      _riid: *const windows::core::GUID,
      _lcid: u32,
      wflags: DISPATCH_FLAGS,
      pdispparams: *const DISPPARAMS,
      pvarresult: *mut VARIANT,
      _pexcepinfo: *mut EXCEPINFO,
      _puargerr: *mut u32,
    ) -> windows::core::Result<()> {
      if pdispparams.is_null() || pvarresult.is_null() {
        return Err(Error::from_hresult(E_INVALIDARG));
      }
      let params = unsafe { &*pdispparams };

      if dispidmember == DISPID_RESPONSE_JSON && wflags.contains(DISPATCH_PROPERTYGET) {
        let response = self
          .last_response
          .lock()
          .map_err(|_| Error::from_hresult(E_INVALIDARG))?
          .clone();
        unsafe {
          *pvarresult = variant_from_bstr(response);
        }
        return Ok(());
      }

      let accepts_request = (dispidmember == DISPID_REQUEST_JSON
        && wflags.contains(DISPATCH_PROPERTYPUT))
        || (dispidmember == DISPID_CALL && wflags.contains(DISPATCH_METHOD));
      if !accepts_request {
        return Err(Error::from_hresult(DISP_E_MEMBERNOTFOUND));
      }
      if params.cArgs != 1 || params.rgvarg.is_null() {
        return Err(Error::from_hresult(DISP_E_TYPEMISMATCH));
      }
      let request_json = if dispidmember == DISPID_REQUEST_JSON {
        unsafe { variant_bstr_to_string(&*params.rgvarg)? }
      } else {
        unsafe { bstr_arg_from_dispatch_params(pdispparams)? }
      };
      let response = dispatch_request_json(&self.state, &self.webview_label, &request_json);
      if dispidmember == DISPID_REQUEST_JSON {
        *self
          .last_response
          .lock()
          .map_err(|_| Error::from_hresult(E_INVALIDARG))? = response;
        return Ok(());
      }
      unsafe {
        *pvarresult = variant_from_bstr(response);
      }
      Ok(())
    }
  }

  unsafe fn pcwstr_to_string(value: PCWSTR) -> String {
    if value.is_null() {
      return String::new();
    }
    let mut len = 0;
    while *value.0.add(len) != 0 {
      len += 1;
    }
    String::from_utf16_lossy(std::slice::from_raw_parts(value.0, len))
  }

  unsafe fn bstr_arg_from_dispatch_params(
    params: *const DISPPARAMS,
  ) -> windows::core::Result<String> {
    let mut arg = VARIANT::default();
    let mut arg_error = 0_u32;
    if let Err(error) = unsafe { DispGetParam(params, 0, VT_BSTR, &mut arg, Some(&mut arg_error)) }
    {
      return Err(error);
    }
    let value = unsafe { variant_bstr_to_string(&arg) };
    let _ = unsafe { VariantClear(&mut arg) };
    value
  }

  unsafe fn variant_bstr_to_string(value: &VARIANT) -> windows::core::Result<String> {
    let body = &value.Anonymous.Anonymous;
    if body.vt == VT_BSTR {
      return Ok(body.Anonymous.bstrVal.to_string());
    }
    if body.vt == (VT_BSTR | VT_BYREF) {
      let value = body.Anonymous.pbstrVal;
      if value.is_null() {
        return Err(Error::from_hresult(DISP_E_TYPEMISMATCH));
      }
      return Ok((*value).to_string());
    }
    Err(Error::from_hresult(DISP_E_TYPEMISMATCH))
  }

  fn variant_from_bstr(value: String) -> VARIANT {
    VARIANT {
      Anonymous: VARIANT_0 {
        Anonymous: ManuallyDrop::new(VARIANT_0_0 {
          vt: VT_BSTR,
          wReserved1: 0,
          wReserved2: 0,
          wReserved3: 0,
          Anonymous: VARIANT_0_0_0 {
            bstrVal: ManuallyDrop::new(BSTR::from(value)),
          },
        }),
      },
    }
  }

  fn variant_from_dispatch(dispatch: IDispatch) -> VARIANT {
    VARIANT {
      Anonymous: VARIANT_0 {
        Anonymous: ManuallyDrop::new(VARIANT_0_0 {
          vt: VT_DISPATCH,
          wReserved1: 0,
          wReserved2: 0,
          wReserved3: 0,
          Anonymous: VARIANT_0_0_0 {
            pdispVal: ManuallyDrop::new(Some(dispatch)),
          },
        }),
      },
    }
  }

  let webview_label = webview.label().to_string();
  let host_object_name = HOST_OBJECT_NAME
    .encode_utf16()
    .chain(std::iter::once(0))
    .collect::<Vec<_>>();
  let (tx, rx) = mpsc::channel();
  webview
    .with_webview(move |platform_webview| {
      let result = (|| unsafe {
        let dispatch: IDispatch = NativeControlDispatch {
          state,
          webview_label,
          last_response: Arc::new(Mutex::new(String::new())),
        }
        .into();
        let mut object = variant_from_dispatch(dispatch);
        let webview2: ICoreWebView2 = platform_webview
          .controller()
          .CoreWebView2()
          .map_err(|error| format!("failed to resolve CoreWebView2: {error}"))?;
        webview2
          .AddHostObjectToScript(PCWSTR(host_object_name.as_ptr()), &mut object)
          .map_err(|error| format!("failed to add WebView2 native control host object: {error}"))?;
        Ok::<(), String>(())
      })();
      let _ = tx.send(result);
    })
    .map_err(|error| format!("failed to schedule native control host object install: {error}"))?;

  rx.recv_timeout(Duration::from_secs(1))
    .map_err(|_| "timed out installing native control host object".to_string())?
}

#[cfg(not(all(windows, feature = "wry")))]
fn install_native_control_host_object<R: Runtime>(
  _webview: Webview<R>,
  _state: NativeControlState,
) -> Result<(), String> {
  Err("native control host objects require Windows WebView2".to_string())
}

#[crate::command(root = "crate")]
fn capabilities() -> NativeControlCapabilities {
  native_control_capabilities()
}

pub(crate) fn plugin<R: Runtime>() -> TauriPlugin<R> {
  PluginBuilder::new(NATIVE_CONTROL_PLUGIN_NAME)
    .setup(|app, _api| {
      if app.try_state::<NativeControlState>().is_none() {
        let _ = app.manage(NativeControlState::default());
      }
      Ok(())
    })
    .on_webview_ready(|webview| {
      let state = webview.state::<NativeControlState>().inner().clone();
      if let Err(error) = install_native_control_host_object(webview, state) {
        eprintln!("tauron native control unavailable: {error}");
      }
    })
    .js_init_script(native_control_init_script())
    .invoke_handler(crate::generate_handler![
      #![plugin(native_control)]
      capabilities
    ])
    .build()
}

fn native_control_init_script() -> String {
  r#"
    (function () {
      if (window.__TAURI_NATIVE_CONTROL__) {
        return;
      }

      const hostObjectName = 'tauronNativeControl';
      const hostObjects = window.chrome && window.chrome.webview && window.chrome.webview.hostObjects;
      if (hostObjects && hostObjects.options) {
        hostObjects.options.ignoreMemberNotFoundError = true;
        const localProperties = hostObjects.options.forceLocalProperties || [];
        for (const property of ['then', 'toJSON']) {
          if (!localProperties.includes(property)) {
            localProperties.push(property);
          }
        }
        hostObjects.options.forceLocalProperties = localProperties;
        const asyncMethodMatches = hostObjects.options.forceAsyncMethodMatches || [];
        asyncMethodMatches.push(/^tauronNativeControl\.(invoke|Invoke|call|Call)$/);
        asyncMethodMatches.push(/^(invoke|Invoke|call|Call)$/);
        hostObjects.options.forceAsyncMethodMatches = asyncMethodMatches;
      }

      function resolveHostObject() {
        const root = window.chrome &&
          window.chrome.webview &&
          window.chrome.webview.hostObjects;
        if (!root) {
          return null;
        }
        return (root.sync && root.sync[hostObjectName]) || root[hostObjectName];
      }

      const bridge = {
        get available() {
          return !!resolveHostObject();
        },
        async call(request) {
          const hostObject = resolveHostObject();
          if (!hostObject) {
            throw new Error('Tauron native control host object is unavailable');
          }
          let rawEnvelope;
          hostObject.requestJson = JSON.stringify(request);
          rawEnvelope = hostObject.responseJson;
          if (typeof rawEnvelope === 'undefined') {
            throw new Error('Tauron native control host object returned no response');
          }
          const envelope = JSON.parse(String(rawEnvelope));
          if (!envelope.ok) {
            throw new Error(envelope.error || 'Tauron native control call failed');
          }
          return envelope.result;
        }
      };

      Object.defineProperty(window, '__TAURI_NATIVE_CONTROL__', {
        value: bridge,
        configurable: false,
        enumerable: false,
        writable: false
      });
    })();
  "#
  .to_string()
}

#[cfg(test)]
mod tests {
  use super::{dispatch_request_json, NativeControlState};

  #[test]
  fn dispatches_builtin_ping() {
    let state = NativeControlState::default();
    let response = dispatch_request_json(
      &state,
      "main",
      r#"{"namespace":"system","method":"ping","args":{"value":42},"correlationId":"a"}"#,
    );
    assert!(response.contains(r#""ok":true"#));
    assert!(response.contains(r#""pong":true"#));
    assert!(response.contains(r#""correlationId":"a""#));
  }

  #[test]
  fn dispatches_registered_handler() {
    let state = NativeControlState::default();
    state
      .register_handler("fs", "listDir", |request| {
        Ok(serde_json::json!({
          "path": request.args.get("path").and_then(|value| value.as_str()),
          "webviewLabel": request.webview_label,
        }))
      })
      .expect("register handler");
    let response = dispatch_request_json(
      &state,
      "main",
      r#"{"namespace":"fs","method":"listDir","args":{"path":"D:/Projects"}}"#,
    );
    assert!(response.contains(r#""ok":true"#));
    assert!(response.contains("D:/Projects"));
  }
}
