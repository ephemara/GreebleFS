use libloading::{Library, Symbol};
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use vst3::Steinberg::Vst::{IAudioProcessor, IComponent, IEditController, IEditControllerTrait};
use vst3::Steinberg::{IPluginFactory, IPluginFactoryTrait};
use vst3::com_scrape_types::ComPtr;
use vst3::com_scrape_types::Interface;

#[derive(Debug, Clone)]
pub struct VstParameterDef {
    pub id: u32,
    pub title: String,
    pub short_title: String,
    pub units: String,
    pub default_normalized: f64,
    pub min: f64,
    pub max: f64,
}

fn parse_tchar(chars: &[u16]) -> String {
    let u16_chars: Vec<u16> = chars.iter().take_while(|&&c| c != 0).copied().collect();
    String::from_utf16_lossy(&u16_chars)
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

pub struct HeadlessVstHost {
    _lib: Library,
    _factory: ComPtr<IPluginFactory>,
    pub component: ComPtr<IComponent>,
    pub edit_controller: Option<ComPtr<IEditController>>,
    pub audio_processor: Option<ComPtr<IAudioProcessor>>,
    pub parameters: Vec<VstParameterDef>,
}

type GetPluginFactoryProc = unsafe extern "system" fn() -> *mut IPluginFactory;

impl HeadlessVstHost {
    pub fn load_plugin<P: AsRef<Path>>(path: P) -> Result<Self, String> {
        let load_target_path = resolve_vst3_module_path(path.as_ref())?;
        let lib = unsafe { Library::new(&load_target_path).map_err(|e| e.to_string())? };

        let get_plugin_factory: Symbol<GetPluginFactoryProc> =
            unsafe { lib.get(b"GetPluginFactory\0").map_err(|e| e.to_string())? };

        let factory_ptr = unsafe { get_plugin_factory() };
        if factory_ptr.is_null() {
            return Err("GetPluginFactory returned null pointer".to_string());
        }

        // Convert the raw COM pointer into a ComPtr.
        let factory = unsafe { ComPtr::from_raw(factory_ptr) }
            .ok_or("Failed to convert factory to ComPtr")?;

        let class_count = unsafe { factory.countClasses() };
        let mut target_cid: Option<vst3::Steinberg::TUID> = None;
        for i in 0..class_count {
            let mut class_info = unsafe { std::mem::zeroed::<vst3::Steinberg::PClassInfo>() };
            if unsafe { factory.getClassInfo(i, &mut class_info) } == vst3::Steinberg::kResultOk {
                let category = unsafe { std::ffi::CStr::from_ptr(class_info.category.as_ptr()) };
                if category.to_string_lossy() == "Audio Module Class" {
                    target_cid = Some(class_info.cid);
                    break;
                }
            }
        }

        let cid = target_cid.ok_or("No Audio Module Class found in VST3 plugin")?;

        let mut instance_ptr: *mut std::ffi::c_void = std::ptr::null_mut();

        let result = unsafe {
            factory.createInstance(
                cid.as_ptr(),
                vst3::Steinberg::Vst::IComponent::IID.as_ptr() as *const _,
                &mut instance_ptr,
            )
        };

        if result != vst3::Steinberg::kResultOk || instance_ptr.is_null() {
            return Err("Failed to instantiate VST3 IComponent".to_string());
        }

        let component = unsafe { ComPtr::<IComponent>::from_raw(instance_ptr as *mut IComponent) }
            .ok_or("Failed to wrap IComponent")?;

        let edit_controller = component.cast::<IEditController>();
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
                    });
                }
            }
        }

        Ok(Self {
            _lib: lib,
            _factory: factory,
            component,
            edit_controller,
            audio_processor,
            parameters,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::resolve_vst3_module_path;
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
        let module_path = bundle_path.join("Contents").join("x86_64-linux").join("Example.so");
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

        let resolved = resolve_vst3_module_path(&bundle_path).expect("bundle plugin should resolve");
        assert_eq!(resolved, module_path);

        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn rejects_incompatible_plugin_binaries_for_the_current_host() {
        let root = unique_temp_dir("incompatible");
        let plugin_path = root.join("WrongHost.vst3");
        write_fake_binary(&plugin_path, incompatible_binary_magic());

        let error = resolve_vst3_module_path(&plugin_path).expect_err(
            "plugin binaries for another operating system should be rejected",
        );
        assert!(error.contains("current host expects"));

        fs::remove_dir_all(root).ok();
    }
}
