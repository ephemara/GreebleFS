from pathlib import Path
p = Path(r'F:\apps-2d\overlayterm\src-tauri\src\terminal.rs')
text = p.read_text(encoding='utf-8')
text = text.replace("""        instance
            .writer
            .write_all(data)
            .map_err(|e| format!(\"Write failed: {}\", e))?;
        instance
            .writer
            .flush()
            .map_err(|e| format!(\"Flush failed: {}\", e))?;

        Ok(())
""", """        instance
            .writer
            .write_all(data)
            .map_err(|e| format!(\"Write failed: {}\", e))?;

        Ok(())
""")
text = text.replace("""        let mut terminals = self.terminals.lock().unwrap();
        let mut touched_terminal_ids: Vec<&str> = Vec::new();
""", """        let mut terminals = self.terminals.lock().unwrap();
        let mut touched_terminal_ids = std::collections::HashSet::new();
""")
text = text.replace("""            if !touched_terminal_ids
                .iter()
                .any(|id| *id == request.id.as_str())
            {
                touched_terminal_ids.push(request.id.as_str());
            }
        }

        for terminal_id in touched_terminal_ids {
            let instance = terminals
                .get_mut(terminal_id)
                .ok_or_else(|| format!(\"Terminal {} not found\", terminal_id))?;
            instance
                .writer
                .flush()
                .map_err(|e| format!(\"Flush failed for {}: {}\", terminal_id, e))?;
        }

        Ok(())
""", """            touched_terminal_ids.insert(request.id.clone());
        }

        Ok(())
""")
p.write_text(text, encoding='utf-8')
print('patched', p)
