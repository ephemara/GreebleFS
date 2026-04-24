use libloading::{Library, Symbol};
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use vst3::Class;
use vst3::Steinberg::Vst::{
    IAudioProcessor, IComponent, IComponentTrait, IEditController, IEditControllerTrait,
    IHostApplication, IHostApplicationTrait, String128,
};
use vst3::Steinberg::{
    FUnknown, IPluginBaseTrait, IPluginFactory, IPluginFactory3Trait, IPluginFactoryTrait,
    PClassInfo, TUID, kInvalidArgument, kNoInterface, kNotImplemented, kResultOk, tresult,
};
use vst3::com_scrape_types::{ComPtr, ComWrapper, Interface};

#[derive(Debug, Clone)]
pub struct VstParameterDef {
    pub id: u32,
    pub title: String,
    pub short_title: String,
    pub units: String,
    pub default_normalized: f64,
    pub min: f64,
    pub max: f64,
    pub value_normalized: f64,
}

fn parse_tchar(chars: &[u16]) -> String {
    let u16_chars: Vec<u16> = chars.iter().take_while(|&&c| c != 0).copied().collect();
    String::from_utf16_lossy(&u16_chars)
}

fn copy_tchar_string(source: &str, destination: &mut [u16]) {
    destination.fill(0);
    for (index, code_unit) in source
        .encode_utf16()
        .take(destination.len().saturating_sub(1))
        .enumerate()
    {
        destination[index] = code_unit;
    }
}

struct MinimalHostApplication;

impl Class for MinimalHostApplication {
    type Interfaces = (IHostApplication,);
}

impl IHostApplicationTrait for MinimalHostApplication {
    unsafe fn getName(&self, name: *mut String128) -> tresult {
        if name.is_null() {
            return kInvalidArgument;
        }

        unsafe {
            copy_tchar_string("GreebleFS", &mut *name);
        }
        kResultOk
    }

    unsafe fn createInstance(
        &self,
        _cid: *mut TUID,
        _iid: *mut TUID,
        obj: *mut *mut std::ffi::c_void,
    ) -> tresult {
        if !obj.is_null() {
            unsafe {
                *obj = std::ptr::null_mut();
            }
        }
        kNoInterface
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PluginBinaryFormat {
    Elf,
    MachO,
    WindowsPe,
}

impl PluginBinaryFormat {
    fn label(self) -> &'static str {
        match self {
            Self::Elf => "ELF",
            Self::MachO => "Mach-O",
            Self::WindowsPe => "Windows PE",
        }
    }
}

fn expected_host_binary_format() -> PluginBinaryFormat {
    #[cfg(target_os = "linux")]
    {
        return PluginBinaryFormat::Elf;
    }

    #[cfg(target_os = "macos")]
    {
        return PluginBinaryFormat::MachO;
    }

    #[cfg(target_os = "windows")]
    {
        return PluginBinaryFormat::WindowsPe;
    }

    #[allow(unreachable_code)]
    PluginBinaryFormat::Elf
}

fn detect_plugin_binary_format(path: &Path) -> Result<PluginBinaryFormat, String> {
    let mut file = File::open(path)
        .map_err(|error| format!("Failed to open plugin binary {}: {error}", path.display()))?;
    let mut magic = [0_u8; 4];
    file.read_exact(&mut magic).map_err(|error| {
        format!(
            "Failed to read the plugin binary header for {}: {error}",
            path.display()
        )
    })?;

    if magic == [0x7f, b'E', b'L', b'F'] {
        return Ok(PluginBinaryFormat::Elf);
    }

    if magic[0] == b'M' && magic[1] == b'Z' {
        return Ok(PluginBinaryFormat::WindowsPe);
    }

    if matches!(
        magic,
        [0xfe, 0xed, 0xfa, 0xce]
            | [0xce, 0xfa, 0xed, 0xfe]
            | [0xfe, 0xed, 0xfa, 0xcf]
            | [0xcf, 0xfa, 0xed, 0xfe]
            | [0xca, 0xfe, 0xba, 0xbe]
            | [0xbe, 0xba, 0xfe, 0xca]
    ) {
        return Ok(PluginBinaryFormat::MachO);
    }

    Err(format!(
        "Unsupported plugin binary format for {}.",
        path.display()
    ))
}

fn ensure_plugin_binary_matches_host(path: &Path) -> Result<(), String> {
    let detected = detect_plugin_binary_format(path)?;
    let expected = expected_host_binary_format();
    if detected == expected {
        return Ok(());
    }

    Err(format!(
        "Plugin binary {} targets {}, but the current host expects {}.",
        path.display(),
        detected.label(),
        expected.label()
    ))
}

fn first_regular_file_with_extensions(dir: &Path, extensions: &[&str]) -> Option<PathBuf> {
    let mut candidates = std::fs::read_dir(dir)
        .ok()?
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| path.is_file())
        .filter(|path| {
            let extension = path
                .extension()
                .and_then(|value| value.to_str())
                .map(|value| value.to_ascii_lowercase());
            extension
                .as_deref()
                .map(|value| extensions.iter().any(|expected| value == *expected))
                .unwrap_or(false)
        })
        .collect::<Vec<_>>();
    candidates.sort();
    candidates.into_iter().next()
}

