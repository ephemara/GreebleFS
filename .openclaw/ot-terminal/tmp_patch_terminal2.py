from pathlib import Path
p = Path(r'F:\apps-2d\overlayterm\src-tauri\src\terminal.rs')
text = p.read_text(encoding='utf-8')
text = text.replace("""    pub fn write_many(&self, writes: &[TerminalWriteRequest]) -> Result<(), String> {
        let mut terminals = self.terminals.lock().unwrap();
        let mut touched_terminal_ids = std::collections::HashSet::new();

        for request in writes {
""", """    pub fn write_many(&self, writes: &[TerminalWriteRequest]) -> Result<(), String> {
        let mut terminals = self.terminals.lock().unwrap();

        for request in writes {
""")
text = text.replace("""            instance
                .writer
                .write_all(request.data.as_bytes())
                .map_err(|e| format!(\"Write failed for {}: {}\", request.id, e))?;

            touched_terminal_ids.insert(request.id.clone());
        }

        Ok(())
""", """            instance
                .writer
                .write_all(request.data.as_bytes())
                .map_err(|e| format!(\"Write failed for {}: {}\", request.id, e))?;
        }

        Ok(())
""")
p.write_text(text, encoding='utf-8')
print('patched2', p)
