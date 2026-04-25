use std::env;
use std::fs;

fn print_env(label: &str, key: &str) {
    let value = env::var(key).unwrap_or_else(|_| "<missing>".to_string());
    println!("{label}: {value}");
}

fn main() {
    println!("GreebleFS cargo smoke test");
    print_env("pack", "GREEBLEFS_ACTION_PACK_ID");
    print_env("action", "GREEBLEFS_ACTION_ID");
    print_env("current location", "GREEBLEFS_CURRENT_LOCATION");
    print_env("primary path", "GREEBLEFS_PRIMARY_PATH");
    print_env("selected count", "GREEBLEFS_SELECTED_COUNT");

    let context_file = env::var("GREEBLEFS_ACTION_CONTEXT_FILE").unwrap_or_default();
    println!("context file: {}", if context_file.is_empty() { "<missing>" } else { &context_file });

    if context_file.is_empty() {
        println!();
        println!("No context file was provided.");
        return;
    }

    println!();
    println!("Context payload preview:");

    match fs::read_to_string(&context_file) {
        Ok(payload) => {
            let preview: String = payload.chars().take(900).collect();
            println!("{preview}");
            if payload.chars().count() > 900 {
                println!("... <truncated>");
            }
        }
        Err(error) => {
            println!("Failed to read context payload: {error}");
        }
    }
}
