const DIRECTORY_LISTING_MAGIC: &[u8; 4] = b"GFLS";
const DIRECTORY_LISTING_VERSION: u16 = 1;
const DIRECTORY_LISTING_HEADER_BYTES: u16 = 32;
const DIRECTORY_LISTING_RECORD_STRIDE: u32 = 64;
const DIRECTORY_LISTING_RECORD_TABLE_OFFSET: u32 = DIRECTORY_LISTING_HEADER_BYTES as u32;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DirectoryListingSnapshotIdentityKind {
    Native,
    Operation,
    Derived,
}

impl DirectoryListingSnapshotIdentityKind {
    fn wire_value(self) -> u16 {
        match self {
            Self::Native => 0,
            Self::Operation => 1,
            Self::Derived => 2,
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct DirectoryListingSnapshotEntry<'a> {
    pub name: &'a str,
    pub path: &'a str,
    pub extension: &'a str,
    pub entity_id: &'a str,
    pub content_revision: &'a str,
    pub size: u64,
    pub modified: u64,
    pub is_dir: bool,
    pub is_hidden: bool,
    pub is_symlink: bool,
    pub identity_kind: DirectoryListingSnapshotIdentityKind,
}

pub fn encode_directory_listing_snapshot(
    entries: &[DirectoryListingSnapshotEntry<'_>],
) -> Result<Vec<u8>, String> {
    let entry_count = u32::try_from(entries.len())
        .map_err(|_| "directory listing snapshot entry count exceeds u32".to_string())?;
    let record_table_bytes = entry_count
        .checked_mul(DIRECTORY_LISTING_RECORD_STRIDE)
        .ok_or_else(|| "directory listing snapshot record table is too large".to_string())?;
    let string_table_offset = DIRECTORY_LISTING_RECORD_TABLE_OFFSET
        .checked_add(record_table_bytes)
        .ok_or_else(|| "directory listing snapshot string table offset overflowed".to_string())?;

    let mut string_table = Vec::<u8>::new();
    let mut records = Vec::<DirectoryListingSnapshotRecord>::with_capacity(entries.len());
    for entry in entries {
        records.push(DirectoryListingSnapshotRecord {
            name: push_snapshot_string(&mut string_table, entry.name)?,
            path: push_snapshot_string(&mut string_table, entry.path)?,
            extension: push_snapshot_string(&mut string_table, entry.extension)?,
            entity_id: push_snapshot_string(&mut string_table, entry.entity_id)?,
            content_revision: push_snapshot_string(&mut string_table, entry.content_revision)?,
            size: entry.size,
            modified: entry.modified,
            flags: snapshot_entry_flags(entry),
            identity_kind: entry.identity_kind.wire_value(),
        });
    }

    let string_table_bytes = u32::try_from(string_table.len())
        .map_err(|_| "directory listing snapshot string table exceeds u32".to_string())?;
    let capacity = string_table_offset as usize + string_table.len();
    let mut bytes = Vec::with_capacity(capacity);
    bytes.extend_from_slice(DIRECTORY_LISTING_MAGIC);
    bytes.extend_from_slice(&DIRECTORY_LISTING_VERSION.to_le_bytes());
    bytes.extend_from_slice(&DIRECTORY_LISTING_HEADER_BYTES.to_le_bytes());
    bytes.extend_from_slice(&entry_count.to_le_bytes());
    bytes.extend_from_slice(&DIRECTORY_LISTING_RECORD_STRIDE.to_le_bytes());
    bytes.extend_from_slice(&DIRECTORY_LISTING_RECORD_TABLE_OFFSET.to_le_bytes());
    bytes.extend_from_slice(&string_table_offset.to_le_bytes());
    bytes.extend_from_slice(&string_table_bytes.to_le_bytes());
    bytes.extend_from_slice(&0_u32.to_le_bytes());

    for record in records {
        write_snapshot_string_ref(&mut bytes, record.name);
        write_snapshot_string_ref(&mut bytes, record.path);
        write_snapshot_string_ref(&mut bytes, record.extension);
        write_snapshot_string_ref(&mut bytes, record.entity_id);
        write_snapshot_string_ref(&mut bytes, record.content_revision);
        bytes.extend_from_slice(&record.size.to_le_bytes());
        bytes.extend_from_slice(&record.modified.to_le_bytes());
        bytes.extend_from_slice(&record.flags.to_le_bytes());
        bytes.extend_from_slice(&record.identity_kind.to_le_bytes());
        bytes.extend_from_slice(&0_u16.to_le_bytes());
    }
    bytes.extend_from_slice(&string_table);
    Ok(bytes)
}

#[derive(Debug, Clone, Copy)]
struct SnapshotStringRef {
    offset: u32,
    byte_length: u32,
}

#[derive(Debug, Clone, Copy)]
struct DirectoryListingSnapshotRecord {
    name: SnapshotStringRef,
    path: SnapshotStringRef,
    extension: SnapshotStringRef,
    entity_id: SnapshotStringRef,
    content_revision: SnapshotStringRef,
    size: u64,
    modified: u64,
    flags: u32,
    identity_kind: u16,
}

fn push_snapshot_string(table: &mut Vec<u8>, value: &str) -> Result<SnapshotStringRef, String> {
    let offset = u32::try_from(table.len())
        .map_err(|_| "directory listing snapshot string offset exceeds u32".to_string())?;
    let byte_length = u32::try_from(value.len())
        .map_err(|_| "directory listing snapshot string length exceeds u32".to_string())?;
    table.extend_from_slice(value.as_bytes());
    Ok(SnapshotStringRef {
        offset,
        byte_length,
    })
}

fn write_snapshot_string_ref(bytes: &mut Vec<u8>, value: SnapshotStringRef) {
    bytes.extend_from_slice(&value.offset.to_le_bytes());
    bytes.extend_from_slice(&value.byte_length.to_le_bytes());
}

fn snapshot_entry_flags(entry: &DirectoryListingSnapshotEntry<'_>) -> u32 {
    u32::from(entry.is_dir) | (u32::from(entry.is_hidden) << 1) | (u32::from(entry.is_symlink) << 2)
}

#[cfg(test)]
mod tests {
    use super::{
        encode_directory_listing_snapshot, DirectoryListingSnapshotEntry,
        DirectoryListingSnapshotIdentityKind,
    };

    fn sample_entry<'a>(
        name: &'a str,
        path: &'a str,
        identity_kind: DirectoryListingSnapshotIdentityKind,
    ) -> DirectoryListingSnapshotEntry<'a> {
        DirectoryListingSnapshotEntry {
            name,
            path,
            extension: "txt",
            entity_id: "entity-1",
            content_revision: "rev-1",
            size: 42,
            modified: 1_700_000_000_000,
            is_dir: false,
            is_hidden: true,
            is_symlink: true,
            identity_kind,
        }
    }

    fn read_u16(bytes: &[u8], offset: usize) -> u16 {
        u16::from_le_bytes(bytes[offset..offset + 2].try_into().expect("u16"))
    }

    fn read_u32(bytes: &[u8], offset: usize) -> u32 {
        u32::from_le_bytes(bytes[offset..offset + 4].try_into().expect("u32"))
    }

    fn read_u64(bytes: &[u8], offset: usize) -> u64 {
        u64::from_le_bytes(bytes[offset..offset + 8].try_into().expect("u64"))
    }

    #[test]
    fn encodes_directory_listing_snapshot_header_and_empty_directory() {
        let bytes = encode_directory_listing_snapshot(&[]).expect("snapshot");
        assert_eq!(&bytes[0..4], b"GFLS");
        assert_eq!(read_u16(&bytes, 4), 1);
        assert_eq!(read_u16(&bytes, 6), 32);
        assert_eq!(read_u32(&bytes, 8), 0);
        assert_eq!(read_u32(&bytes, 12), 64);
        assert_eq!(read_u32(&bytes, 16), 32);
        assert_eq!(read_u32(&bytes, 20), 32);
        assert_eq!(read_u32(&bytes, 24), 0);
        assert_eq!(bytes.len(), 32);
    }

    #[test]
    fn encodes_record_flags_identity_kind_and_string_table() {
        let entry = sample_entry(
            "unicodé.txt",
            "D:/demo/unicodé.txt",
            DirectoryListingSnapshotIdentityKind::Operation,
        );
        let bytes = encode_directory_listing_snapshot(&[entry]).expect("snapshot");
        assert_eq!(read_u32(&bytes, 8), 1);
        assert_eq!(read_u32(&bytes, 20), 96);

        let record_offset = 32;
        assert_eq!(read_u64(&bytes, record_offset + 40), 42);
        assert_eq!(read_u64(&bytes, record_offset + 48), 1_700_000_000_000);
        assert_eq!(read_u32(&bytes, record_offset + 56), 0b110);
        assert_eq!(read_u16(&bytes, record_offset + 60), 1);

        let string_table_offset = read_u32(&bytes, 20) as usize;
        let name_offset = read_u32(&bytes, record_offset) as usize;
        let name_len = read_u32(&bytes, record_offset + 4) as usize;
        let name_bytes =
            &bytes[string_table_offset + name_offset..string_table_offset + name_offset + name_len];
        assert_eq!(
            std::str::from_utf8(name_bytes).expect("utf8"),
            "unicodé.txt"
        );
    }

    #[test]
    fn encodes_identity_kind_values() {
        let entries = [
            sample_entry(
                "native",
                "D:/native",
                DirectoryListingSnapshotIdentityKind::Native,
            ),
            sample_entry(
                "derived",
                "D:/derived",
                DirectoryListingSnapshotIdentityKind::Derived,
            ),
        ];
        let bytes = encode_directory_listing_snapshot(&entries).expect("snapshot");
        assert_eq!(read_u16(&bytes, 32 + 60), 0);
        assert_eq!(read_u16(&bytes, 32 + 64 + 60), 2);
    }
}
