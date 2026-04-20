import { invoke } from '@tauri-apps/api/core';

export interface KainIntegrationStatus {
    repo_root: string;
    tidus_root: string;
    tidus_frontend_root: string;
    repo_readme_found: boolean;
    cargo_manifest_found: boolean;
    cli_workspace_member_present: boolean;
    tidus_architecture_found: boolean;
    kain_doctor_command: string;
    supported_entrypoints: string[];
}

export interface KainCommandResult {
    command: string;
    success: boolean;
    exit_code: number;
    stdout: string;
    stderr: string;
}

export const getKainIntegrationStatus = async (): Promise<KainIntegrationStatus> =>
    invoke<KainIntegrationStatus>('get_kain_integration_status');

export const runKainDoctorDiagnostic = async (): Promise<KainCommandResult> =>
    invoke<KainCommandResult>('run_kain_doctor_diagnostic');

