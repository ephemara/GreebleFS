fn main() {
    let output = greeble_lib::specta_bindings::export_bindings()
        .expect("failed to export Tauri Specta bindings");
    println!("Exported Specta bindings to {}", output.display());
}
