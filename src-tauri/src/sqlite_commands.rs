use rusqlite::{
    params_from_iter,
    types::{Value, ValueRef},
    Connection, OpenFlags,
};
use serde::{Deserialize, Serialize};
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

#[derive(Deserialize, Serialize, Type, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SqliteSortDirection {
    Asc,
    Desc,
}

#[derive(Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SqliteTableQueryRequest {
    pub path: String,
    pub table_name: String,
    pub limit: u32,
    pub offset: u32,
    pub search_text: Option<String>,
    pub sort_column: Option<String>,
    pub sort_direction: Option<SqliteSortDirection>,
}

#[derive(Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SqliteTableQueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<String>>,
    pub total_rows: i64,
    pub filtered_rows: i64,
    pub applied_offset: u32,
    pub next_offset: Option<u32>,
}

#[derive(Clone)]
struct SqliteColumnMeta {
    name: String,
    primary_key_ordinal: i64,
}

#[tauri::command]
#[specta::specta]
pub async fn sqlite_get_info(path: String) -> Result<SqliteDbInfo, String> {
    run_sqlite_job(move || {
        let conn = open_read_only_connection(&path)?;
        let table_names = load_user_table_names(&conn)?;

        let mut tables = Vec::with_capacity(table_names.len());

        for name in table_names {
            let count_query = format!("SELECT COUNT(*) FROM \"{}\"", escape_identifier(&name),);
            let count: i64 = conn
                .query_row(&count_query, [], |row| row.get(0))
                .unwrap_or(0);

            tables.push(SqliteTableInfo {
                name,
                row_count: count,
            });
        }

        tables.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));

        Ok(SqliteDbInfo { path, tables })
    })
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn sqlite_query_table(
    path: String,
    table_name: String,
    limit: u32,
    offset: u32,
) -> Result<SqliteTablePreview, String> {
    run_sqlite_job(move || {
        let result = query_table_window_sync(SqliteTableQueryRequest {
            path,
            table_name,
            limit,
            offset,
            search_text: None,
            sort_column: None,
            sort_direction: None,
        })?;

        Ok(SqliteTablePreview {
            columns: result.columns,
            rows: result.rows,
        })
    })
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn sqlite_query_table_window(
    request: SqliteTableQueryRequest,
) -> Result<SqliteTableQueryResult, String> {
    run_sqlite_job(move || query_table_window_sync(request)).await
}

async fn run_sqlite_job<T, F>(job: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tokio::task::spawn_blocking(job)
        .await
        .map_err(|error| format!("Task failed: {error}"))?
}

fn query_table_window_sync(
    request: SqliteTableQueryRequest,
) -> Result<SqliteTableQueryResult, String> {
    let table_name = request.table_name.trim();
    if table_name.is_empty() {
        return Err("Missing SQLite table name.".to_string());
    }

    let conn = open_read_only_connection(&request.path)?;
    let table_name_escaped = escape_identifier(table_name);
    let columns = load_table_columns(&conn, table_name)?;
    if columns.is_empty() {
        return Err(format!("Table \"{table_name}\" has no visible columns."));
    }

    let column_names = columns
        .iter()
        .map(|column| column.name.clone())
        .collect::<Vec<_>>();
    let (where_clause, search_params) =
        build_search_clause(&columns, request.search_text.as_deref());
    let order_clause = build_order_clause(
        &columns,
        request.sort_column.as_deref(),
        request.sort_direction,
    )?;

    let total_row_query = format!("SELECT COUNT(*) FROM \"{table_name_escaped}\"");
    let total_rows: i64 = conn
        .query_row(&total_row_query, [], |row| row.get(0))
        .map_err(|error| format!("Failed to count SQLite rows: {error}"))?;

    let filtered_rows = if search_params.is_empty() {
        total_rows
    } else {
        let filtered_count_query =
            format!("SELECT COUNT(*) FROM \"{table_name_escaped}\" {where_clause}");
        conn.query_row(
            &filtered_count_query,
            params_from_iter(search_params.iter()),
            |row| row.get(0),
        )
        .map_err(|error| format!("Failed to count filtered SQLite rows: {error}"))?
    };

    let data_query = format!(
        "SELECT * FROM \"{table_name_escaped}\" {where_clause} {order_clause} LIMIT ? OFFSET ?"
    );
    let mut statement = conn
        .prepare(&data_query)
        .map_err(|error| format!("Failed to prepare SQLite query: {error}"))?;

    let mut query_params = search_params.clone();
    query_params.push(Value::from(i64::from(request.limit)));
    query_params.push(Value::from(i64::from(request.offset)));

    let mut rows = statement
        .query(params_from_iter(query_params.iter()))
        .map_err(|error| format!("Failed to execute SQLite query: {error}"))?;

    let mut rows_data = Vec::new();

    while let Ok(Some(row)) = rows.next() {
        let mut row_data = Vec::with_capacity(column_names.len());
        for index in 0..column_names.len() {
            row_data.push(format_sqlite_cell(row.get_ref(index)));
        }
        rows_data.push(row_data);
    }

    let consumed_rows = u32::try_from(rows_data.len())
        .map_err(|_| "SQLite row batch exceeded u32 range.".to_string())?;
    let next_offset = if consumed_rows > 0
        && i64::from(request.offset) + i64::from(consumed_rows) < filtered_rows
    {
        request.offset.checked_add(consumed_rows)
    } else {
        None
    };

    Ok(SqliteTableQueryResult {
        columns: column_names,
        rows: rows_data,
        total_rows,
        filtered_rows,
        applied_offset: request.offset,
        next_offset,
    })
}

fn open_read_only_connection(path: &str) -> Result<Connection, String> {
    Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|error| format!("Failed to open SQLite database in read-only mode: {error}"))
}

