# Kain Rust Reflection

This lane is for Rust/Tauron host capability reflection.

Durable direction:

1. Rust/Tauron describes commands, events, permissions, host objects, and runtime capabilities.
2. Kain consumes that shape.
3. Kain emits wrappers or routes calls through trusted host APIs.

Do not duplicate host API schemas manually once reflection is available.
