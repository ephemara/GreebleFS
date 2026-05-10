use super::{volume_key_for_path, IndexedPathBuildOutput, IndexedPathRecord};
use crate::explorer_path_key::ExplorerPathKey;
use crate::native_task_graph::NativeTaskCancellationToken;
use std::collections::HashMap;
use std::ffi::OsStr;
use std::mem::{size_of, zeroed};
use std::os::windows::ffi::OsStrExt;
use std::path::{Path, PathBuf};
use windows_sys::Win32::Foundation::{
    CloseHandle, GetLastError, GENERIC_READ, HANDLE, INVALID_HANDLE_VALUE,
};
use windows_sys::Win32::Storage::FileSystem::{
    CreateFileW, FILE_ATTRIBUTE_DIRECTORY, FILE_ATTRIBUTE_HIDDEN, FILE_ATTRIBUTE_REPARSE_POINT,
    FILE_FLAG_BACKUP_SEMANTICS, FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE,
    OPEN_EXISTING,
};
use windows_sys::Win32::System::Ioctl::{
    FSCTL_ENUM_USN_DATA, FSCTL_QUERY_USN_JOURNAL, MFT_ENUM_DATA_V0, USN_JOURNAL_DATA_V0,
};
use windows_sys::Win32::System::IO::DeviceIoControl;

const USN_ENUM_BUFFER_BYTES: usize = 1024 * 1024;
const WINDOWS_TICK_MS_DIVISOR: i64 = 10_000;
const WINDOWS_UNIX_EPOCH_TICKS: i64 = 116_444_736_000_000_000;

#[derive(Debug, Clone)]
struct UsnRecord {
    file_ref: String,
    parent_file_ref: String,
    name: String,
    file_attributes: u32,
    timestamp_ms: u64,
}

struct VolumeHandle(HANDLE);

impl Drop for VolumeHandle {
    fn drop(&mut self) {
        unsafe {
            if self.0 != INVALID_HANDLE_VALUE {
                CloseHandle(self.0);
            }
        }
    }
}

pub(super) fn build_records_from_usn(
    requested_root_path: &Path,
    token: &NativeTaskCancellationToken,
) -> Result<IndexedPathBuildOutput, String> {
    let volume_root = resolve_volume_root(requested_root_path)?;
    let requested_root_key = ExplorerPathKey::from_path(requested_root_path);
    let volume_handle = open_volume_handle(&volume_root)?;
    let journal = query_usn_journal(volume_handle.0)?;
    let usn_records = enumerate_usn_records(volume_handle.0, journal.NextUsn, token)?;
    token.throw_if_cancelled()?;
    let records = reconstruct_index_records(
        requested_root_path,
        &requested_root_key,
        &volume_root,
        usn_records,
        token,
    )?;
    Ok(IndexedPathBuildOutput {
        source: "windowsUsn".to_string(),
        volume_key: volume_key_for_path(&volume_root),
        journal_id: Some(journal.UsnJournalID),
        last_usn: Some(journal.NextUsn),
        records,
    })
}

fn resolve_volume_root(path: &Path) -> Result<PathBuf, String> {
    let value = path.to_string_lossy();
    let bytes = value.as_bytes();
    if bytes.len() >= 2 && bytes[1] == b':' {
        return Ok(PathBuf::from(format!("{}\\", &value[..2])));
    }
    Err(format!(
        "Windows USN indexing requires a drive-letter path, got {}",
        path.display()
    ))
}

fn open_volume_handle(volume_root: &Path) -> Result<VolumeHandle, String> {
    let value = volume_root.to_string_lossy();
    let bytes = value.as_bytes();
    if bytes.len() < 2 || bytes[1] != b':' {
        return Err(format!(
            "Cannot derive Win32 volume path from {}",
            volume_root.display()
        ));
    }
    let volume_path = format!(r"\\.\{}", &value[..2]);
    let wide = wide_null(&volume_path);
    let handle = unsafe {
        CreateFileW(
            wide.as_ptr(),
            GENERIC_READ,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            std::ptr::null(),
            OPEN_EXISTING,
            FILE_FLAG_BACKUP_SEMANTICS,
            std::ptr::null_mut(),
        )
    };
    if handle == INVALID_HANDLE_VALUE {
        return Err(format!(
            "Failed to open NTFS volume {volume_path} for USN indexing: Win32 error {}",
            unsafe { GetLastError() }
        ));
    }
    Ok(VolumeHandle(handle))
}

fn query_usn_journal(handle: HANDLE) -> Result<USN_JOURNAL_DATA_V0, String> {
    let mut output = unsafe { zeroed::<USN_JOURNAL_DATA_V0>() };
    let mut returned = 0u32;
    let ok = unsafe {
        DeviceIoControl(
            handle,
            FSCTL_QUERY_USN_JOURNAL,
            std::ptr::null(),
            0,
            &mut output as *mut _ as *mut _,
            size_of::<USN_JOURNAL_DATA_V0>() as u32,
            &mut returned,
            std::ptr::null_mut(),
        )
    };
    if ok == 0 {
        return Err(format!(
            "FSCTL_QUERY_USN_JOURNAL failed: Win32 error {}",
            unsafe { GetLastError() }
        ));
    }
    Ok(output)
}

