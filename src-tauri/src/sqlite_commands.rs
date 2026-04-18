use rusqlite::{types::ValueRef, Connection, OpenFlags};
use serde::Serialize;
use specta::Type;

#[derive(Serialize, Type)]
pub struct SqliteTableInfo {
    pub name: String,
    pub row_count: i64,
}

#[derive(Serialize, Type)]
pub struct SqliteDbInfo {
    pub path: String,
    pub tables: Vec<SqliteTableInfo>,
}

#[derive(Serialize, Type)]
pub struct SqliteTablePreview {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<String>>,
}

#[tauri::command]
#[specta::specta]
pub async fn sqlite_get_info(path: String) -> Result<SqliteDbInfo, String> {
    tokio::task::spawn_blocking(move || {
        let conn = Connection::open_with_flags(&path, OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|e| format!("Failed to open SQLite database in read-only mode: {}", e))?;

        // Query the list of all user tables
        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            .map_err(|e| e.to_string())?;

        let table_names: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(Result::ok)
            .collect();

        let mut tables = Vec::new();

        for name in table_names {
            // Safely quote the explicit table name to prevent SQL syntax injection
            let escaped_name = name.replace("\"", "\"\"");
            let count_query = format!("SELECT COUNT(*) FROM \"{}\"", escaped_name);
            let count: i64 = conn.query_row(&count_query, [], |row| row.get(0)).unwrap_or(0);

            tables.push(SqliteTableInfo {
                name,
                row_count: count,
            });
        }

        // Sort by name case-insensitive
        tables.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

        Ok(SqliteDbInfo { path, tables })
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
#[specta::specta]
pub async fn sqlite_query_table(
    path: String,
    table_name: String,
    limit: u32,
    offset: u32,
) -> Result<SqliteTablePreview, String> {
    tokio::task::spawn_blocking(move || {
        let conn = Connection::open_with_flags(&path, OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|e| format!("Failed to open SQLite database in read-only mode: {}", e))?;

        let escaped_name = table_name.replace("\"", "\"\"");
        let query = format!("SELECT * FROM \"{}\" LIMIT ? OFFSET ?", escaped_name);

        let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

        let column_names: Vec<String> = stmt.column_names().into_iter().map(String::from).collect();
        let column_count = column_names.len();

        let mut rows_data = Vec::new();

        // Convert every cell precisely to a string
        let mut rows = stmt
            .query(rusqlite::params![limit, offset])
            .map_err(|e| e.to_string())?;

        while let Ok(Some(row)) = rows.next() {
            let mut row_data = Vec::with_capacity(column_count);
            for i in 0..column_count {
                let cell_str = match row.get_ref(i) {
                    Ok(ValueRef::Null) => "NULL".to_string(),
                    Ok(ValueRef::Integer(i)) => i.to_string(),
                    Ok(ValueRef::Real(r)) => r.to_string(),
                    Ok(ValueRef::Text(t)) => String::from_utf8_lossy(t).to_string(),
                    Ok(ValueRef::Blob(b)) => format!("<Blob: {} bytes>", b.len()),
                    _ => "ERROR".to_string(),
                };
                row_data.push(cell_str);
            }
            rows_data.push(row_data);
        }

        Ok(SqliteTablePreview {
            columns: column_names,
            rows: rows_data,
        })
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}
