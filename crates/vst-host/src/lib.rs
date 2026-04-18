use libloading::{Library, Symbol};
use vst3::com_scrape_types::ComPtr;
use log::{error, info, warn};
use std::ffi::{c_void, CString};
use std::path::Path;
use std::sync::Arc;
use vst3::Steinberg::Vst::{
    IAudioProcessor, IComponent, IEditController, ParameterInfo, IEditControllerTrait
};
use vst3::Steinberg::{IPluginFactory, IPluginFactory2, IPluginFactory3, kResultOk, IPluginFactoryTrait};
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
        let lib = unsafe { Library::new(path.as_ref()).map_err(|e| e.to_string())? };

        let get_plugin_factory: Symbol<GetPluginFactoryProc> =
            unsafe { lib.get(b"GetPluginFactory\0").map_err(|e| e.to_string())? };

        let factory_ptr = unsafe { get_plugin_factory() };
        if factory_ptr.is_null() {
            return Err("GetPluginFactory returned null pointer".to_string());
        }

        // Convert the raw COM pointer into a ComPtr.
        let factory = unsafe { ComPtr::from_raw(factory_ptr) }.ok_or("Failed to convert factory to ComPtr")?;

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

        let component = unsafe { ComPtr::<IComponent>::from_raw(instance_ptr as *mut IComponent) }.ok_or("Failed to wrap IComponent")?;

        let edit_controller = component.cast::<IEditController>();
        let audio_processor = component.cast::<IAudioProcessor>();
        
        let mut parameters = Vec::new();
        if let Some(ref controller) = edit_controller {
            let param_count = unsafe { controller.getParameterCount() };
            for i in 0..param_count {
                let mut info = unsafe { std::mem::zeroed::<vst3::Steinberg::Vst::ParameterInfo>() };
                if unsafe { controller.getParameterInfo(i, &mut info) } == vst3::Steinberg::kResultOk {
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