fn enumerate_usn_records(
    handle: HANDLE,
    high_usn: i64,
    token: &NativeTaskCancellationToken,
) -> Result<HashMap<String, UsnRecord>, String> {
    let mut input = MFT_ENUM_DATA_V0 {
        StartFileReferenceNumber: 0,
        LowUsn: 0,
        HighUsn: high_usn,
    };
    let mut output = vec![0u8; USN_ENUM_BUFFER_BYTES];
    let mut records = HashMap::<String, UsnRecord>::new();

    loop {
        token.throw_if_cancelled()?;
        let mut returned = 0u32;
        let ok = unsafe {
            DeviceIoControl(
                handle,
                FSCTL_ENUM_USN_DATA,
                &mut input as *mut _ as *mut _,
                size_of::<MFT_ENUM_DATA_V0>() as u32,
                output.as_mut_ptr() as *mut _,
                output.len() as u32,
                &mut returned,
                std::ptr::null_mut(),
            )
        };
        if ok == 0 {
            let error = unsafe { GetLastError() };
            const ERROR_HANDLE_EOF: u32 = 38;
            if error == ERROR_HANDLE_EOF {
                break;
            }
            return Err(format!(
                "FSCTL_ENUM_USN_DATA failed while reading MFT records: Win32 error {error}"
            ));
        }
        if returned <= 8 {
            break;
        }
        let returned_len = returned as usize;
        input.StartFileReferenceNumber = read_u64(&output, 0)?;
        let mut offset = 8usize;
        while offset + 8 <= returned_len {
            let record_len = read_u32(&output, offset)? as usize;
            if record_len == 0 || offset + record_len > returned_len {
                break;
            }
            if let Some(record) = parse_usn_record(&output[offset..offset + record_len])? {
                records.insert(record.file_ref.clone(), record);
            }
            offset += record_len;
        }
    }

    Ok(records)
}

fn parse_usn_record(bytes: &[u8]) -> Result<Option<UsnRecord>, String> {
    if bytes.len() < 8 {
        return Ok(None);
    }
    let major = read_u16(bytes, 4)?;
    match major {
        2 => parse_usn_record_v2(bytes).map(Some),
        3 => parse_usn_record_v3(bytes).map(Some),
        _ => Ok(None),
    }
}

fn parse_usn_record_v2(bytes: &[u8]) -> Result<UsnRecord, String> {
    if bytes.len() < 60 {
        return Err("Short USN_RECORD_V2 payload".to_string());
    }
    let file_ref = read_u64(bytes, 8)?.to_string();
    let parent_file_ref = read_u64(bytes, 16)?.to_string();
    let timestamp_ms = filetime_to_unix_ms(read_i64(bytes, 32)?);
    let file_attributes = read_u32(bytes, 52)?;
    let name_len = read_u16(bytes, 56)? as usize;
    let name_offset = read_u16(bytes, 58)? as usize;
    let name = read_utf16_name(bytes, name_offset, name_len)?;
    Ok(UsnRecord {
        file_ref,
        parent_file_ref,
        name,
        file_attributes,
        timestamp_ms,
    })
}

fn parse_usn_record_v3(bytes: &[u8]) -> Result<UsnRecord, String> {
    if bytes.len() < 76 {
        return Err("Short USN_RECORD_V3 payload".to_string());
    }
    let file_ref = hex_128(&bytes[8..24]);
    let parent_file_ref = hex_128(&bytes[24..40]);
    let timestamp_ms = filetime_to_unix_ms(read_i64(bytes, 48)?);
    let file_attributes = read_u32(bytes, 68)?;
    let name_len = read_u16(bytes, 72)? as usize;
    let name_offset = read_u16(bytes, 74)? as usize;
    let name = read_utf16_name(bytes, name_offset, name_len)?;
    Ok(UsnRecord {
        file_ref,
        parent_file_ref,
        name,
        file_attributes,
        timestamp_ms,
    })
}

