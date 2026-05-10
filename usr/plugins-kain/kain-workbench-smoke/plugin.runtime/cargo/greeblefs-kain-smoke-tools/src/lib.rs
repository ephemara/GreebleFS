#[no_mangle]
pub extern "C" fn greeblefs_kain_smoke_score(byte_len: u32, ffi_lane_count: u32) -> u32 {
    byte_len.saturating_add(ffi_lane_count.saturating_mul(17))
}

#[no_mangle]
pub extern "C" fn greeblefs_kain_smoke_capability_count() -> u32 {
    5
}