#[cfg(target_os = "macos")]
fn first_regular_file(dir: &Path) -> Option<PathBuf> {
    let mut candidates = std::fs::read_dir(dir)
        .ok()?
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| path.is_file())
        .collect::<Vec<_>>();
    candidates.sort();
    candidates.into_iter().next()
}

fn resolve_bundle_module_path(bundle_path: &Path) -> Result<PathBuf, String> {
    #[cfg(target_os = "linux")]
    {
        let linux_module_dir = bundle_path.join("Contents").join("x86_64-linux");
        return first_regular_file_with_extensions(&linux_module_dir, &["so", "vst3"]).ok_or_else(
            || {
                format!(
                    "No Linux VST3 module was found under {}.",
                    linux_module_dir.display()
                )
            },
        );
    }

    #[cfg(target_os = "macos")]
    {
        let macos_module_dir = bundle_path.join("Contents").join("MacOS");
        return first_regular_file(&macos_module_dir).ok_or_else(|| {
            format!(
                "No macOS VST3 module was found under {}.",
                macos_module_dir.display()
            )
        });
    }

    #[cfg(target_os = "windows")]
    {
        let windows_module_dir = bundle_path.join("Contents").join("x86_64-win");
        return first_regular_file_with_extensions(&windows_module_dir, &["vst3", "dll"])
            .ok_or_else(|| {
                format!(
                    "No Windows VST3 module was found under {}.",
                    windows_module_dir.display()
                )
            });
    }

    #[allow(unreachable_code)]
    Err(format!(
        "Unsupported VST3 bundle platform for {}.",
        bundle_path.display()
    ))
}

pub fn resolve_vst3_module_path<P: AsRef<Path>>(path: P) -> Result<PathBuf, String> {
    let path = path.as_ref();
    if !path.exists() {
        return Err(format!("VST3 path does not exist: {}", path.display()));
    }

    let module_path = if path.is_dir() {
        resolve_bundle_module_path(path)?
    } else {
        path.to_path_buf()
    };

    ensure_plugin_binary_matches_host(&module_path)?;
    Ok(module_path)
}

#[cfg(unix)]
fn load_dynamic_library_with_raw_handle(
    path: &Path,
) -> Result<(Library, *mut std::ffi::c_void), String> {
    let raw_library =
        unsafe { libloading::os::unix::Library::new(path).map_err(|error| error.to_string())? };
    let raw_handle = raw_library.into_raw();
    let library = Library::from(unsafe { libloading::os::unix::Library::from_raw(raw_handle) });
    Ok((library, raw_handle))
}

#[cfg(windows)]
fn load_dynamic_library_with_raw_handle(
    path: &Path,
) -> Result<(Library, *mut std::ffi::c_void), String> {
    let raw_library =
        unsafe { libloading::os::windows::Library::new(path).map_err(|error| error.to_string())? };
    let raw_handle = raw_library.into_raw();
    let library = Library::from(unsafe { libloading::os::windows::Library::from_raw(raw_handle) });
    Ok((library, raw_handle as *mut std::ffi::c_void))
}

type ModuleExitProc = unsafe extern "system" fn() -> bool;

#[cfg(target_os = "linux")]
type ModuleEntryProc = unsafe extern "system" fn(*mut std::ffi::c_void) -> bool;

#[cfg(target_os = "macos")]
type ModuleEntryProc = unsafe extern "system" fn(*mut std::ffi::c_void) -> bool;

#[cfg(target_os = "windows")]
type ModuleEntryProc = unsafe extern "system" fn() -> bool;

fn load_required_symbol<T: Copy>(library: &Library, symbol_name: &[u8]) -> Result<T, String> {
    let symbol: Symbol<T> = unsafe {
        library
            .get(symbol_name)
            .map_err(|error| error.to_string())?
    };
    Ok(*symbol)
}