fn reconstruct_index_records(
    requested_root_path: &Path,
    requested_root_key: &ExplorerPathKey,
    volume_root: &Path,
    usn_records: HashMap<String, UsnRecord>,
    token: &NativeTaskCancellationToken,
) -> Result<Vec<IndexedPathRecord>, String> {
    let mut memo = HashMap::<String, Option<PathBuf>>::new();
    let mut output = Vec::<IndexedPathRecord>::new();
    for file_ref in usn_records.keys() {
        token.throw_if_cancelled()?;
        let Some(path) = resolve_record_path(file_ref, volume_root, &usn_records, &mut memo) else {
            continue;
        };
        let path_key = ExplorerPathKey::from_path(&path);
        if path_key.as_str() == requested_root_key.as_str()
            || path_key.is_same_or_descendant_of(requested_root_key)
        {
            if path_key.as_str() == requested_root_key.as_str() {
                continue;
            }
            if let Some(record) = usn_records.get(file_ref) {
                output.push(usn_record_to_indexed_record(&path, record));
            }
        }
    }
    output.sort_by(|left, right| left.path_key.cmp(&right.path_key));
    if output.is_empty() && requested_root_path.exists() {
        return Err(format!(
            "USN enumeration produced no entries under {}",
            requested_root_path.display()
        ));
    }
    Ok(output)
}

fn resolve_record_path(
    file_ref: &str,
    volume_root: &Path,
    records: &HashMap<String, UsnRecord>,
    memo: &mut HashMap<String, Option<PathBuf>>,
) -> Option<PathBuf> {
    if let Some(cached) = memo.get(file_ref) {
        return cached.clone();
    }
    let record = records.get(file_ref)?;
    let resolved =
        if record.name == "." || record.name.is_empty() || record.parent_file_ref == *file_ref {
            Some(volume_root.to_path_buf())
        } else if let Some(parent_path) =
            resolve_record_path(&record.parent_file_ref, volume_root, records, memo)
        {
            Some(parent_path.join(&record.name))
        } else {
            None
        };
    memo.insert(file_ref.to_string(), resolved.clone());
    resolved
}

fn usn_record_to_indexed_record(path: &Path, record: &UsnRecord) -> IndexedPathRecord {
    let parent_path = path.parent().unwrap_or(path).to_path_buf();
    let is_dir = record.file_attributes & FILE_ATTRIBUTE_DIRECTORY != 0;
    let is_symlink = record.file_attributes & FILE_ATTRIBUTE_REPARSE_POINT != 0;
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(&record.name)
        .to_string();
    IndexedPathRecord {
        path: path.to_string_lossy().to_string(),
        path_key: ExplorerPathKey::from_path(path).into_string(),
        parent_path: parent_path.to_string_lossy().to_string(),
        parent_key: ExplorerPathKey::from_path(&parent_path).into_string(),
        name: name.clone(),
        name_lower: name.to_ascii_lowercase(),
        extension: if is_dir {
            String::new()
        } else {
            path.extension()
                .and_then(|value| value.to_str())
                .unwrap_or_default()
                .to_ascii_lowercase()
        },
        size: 0,
        modified_ms: record.timestamp_ms,
        is_dir,
        is_hidden: record.file_attributes & FILE_ATTRIBUTE_HIDDEN != 0 || name.starts_with('.'),
        is_symlink,
        file_ref: Some(record.file_ref.clone()),
        parent_file_ref: Some(record.parent_file_ref.clone()),
    }
}

fn wide_null(value: &str) -> Vec<u16> {
    OsStr::new(value)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

fn read_utf16_name(bytes: &[u8], offset: usize, byte_len: usize) -> Result<String, String> {
    if offset + byte_len > bytes.len() || byte_len % 2 != 0 {
        return Err("Invalid USN filename range".to_string());
    }
    let units = bytes[offset..offset + byte_len]
        .chunks_exact(2)
        .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
        .collect::<Vec<_>>();
    String::from_utf16(&units).map_err(|error| format!("Invalid UTF-16 USN filename: {error}"))
}

fn read_u16(bytes: &[u8], offset: usize) -> Result<u16, String> {
    if offset + 2 > bytes.len() {
        return Err("USN read_u16 out of bounds".to_string());
    }
    Ok(u16::from_le_bytes([bytes[offset], bytes[offset + 1]]))
}

fn read_u32(bytes: &[u8], offset: usize) -> Result<u32, String> {
    if offset + 4 > bytes.len() {
        return Err("USN read_u32 out of bounds".to_string());
    }
    Ok(u32::from_le_bytes([
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3],
    ]))
}

fn read_u64(bytes: &[u8], offset: usize) -> Result<u64, String> {
    if offset + 8 > bytes.len() {
        return Err("USN read_u64 out of bounds".to_string());
    }
    Ok(u64::from_le_bytes([
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3],
        bytes[offset + 4],
        bytes[offset + 5],
        bytes[offset + 6],
        bytes[offset + 7],
    ]))
}

fn read_i64(bytes: &[u8], offset: usize) -> Result<i64, String> {
    Ok(read_u64(bytes, offset)? as i64)
}

fn filetime_to_unix_ms(filetime: i64) -> u64 {
    if filetime <= WINDOWS_UNIX_EPOCH_TICKS {
        return 0;
    }
    ((filetime - WINDOWS_UNIX_EPOCH_TICKS) / WINDOWS_TICK_MS_DIVISOR) as u64
}

fn hex_128(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}
