//! File hashing utilities for cache validation

use crate::error::Result;
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;

/// Compute BLAKE3 hash of a file
pub fn hash_file(path: &Path) -> Result<String> {
    let file = File::open(path)?;
    let mut reader = BufReader::new(file);
    let mut hasher = blake3::Hasher::new();

    let mut buffer = [0u8; 8192];
    loop {
        let count = reader.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }

    Ok(hasher.finalize().to_hex().to_string())
}

/// Compute BLAKE3 hash of byte data
pub fn hash_bytes(data: &[u8]) -> String {
    blake3::hash(data).to_hex().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_hash_file() {
        let mut temp_file = NamedTempFile::new().unwrap();
        temp_file.write_all(b"test data").unwrap();
        temp_file.flush().unwrap();

        let hash = hash_file(temp_file.path()).unwrap();
        assert_eq!(hash.len(), 64); // BLAKE3 produces 32-byte hash (64 hex chars)
    }

    #[test]
    fn test_hash_bytes() {
        let hash = hash_bytes(b"test data");
        assert_eq!(hash.len(), 64);

        // Same data should produce same hash
        let hash2 = hash_bytes(b"test data");
        assert_eq!(hash, hash2);

        // Different data should produce different hash
        let hash3 = hash_bytes(b"different data");
        assert_ne!(hash, hash3);
    }
}
