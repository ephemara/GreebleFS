#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FitMode {
    Contain,
    Cover,
    Stretch,
    ScaleDown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FitDimensions {
    pub width: u32,
    pub height: u32,
}

pub const GREEBLEFS_KAIN_IMAGE_TOOLS_REVISION: i64 = 2;

pub fn plan_fit_dimensions(
    source_width: u32,
    source_height: u32,
    target_width: u32,
    target_height: u32,
    mode: FitMode,
) -> FitDimensions {
    let source_width = source_width.max(1);
    let source_height = source_height.max(1);
    let target_width = target_width.max(1);
    let target_height = target_height.max(1);

    if matches!(mode, FitMode::Stretch) {
        return FitDimensions {
            width: target_width,
            height: target_height,
        };
    }

    if matches!(mode, FitMode::ScaleDown)
        && source_width <= target_width
        && source_height <= target_height
    {
        return FitDimensions {
            width: source_width,
            height: source_height,
        };
    }

    let width_ratio = target_width as f64 / source_width as f64;
    let height_ratio = target_height as f64 / source_height as f64;
    let scale = if matches!(mode, FitMode::Cover) {
        width_ratio.max(height_ratio)
    } else {
        width_ratio.min(height_ratio)
    };

    FitDimensions {
        width: ((source_width as f64 * scale).round() as u32).max(1),
        height: ((source_height as f64 * scale).round() as u32).max(1),
    }
}

pub fn fit_width(
    source_width: i64,
    source_height: i64,
    target_width: i64,
    target_height: i64,
    mode: i64,
) -> i64 {
    plan_fit_dimensions(
        source_width.max(1) as u32,
        source_height.max(1) as u32,
        target_width.max(1) as u32,
        target_height.max(1) as u32,
        ffi_mode(mode.max(0) as u32),
    )
    .width as i64
}

pub fn fit_height(
    source_width: i64,
    source_height: i64,
    target_width: i64,
    target_height: i64,
    mode: i64,
) -> i64 {
    plan_fit_dimensions(
        source_width.max(1) as u32,
        source_height.max(1) as u32,
        target_width.max(1) as u32,
        target_height.max(1) as u32,
        ffi_mode(mode.max(0) as u32),
    )
    .height as i64
}

pub fn image_checksum(bytes: Vec<i64>) -> i64 {
    let mut total = 0i64;
    for (index, value) in bytes.iter().enumerate() {
        let weight = ((index as i64) % 37) + 11;
        total = (total + value * weight + ((index as i64) % 101)) % 1_000_000_007;
    }
    total
}

pub fn image_signature(
    label: String,
    width: i64,
    height: i64,
    cargo_checksum: i64,
    c_checksum: i64,
) -> String {
    format!("{label}:{width}x{height}:cargo{cargo_checksum}:c{c_checksum}")
}

fn ffi_mode(mode: u32) -> FitMode {
    match mode {
        1 => FitMode::Cover,
        2 => FitMode::Stretch,
        3 => FitMode::ScaleDown,
        _ => FitMode::Contain,
    }
}

#[no_mangle]
pub extern "C" fn greeblefs_kain_image_fit_width(
    source_width: u32,
    source_height: u32,
    target_width: u32,
    target_height: u32,
    mode: u32,
) -> u32 {
    plan_fit_dimensions(
        source_width,
        source_height,
        target_width,
        target_height,
        ffi_mode(mode),
    )
    .width
}

#[no_mangle]
pub extern "C" fn greeblefs_kain_image_fit_height(
    source_width: u32,
    source_height: u32,
    target_width: u32,
    target_height: u32,
    mode: u32,
) -> u32 {
    plan_fit_dimensions(
        source_width,
        source_height,
        target_width,
        target_height,
        ffi_mode(mode),
    )
    .height
}

#[no_mangle]
pub extern "C" fn greeblefs_kain_image_tools_revision() -> u32 {
    1
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn contain_preserves_aspect_inside_target() {
        assert_eq!(
            plan_fit_dimensions(4000, 2000, 1000, 1000, FitMode::Contain),
            FitDimensions {
                width: 1000,
                height: 500,
            },
        );
    }

    #[test]
    fn cover_preserves_aspect_covering_target() {
        assert_eq!(
            plan_fit_dimensions(4000, 2000, 1000, 1000, FitMode::Cover),
            FitDimensions {
                width: 2000,
                height: 1000,
            },
        );
    }

    #[test]
    fn scale_down_keeps_small_sources_original() {
        assert_eq!(
            plan_fit_dimensions(200, 100, 1000, 1000, FitMode::ScaleDown),
            FitDimensions {
                width: 200,
                height: 100,
            },
        );
    }
}
