fn main() {
    // Rust tooling may load every workspace member on Linux even when the Swift bridge is only
    // relevant for macOS builds. Skip the Swift packaging step unless the target is macOS.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("macos") {
        return;
    }

    swift_rs::SwiftLinker::new("11.0")
        .with_ios("11.0")
        .with_package("FileOpening", "./src-swift/")
        .link();
}