#[cfg(target_os = "windows")]
fn load_optional_symbol<T: Copy>(
    library: &Library,
    symbol_name: &[u8],
) -> Result<Option<T>, String> {
    match unsafe { library.get::<T>(symbol_name) } {
        Ok(symbol) => Ok(Some(*symbol)),
        Err(_) => Ok(None),
    }
}

fn activate_vst_module(
    library: &Library,
    raw_handle: *mut std::ffi::c_void,
) -> Result<Option<ModuleExitProc>, String> {
    #[cfg(target_os = "linux")]
    {
        let module_entry: ModuleEntryProc = load_required_symbol(library, b"ModuleEntry\0")?;
        let module_exit: ModuleExitProc = load_required_symbol(library, b"ModuleExit\0")?;
        if unsafe { module_entry(raw_handle) } {
            return Ok(Some(module_exit));
        }

        return Err("VST3 ModuleEntry returned false on Linux.".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        let bundle_entry: ModuleEntryProc = load_required_symbol(library, b"bundleEntry\0")
            .or_else(|_| load_required_symbol(library, b"BundleEntry\0"))?;
        let bundle_exit: ModuleExitProc = load_required_symbol(library, b"bundleExit\0")
            .or_else(|_| load_required_symbol(library, b"BundleExit\0"))?;
        if unsafe { bundle_entry(raw_handle) } {
            return Ok(Some(bundle_exit));
        }

        return Err("VST3 bundleEntry returned false on macOS.".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(init_dll) = load_optional_symbol::<ModuleEntryProc>(library, b"InitDll\0")? {
            if !unsafe { init_dll() } {
                return Err("VST3 InitDll returned false on Windows.".to_string());
            }
        }

        return load_optional_symbol::<ModuleExitProc>(library, b"ExitDll\0");
    }

    #[allow(unreachable_code)]
    Ok(None)
}

fn build_host_application_context() -> ComPtr<IHostApplication> {
    ComWrapper::new(MinimalHostApplication)
        .to_com_ptr::<IHostApplication>()
        .expect("minimal host application should build")
}

fn find_audio_module_class_id(factory: &ComPtr<IPluginFactory>) -> Result<TUID, String> {
    let class_count = unsafe { factory.countClasses() };
    for index in 0..class_count {
        let mut class_info = unsafe { std::mem::zeroed::<PClassInfo>() };
        if unsafe { factory.getClassInfo(index, &mut class_info) } != kResultOk {
            continue;
        }

        let category = unsafe { std::ffi::CStr::from_ptr(class_info.category.as_ptr()) };
        if category.to_string_lossy() == "Audio Module Class" {
            return Ok(class_info.cid);
        }
    }

    Err("No Audio Module Class found in VST3 plugin.".to_string())
}

fn create_interface_instance<T: Interface>(
    factory: &ComPtr<IPluginFactory>,
    class_id: TUID,
    interface_name: &str,
) -> Result<ComPtr<T>, String> {
    let mut instance_ptr: *mut std::ffi::c_void = std::ptr::null_mut();
    let result = unsafe {
        factory.createInstance(
            class_id.as_ptr(),
            T::IID.as_ptr() as *const _,
            &mut instance_ptr,
        )
    };

    if result != kResultOk || instance_ptr.is_null() {
        return Err(format!("Failed to instantiate VST3 {interface_name}."));
    }

    unsafe { ComPtr::<T>::from_raw(instance_ptr as *mut T) }
        .ok_or_else(|| format!("Failed to wrap VST3 {interface_name}."))
}

fn controller_class_id(component: &ComPtr<IComponent>) -> Option<TUID> {
    let mut class_id = [0_i8; 16];
    let result = unsafe { component.getControllerClassId(&mut class_id) };
    if result == kResultOk && class_id.iter().any(|byte| *byte != 0) {
        Some(class_id)
    } else {
        None
    }
}

struct VstModuleHandle {
    _library: Library,
    module_exit: Option<ModuleExitProc>,
}

impl Drop for VstModuleHandle {
    fn drop(&mut self) {
        if let Some(module_exit) = self.module_exit {
            let _ = unsafe { module_exit() };
        }
    }
}

pub struct HeadlessVstHost {
    _host_context: ComPtr<IHostApplication>,
    _factory: ComPtr<IPluginFactory>,
    pub component: ComPtr<IComponent>,
    pub edit_controller: Option<ComPtr<IEditController>>,
    pub audio_processor: Option<ComPtr<IAudioProcessor>>,
    pub parameters: Vec<VstParameterDef>,
    component_initialized: bool,
    controller_initialized: bool,
    _module: VstModuleHandle,
}

type GetPluginFactoryProc = unsafe extern "system" fn() -> *mut IPluginFactory;

unsafe impl Send for HeadlessVstHost {}

impl HeadlessVstHost {
    fn current_parameter_value(controller: &ComPtr<IEditController>, parameter_id: u32) -> f64 {
        unsafe { controller.getParamNormalized(parameter_id) }.clamp(0.0, 1.0)
    }

    pub fn load_plugin<P: AsRef<Path>>(path: P) -> Result<Self, String> {
        let load_target_path = resolve_vst3_module_path(path.as_ref())?;
        let (lib, raw_module_handle) = load_dynamic_library_with_raw_handle(&load_target_path)?;
        let module_exit = activate_vst_module(&lib, raw_module_handle)?;

        let get_plugin_factory: Symbol<GetPluginFactoryProc> =
            unsafe { lib.get(b"GetPluginFactory\0").map_err(|e| e.to_string())? };

        let factory_ptr = unsafe { get_plugin_factory() };
        if factory_ptr.is_null() {
            return Err("GetPluginFactory returned null pointer".to_string());
        }

        // Convert the raw COM pointer into a ComPtr.
        let factory = unsafe { ComPtr::from_raw(factory_ptr) }
            .ok_or("Failed to convert factory to ComPtr")?;

        let host_context = build_host_application_context();
        if let Some(factory3) = factory.cast::<vst3::Steinberg::IPluginFactory3>() {
            let host_context_ptr = host_context.as_ptr() as *mut FUnknown;
            let set_host_context_result = unsafe { factory3.setHostContext(host_context_ptr) };
            if set_host_context_result != kResultOk
                && set_host_context_result != kNotImplemented
                && set_host_context_result != kNoInterface
            {
                eprintln!(
                    "VST3 setHostContext returned {set_host_context_result}; continuing with minimal host context."
                );
            }
        }

        let cid = find_audio_module_class_id(&factory)?;
        let component = create_interface_instance::<IComponent>(&factory, cid, "IComponent")?;
        let controller_class_id = controller_class_id(&component);
        let component_init_result =
            unsafe { component.initialize(host_context.as_ptr() as *mut FUnknown) };
        if component_init_result != kResultOk {
            return Err(format!(
                "Failed to initialize the VST3 component: {component_init_result}."
            ));
        }

        let mut controller_initialized = false;
        let edit_controller = if let Some(controller_class_id) = controller_class_id {
            match create_interface_instance::<IEditController>(
                &factory,
                controller_class_id,
                "IEditController",
            ) {
                Ok(controller) => {
                    let controller_init_result =
                        unsafe { controller.initialize(host_context.as_ptr() as *mut FUnknown) };
                    if controller_init_result == kResultOk {
                        controller_initialized = true;
                        Some(controller)
                    } else {
                        return Err(format!(
                            "Failed to initialize the VST3 edit controller: {controller_init_result}."
                        ));
                    }
                }
                Err(_) => component.cast::<IEditController>(),
            }
        } else {
            component.cast::<IEditController>()
        };
        let audio_processor = component.cast::<IAudioProcessor>();

        let mut parameters = Vec::new();
        if let Some(ref controller) = edit_controller {
            let param_count = unsafe { controller.getParameterCount() };
            for i in 0..param_count {
                let mut info = unsafe { std::mem::zeroed::<vst3::Steinberg::Vst::ParameterInfo>() };
                if unsafe { controller.getParameterInfo(i, &mut info) }
                    == vst3::Steinberg::kResultOk
                {
                    let title = parse_tchar(&info.title);
                    let short_title = parse_tchar(&info.shortTitle);
                    let units = parse_tchar(&info.units);

                    parameters.push(VstParameterDef {
                        id: info.id,
                        title,
                        short_title,
                        units,
                        default_normalized: info.defaultNormalizedValue,
                        min: 0.0,
                        max: 1.0,
                        value_normalized: Self::current_parameter_value(controller, info.id),
                    });
                }
            }
        }

        Ok(Self {
            _host_context: host_context,
            _factory: factory,
            component,
            edit_controller,
            audio_processor,
            parameters,
            component_initialized: true,
            controller_initialized,
            _module: VstModuleHandle {
                _library: lib,
                module_exit,
            },
        })
    }

    pub fn parameter_snapshot(&self) -> Result<Vec<VstParameterDef>, String> {
        let Some(controller) = self.edit_controller.as_ref() else {
            return Ok(self.parameters.clone());
        };

        Ok(self
            .parameters
            .iter()
            .map(|parameter| VstParameterDef {
                value_normalized: Self::current_parameter_value(controller, parameter.id),
                ..parameter.clone()
            })
            .collect())
    }

    pub fn set_parameter_value(
        &self,
        parameter_id: u32,
        value_normalized: f64,
    ) -> Result<f64, String> {
        let controller = self
            .edit_controller
            .as_ref()
            .ok_or_else(|| "This VST3 plugin does not expose an edit controller.".to_string())?;
        let bounded = value_normalized.clamp(0.0, 1.0);
        let result = unsafe { controller.setParamNormalized(parameter_id, bounded) };
        if result != kResultOk {
            return Err(format!(
                "Failed to set VST3 parameter {parameter_id}: controller returned {result}."
            ));
        }
        Ok(Self::current_parameter_value(controller, parameter_id))
    }
}

impl Drop for HeadlessVstHost {
    fn drop(&mut self) {
        if self.controller_initialized {
            if let Some(edit_controller) = self.edit_controller.as_ref() {
                let _ = unsafe { edit_controller.terminate() };
            }
        }

        self.audio_processor = None;
        self.edit_controller = None;

        if self.component_initialized {
            let _ = unsafe { self.component.terminate() };
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{HeadlessVstHost, resolve_vst3_module_path};
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_dir(name: &str) -> PathBuf {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should work")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("greeblefs-vst-host-{name}-{timestamp}"));
        fs::create_dir_all(&dir).expect("temp dir should be created");
        dir
    }

    fn host_binary_magic() -> [u8; 4] {
        #[cfg(target_os = "linux")]
        {
            return [0x7f, b'E', b'L', b'F'];
        }

        #[cfg(target_os = "macos")]
        {
            return [0xcf, 0xfa, 0xed, 0xfe];
        }

        #[cfg(target_os = "windows")]
        {
            return [b'M', b'Z', 0x90, 0x00];
        }

        #[allow(unreachable_code)]
        [0x7f, b'E', b'L', b'F']
    }

    fn incompatible_binary_magic() -> [u8; 4] {
        #[cfg(target_os = "windows")]
        {
            return [0x7f, b'E', b'L', b'F'];
        }

        #[cfg(not(target_os = "windows"))]
        {
            return [b'M', b'Z', 0x90, 0x00];
        }
    }

    fn write_fake_binary(path: &Path, magic: [u8; 4]) {
        let mut bytes = magic.to_vec();
        bytes.extend_from_slice(&[0_u8; 64]);
        fs::write(path, bytes).expect("fake plugin binary should be written");
    }

    #[test]
    fn resolves_flat_plugin_binary_paths() {
        let root = unique_temp_dir("flat");
        let plugin_path = root.join("Example.vst3");
        write_fake_binary(&plugin_path, host_binary_magic());

        let resolved = resolve_vst3_module_path(&plugin_path).expect("flat plugin should resolve");
        assert_eq!(resolved, plugin_path);

        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn resolves_bundle_plugin_binary_paths() {
        let root = unique_temp_dir("bundle");
        let bundle_path = root.join("Example.vst3");
        #[cfg(target_os = "linux")]
        let module_path = bundle_path
            .join("Contents")
            .join("x86_64-linux")
            .join("Example.so");
        #[cfg(target_os = "macos")]
        let module_path = bundle_path.join("Contents").join("MacOS").join("Example");
        #[cfg(target_os = "windows")]
        let module_path = bundle_path
            .join("Contents")
            .join("x86_64-win")
            .join("Example.vst3");

        fs::create_dir_all(
            module_path
                .parent()
                .expect("bundle module path should have a parent"),
        )
        .expect("bundle directories should be created");
        write_fake_binary(&module_path, host_binary_magic());

        let resolved =
            resolve_vst3_module_path(&bundle_path).expect("bundle plugin should resolve");
        assert_eq!(resolved, module_path);

        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn rejects_incompatible_plugin_binaries_for_the_current_host() {
        let root = unique_temp_dir("incompatible");
        let plugin_path = root.join("WrongHost.vst3");
        write_fake_binary(&plugin_path, incompatible_binary_magic());

        let error = resolve_vst3_module_path(&plugin_path)
            .expect_err("plugin binaries for another operating system should be rejected");
        assert!(error.contains("current host expects"));

        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn smoke_loads_real_vst_when_env_var_is_set() {
        let Ok(plugin_path) = std::env::var("GREEBLEFS_VST_SMOKE_PATH") else {
            return;
        };

        let host =
            HeadlessVstHost::load_plugin(&plugin_path).expect("real VST smoke path should load");
        assert!(host.audio_processor.is_some() || host.edit_controller.is_some());
    }
}