fn load_user_table_names(conn: &Connection) -> Result<Vec<String>, String> {
    let mut statement = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .map_err(|error| format!("Failed to load SQLite tables: {error}"))?;

    let rows = statement
        .query_map([], |row| row.get(0))
        .map_err(|error| format!("Failed to iterate SQLite tables: {error}"))?;

    rows.collect::<Result<Vec<String>, _>>()
        .map_err(|error| format!("Failed to decode SQLite table names: {error}"))
}

fn load_table_columns(
    conn: &Connection,
    table_name: &str,
) -> Result<Vec<SqliteColumnMeta>, String> {
    let pragma_query = format!("PRAGMA table_info(\"{}\")", escape_identifier(table_name),);
    let mut statement = conn
        .prepare(&pragma_query)
        .map_err(|error| format!("Failed to inspect SQLite schema: {error}"))?;

    let rows = statement
        .query_map([], |row| {
            Ok(SqliteColumnMeta {
                name: row.get(1)?,
                primary_key_ordinal: row.get(5)?,
            })
        })
        .map_err(|error| format!("Failed to read SQLite schema: {error}"))?;

    rows.collect::<Result<Vec<SqliteColumnMeta>, _>>()
        .map_err(|error| format!("Failed to decode SQLite schema: {error}"))
}

fn build_search_clause(
    columns: &[SqliteColumnMeta],
    search_text: Option<&str>,
) -> (String, Vec<Value>) {
    let normalized_search = search_text.map(str::trim).filter(|value| !value.is_empty());
    let Some(search_text) = normalized_search else {
        return (String::new(), Vec::new());
    };

    let escaped_pattern = format!("%{}%", escape_like_pattern(search_text));
    let clauses = columns
        .iter()
        .map(|column| {
            format!(
                "CAST(\"{}\" AS TEXT) LIKE ? ESCAPE '\\' COLLATE NOCASE",
                escape_identifier(&column.name),
            )
        })
        .collect::<Vec<_>>();
    let params = (0..columns.len())
        .map(|_| Value::from(escaped_pattern.clone()))
        .collect::<Vec<_>>();

    (format!("WHERE {}", clauses.join(" OR ")), params)
}

