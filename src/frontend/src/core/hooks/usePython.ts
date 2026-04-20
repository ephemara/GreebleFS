
import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function usePython() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const callScript = useCallback(async (scriptName: string, functionName: string, args: any = {}) => {
        setLoading(true);
        setError(null);
        try {
            // "python_run_script" refers to the Rust command
            const result = await invoke('python_run_script', {
                scriptName: scriptName,
                function: functionName,
                kwargs: args
            });
            return result;
        } catch (e: any) {
            setError(e.toString());
            console.error("Python Error:", e);
            throw e;
        } finally {
            setLoading(false);
        }
    }, []);

    // Also expose raw exec for quick tests
    const execCode = useCallback(async (code: string) => {
        setLoading(true);
        try {
            return await invoke('python_exec', { code });
        } catch (e: any) {
            setError(e.toString());
            throw e;
        } finally {
            setLoading(false);
        }
    }, []);

    return { callScript, execCode, loading, error };
}
