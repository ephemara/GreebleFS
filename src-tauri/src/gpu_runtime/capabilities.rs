use super::types::{GpuEffectiveTier, GpuTierMode};

#[derive(Debug, Clone)]
pub(crate) struct GpuCapabilityProfile {
    pub adapter_name: String,
    pub adapter_type: String,
    pub backend_name: String,
    pub software_renderer: bool,
    pub compute_available: bool,
    pub max_texture_dimension_2d: u32,
    pub max_buffer_size: u64,
    pub max_storage_buffer_binding_size: u32,
    pub device_type: wgpu::DeviceType,
}

#[derive(Debug)]
pub(crate) struct GpuAdapterProbe {
    pub instance: wgpu::Instance,
    pub adapter: wgpu::Adapter,
    pub profile: GpuCapabilityProfile,
}

pub(crate) fn power_preference_for_mode(mode: GpuTierMode) -> wgpu::PowerPreference {
    match mode {
        GpuTierMode::Auto => wgpu::PowerPreference::None,
        GpuTierMode::Safe | GpuTierMode::Integrated => wgpu::PowerPreference::LowPower,
        GpuTierMode::Discrete => wgpu::PowerPreference::HighPerformance,
    }
}

pub(crate) fn request_adapter_probe(
    power_preference: wgpu::PowerPreference,
) -> Result<Option<GpuAdapterProbe>, String> {
    let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
        backends: wgpu::Backends::all(),
        ..Default::default()
    });
    let adapter = match pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
        power_preference,
        force_fallback_adapter: false,
        compatible_surface: None,
    })) {
        Ok(adapter) => adapter,
        Err(_) => return Ok(None),
    };

    let profile = profile_from_adapter(&adapter);
    Ok(Some(GpuAdapterProbe {
        instance,
        adapter,
        profile,
    }))
}

pub(crate) fn profile_from_adapter(adapter: &wgpu::Adapter) -> GpuCapabilityProfile {
    let info = adapter.get_info();
    let limits = adapter.limits();
    let software_renderer = matches!(info.device_type, wgpu::DeviceType::Cpu);
    let compute_available = limits.max_storage_buffers_per_shader_stage > 0
        && limits.max_compute_workgroup_storage_size > 0;

    GpuCapabilityProfile {
        adapter_name: info.name,
        adapter_type: device_type_label(info.device_type).to_string(),
        backend_name: backend_label(info.backend).to_string(),
        software_renderer,
        compute_available,
        max_texture_dimension_2d: limits.max_texture_dimension_2d,
        max_buffer_size: limits.max_buffer_size,
        max_storage_buffer_binding_size: limits.max_storage_buffer_binding_size,
        device_type: info.device_type,
    }
}

pub(crate) fn resolve_effective_tier(
    configured_mode: GpuTierMode,
    profile: Option<&GpuCapabilityProfile>,
) -> GpuEffectiveTier {
    let Some(profile) = profile else {
        return GpuEffectiveTier::Safe;
    };

    if profile.software_renderer || !profile.compute_available {
        return GpuEffectiveTier::Safe;
    }

    match configured_mode {
        GpuTierMode::Safe => GpuEffectiveTier::Safe,
        GpuTierMode::Integrated => GpuEffectiveTier::Integrated,
        GpuTierMode::Discrete => GpuEffectiveTier::Discrete,
        GpuTierMode::Auto => match profile.device_type {
            wgpu::DeviceType::DiscreteGpu => GpuEffectiveTier::Discrete,
            wgpu::DeviceType::IntegratedGpu
            | wgpu::DeviceType::VirtualGpu
            | wgpu::DeviceType::Other => GpuEffectiveTier::Integrated,
            wgpu::DeviceType::Cpu => GpuEffectiveTier::Safe,
        },
    }
}

fn backend_label(backend: wgpu::Backend) -> &'static str {
    match backend {
        wgpu::Backend::Vulkan => "Vulkan",
        wgpu::Backend::Metal => "Metal",
        wgpu::Backend::Dx12 => "DirectX 12",
        wgpu::Backend::Gl => "OpenGL",
        wgpu::Backend::BrowserWebGpu => "Browser WebGPU",
        wgpu::Backend::Noop => "Noop",
    }
}

fn device_type_label(device_type: wgpu::DeviceType) -> &'static str {
    match device_type {
        wgpu::DeviceType::DiscreteGpu => "discrete-gpu",
        wgpu::DeviceType::IntegratedGpu => "integrated-gpu",
        wgpu::DeviceType::VirtualGpu => "virtual-gpu",
        wgpu::DeviceType::Cpu => "cpu",
        wgpu::DeviceType::Other => "other",
    }
}

#[cfg(test)]
mod tests {
    use super::{resolve_effective_tier, GpuCapabilityProfile};
    use crate::gpu_runtime::types::{GpuEffectiveTier, GpuTierMode};

    fn profile(device_type: wgpu::DeviceType) -> GpuCapabilityProfile {
        GpuCapabilityProfile {
            adapter_name: "Test".to_string(),
            adapter_type: "test".to_string(),
            backend_name: "Test".to_string(),
            software_renderer: matches!(device_type, wgpu::DeviceType::Cpu),
            compute_available: !matches!(device_type, wgpu::DeviceType::Cpu),
            max_texture_dimension_2d: 4096,
            max_buffer_size: 1 << 26,
            max_storage_buffer_binding_size: 1 << 24,
            device_type,
        }
    }

    #[test]
    fn auto_mode_picks_integrated_for_integrated_adapters() {
        let resolved = resolve_effective_tier(
            GpuTierMode::Auto,
            Some(&profile(wgpu::DeviceType::IntegratedGpu)),
        );
        assert_eq!(resolved, GpuEffectiveTier::Integrated);
    }

    #[test]
    fn auto_mode_picks_discrete_for_discrete_adapters() {
        let resolved = resolve_effective_tier(
            GpuTierMode::Auto,
            Some(&profile(wgpu::DeviceType::DiscreteGpu)),
        );
        assert_eq!(resolved, GpuEffectiveTier::Discrete);
    }

    #[test]
    fn software_renderers_force_safe_tier() {
        let resolved =
            resolve_effective_tier(GpuTierMode::Discrete, Some(&profile(wgpu::DeviceType::Cpu)));
        assert_eq!(resolved, GpuEffectiveTier::Safe);
    }
}