fn build_order_clause(
    columns: &[SqliteColumnMeta],
    sort_column: Option<&str>,
    sort_direction: Option<SqliteSortDirection>,
) -> Result<String, String> {
    if let Some(sort_column) = sort_column.map(str::trim).filter(|value| !value.is_empty()) {
        let matching_column = columns
            .iter()
            .find(|column| column.name.eq_ignore_ascii_case(sort_column))
            .ok_or_else(|| format!("Unknown SQLite sort column: {sort_column}"))?;
        let direction = match sort_direction.unwrap_or(SqliteSortDirection::Asc) {
            SqliteSortDirection::Asc => "ASC",
            SqliteSortDirection::Desc => "DESC",
        };

        return Ok(format!(
            "ORDER BY \"{}\" {direction}",
            escape_identifier(&matching_column.name),
        ));
    }

    let mut primary_key_columns = columns
        .iter()
        .filter(|column| column.primary_key_ordinal > 0)
        .collect::<Vec<_>>();
    primary_key_columns.sort_by_key(|column| column.primary_key_ordinal);

    if primary_key_columns.is_empty() {
        return Ok(String::new());
    }

    let order_columns = primary_key_columns
        .iter()
        .map(|column| format!("\"{}\" ASC", escape_identifier(&column.name)))
        .collect::<Vec<_>>()
        .join(", ");
    Ok(format!("ORDER BY {order_columns}"))
}

fn escape_identifier(identifier: &str) -> String {
    identifier.replace('"', "\"\"")
}

fn escape_like_pattern(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());
    for character in value.chars() {
        match character {
            '%' | '_' | '\\' => {
                escaped.push('\\');
                escaped.push(character);
            }
            _ => escaped.push(character),
        }
    }
    escaped
}

fn format_sqlite_cell(cell: rusqlite::Result<ValueRef<'_>>) -> String {
    match cell {
        Ok(ValueRef::Null) => "NULL".to_string(),
        Ok(ValueRef::Integer(value)) => value.to_string(),
        Ok(ValueRef::Real(value)) => value.to_string(),
        Ok(ValueRef::Text(value)) => String::from_utf8_lossy(value).to_string(),
        Ok(ValueRef::Blob(value)) => format!("<Blob: {} bytes>", value.len()),
        Err(_) => "ERROR".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        build_order_clause, build_search_clause, escape_like_pattern, SqliteColumnMeta,
        SqliteSortDirection,
    };

    #[test]
    fn search_clause_escapes_like_metacharacters() {
        let columns = vec![SqliteColumnMeta {
            name: "title".to_string(),
            primary_key_ordinal: 0,
        }];

        let (where_clause, params) = build_search_clause(&columns, Some("100%_match\\"));

        assert!(where_clause.contains("LIKE ? ESCAPE '\\'"));
        assert_eq!(params.len(), 1);
        assert_eq!(
            params[0],
            rusqlite::types::Value::from("%100\\%\\_match\\\\%".to_string()),
        );
        assert_eq!(escape_like_pattern("50%_done"), "50\\%\\_done");
    }

    #[test]
    fn order_clause_prefers_requested_column_and_falls_back_to_primary_key() {
        let columns = vec![
            SqliteColumnMeta {
                name: "id".to_string(),
                primary_key_ordinal: 1,
            },
            SqliteColumnMeta {
                name: "name".to_string(),
                primary_key_ordinal: 0,
            },
        ];

        let explicit_order =
            build_order_clause(&columns, Some("name"), Some(SqliteSortDirection::Desc))
                .expect("explicit sqlite order should build");
        let fallback_order =
            build_order_clause(&columns, None, None).expect("fallback sqlite order should build");

        assert_eq!(explicit_order, "ORDER BY \"name\" DESC");
        assert_eq!(fallback_order, "ORDER BY \"id\" ASC");
    }
}
