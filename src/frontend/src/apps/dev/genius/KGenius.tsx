import React, { useEffect, useState } from 'react';
import { AlertTriangle, Bot, Cpu, RefreshCw, Terminal } from 'lucide-react';
import {
    KAIN_COMMAND_RECIPES,
    getKainModuleAccelerationProfiles,
    getKainShippabilitySnapshot
} from '../../../config/kainAcceleration';
import {
    getKainIntegrationStatus,
    runKainDoctorDiagnostic,
    type KainCommandResult,
    type KainIntegrationStatus
} from '../../../services/kainAccelerationClient';

interface KGeniusProps {
    sharedState?: {
        storage?: unknown[];
        materials?: unknown[];
        alphas?: unknown[];
    };
}

const statusToneClasses = {
    'browser-first': 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    'hybrid-bridge': 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    'desktop-bound': 'border-rose-500/30 bg-rose-500/10 text-rose-300'
} as const;

export default function KGenius({ sharedState }: KGeniusProps) {
    const [integrationStatus, setIntegrationStatus] = useState<KainIntegrationStatus | null>(null);
    const [doctorResult, setDoctorResult] = useState<KainCommandResult | null>(null);
    const [isLoadingStatus, setIsLoadingStatus] = useState(true);
    const [isRunningDoctor, setIsRunningDoctor] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const moduleProfiles = getKainModuleAccelerationProfiles();
    const shippabilitySnapshot = getKainShippabilitySnapshot();
    const doctorPreview = (doctorResult?.stdout || doctorResult?.stderr || '').trim();

    const loadStatus = async () => {
        setIsLoadingStatus(true);
        setErrorMessage(null);

        try {
            const result = await getKainIntegrationStatus();
            setIntegrationStatus(result);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Failed to load Kain integration status.');
        } finally {
            setIsLoadingStatus(false);
        }
    };

    const handleRunDoctor = async () => {
        setIsRunningDoctor(true);
        setErrorMessage(null);

        try {
            const result = await runKainDoctorDiagnostic();
            setDoctorResult(result);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Failed to run Kain doctor.');
        } finally {
            setIsRunningDoctor(false);
        }
    };

    useEffect(() => {
        loadStatus();
    }, []);

    return (
        <div className="w-full h-full overflow-auto bg-[#04070a] text-[#d6e2ea]">
            <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
                <section className="rounded-[28px] border border-[#173342] bg-[radial-gradient(circle_at_top_left,rgba(0,255,204,0.16),transparent_38%),linear-gradient(180deg,#071118,#05080c)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="max-w-3xl">
                            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#1c4e5f] bg-[#08161d] px-3 py-1 text-[11px] font-black uppercase tracking-[0.3em] text-[#72f7d0]">
                                <Bot size={12} />
                                K-GENIUS
                            </div>
                            <h1 className="text-3xl font-black uppercase tracking-[0.08em] text-white">
                                Kain acceleration cockpit for shipping `tidus`
                            </h1>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#8da6b3]">
                                This surface does not pretend to be magic. It reads the live Zen module registry,
                                maps each tool to the Kain lane that actually fits, and shows where the browser DCC
                                push is still blocked by desktop or host-runtime seams.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <button
                                className="inline-flex items-center gap-2 rounded-full border border-[#21566a] bg-[#0b1b23] px-4 py-2 text-sm font-bold text-[#8af8d6] transition-colors hover:bg-[#112833]"
                                onClick={loadStatus}
                                type="button"
                            >
                                <RefreshCw size={14} className={isLoadingStatus ? 'animate-spin' : ''} />
                                Refresh status
                            </button>
                            <button
                                className="inline-flex items-center gap-2 rounded-full border border-[#2f5d32] bg-[#0f1d12] px-4 py-2 text-sm font-bold text-[#9cf18c] transition-colors hover:bg-[#152719]"
                                onClick={handleRunDoctor}
                                type="button"
                            >
                                <Terminal size={14} className={isRunningDoctor ? 'animate-pulse' : ''} />
                                Run `kain doctor`
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-4">
                        <div className="rounded-2xl border border-[#153544] bg-[#071018] p-4">
                            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[#5cc7d3]">Browser-first</div>
                            <div className="mt-2 text-3xl font-black text-white">{shippabilitySnapshot.browserFirstCount}</div>
                            <div className="mt-2 text-xs text-[#7f98a4]">Modules with a credible direct web path.</div>
                        </div>
                        <div className="rounded-2xl border border-[#4e4513] bg-[#171206] p-4">
                            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[#f8d469]">Hybrid bridge</div>
                            <div className="mt-2 text-3xl font-black text-white">{shippabilitySnapshot.hybridBridgeCount}</div>
                            <div className="mt-2 text-xs text-[#b19b6a]">Modules that can ship to web after bounded host adaptation.</div>
                        </div>
                        <div className="rounded-2xl border border-[#4e171f] bg-[#17090c] p-4">
                            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[#ff8b93]">Desktop-bound</div>
                            <div className="mt-2 text-3xl font-black text-white">{shippabilitySnapshot.desktopBoundCount}</div>
                            <div className="mt-2 text-xs text-[#ba8d93]">Modules still dominated by Tauri or native runtime seams.</div>
                        </div>
                        <div className="rounded-2xl border border-[#1e3643] bg-[#091118] p-4">
                            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[#70d5ff]">Workspace assets</div>
                            <div className="mt-2 text-3xl font-black text-white">{sharedState?.storage?.length ?? 0}</div>
                            <div className="mt-2 text-xs text-[#7f98a4]">
                                {sharedState?.materials?.length ?? 0} materials and {sharedState?.alphas?.length ?? 0} alphas currently visible to the cockpit.
                            </div>
                        </div>
                    </div>
                </section>

                <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-[26px] border border-[#152a35] bg-[#071017] p-5">
                        <div className="mb-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.26em] text-[#5cc7d3]">
                            <Cpu size={12} />
                            Kain repo status
                        </div>

                        {isLoadingStatus && (
                            <div className="rounded-2xl border border-[#173342] bg-[#08131a] p-4 text-sm text-[#7f98a4]">
                                Resolving the repo root and checking the Kain toolchain surface.
                            </div>
                        )}

                        {!isLoadingStatus && integrationStatus && (
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="rounded-2xl border border-[#173342] bg-[#08131a] p-4">
                                    <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#72f7d0]">Repo root</div>
                                    <div className="mt-2 break-all text-sm text-white">{integrationStatus.repo_root}</div>
                                    <div className="mt-4 text-[11px] font-black uppercase tracking-[0.22em] text-[#72f7d0]">Tidus root</div>
                                    <div className="mt-2 break-all text-sm text-white">{integrationStatus.tidus_root}</div>
                                </div>
                                <div className="rounded-2xl border border-[#173342] bg-[#08131a] p-4">
                                    <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#72f7d0]">Doctor command</div>
                                    <div className="mt-2 text-sm text-white">{integrationStatus.kain_doctor_command}</div>
                                    <div className="mt-4 text-[11px] font-black uppercase tracking-[0.22em] text-[#72f7d0]">Repo entrypoints</div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {integrationStatus.supported_entrypoints.map((entrypoint) => (
                                            <span key={entrypoint} className="rounded-full border border-[#254f61] bg-[#0b1d26] px-3 py-1 text-xs text-[#90d7df]">
                                                {entrypoint}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {doctorResult && (
                            <div className="mt-4 rounded-2xl border border-[#173342] bg-[#061017] p-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#72f7d0]">Doctor result</div>
                                        <div className="mt-1 text-sm text-[#8ea5b1]">{doctorResult.command}</div>
                                    </div>
                                    <div className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${doctorResult.success ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
                                        {doctorResult.success ? 'healthy' : `failed (${doctorResult.exit_code})`}
                                    </div>
                                </div>

                                <pre className="mt-4 max-h-64 overflow-auto rounded-2xl border border-[#173342] bg-[#03080b] p-4 text-xs leading-5 text-[#8bd9ca]">
                                    {doctorPreview || 'No output was captured from the doctor command.'}
                                </pre>
                            </div>
                        )}
                    </div>

                    <div className="rounded-[26px] border border-[#152a35] bg-[#071017] p-5">
                        <div className="mb-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.26em] text-[#f2c55a]">
                            <AlertTriangle size={12} />
                            Browser ship blockers
                        </div>
                        <div className="space-y-3">
                            {shippabilitySnapshot.primaryBlockers.map((blocker) => (
                                <div key={blocker} className="rounded-2xl border border-[#4a3817] bg-[#171005] p-4 text-sm text-[#e4c984]">
                                    {blocker}
                                </div>
                            ))}
                        </div>

                        <div className="mt-5 rounded-2xl border border-[#173342] bg-[#08131a] p-4">
                            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#72f7d0]">Recommended focus</div>
                            <div className="mt-3 space-y-3">
                                {shippabilitySnapshot.recommendedFocus.map((focusItem) => (
                                    <div key={focusItem} className="rounded-2xl border border-[#1f4657] bg-[#0b1820] p-3 text-sm text-[#b7d1db]">
                                        {focusItem}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="rounded-[26px] border border-[#152a35] bg-[#071017] p-5">
                    <div className="mb-4 text-[11px] font-black uppercase tracking-[0.26em] text-[#72f7d0]">
                        Module acceleration map
                    </div>
                    <div className="grid gap-4 xl:grid-cols-2">
                        {moduleProfiles.map((profile) => (
                            <div key={profile.moduleId} className="rounded-2xl border border-[#173342] bg-[#08131a] p-4">
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div>
                                        <div className="text-lg font-black uppercase tracking-[0.08em] text-white">
                                            {profile.moduleName}
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            <span className="rounded-full border border-[#254f61] bg-[#0b1d26] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[#90d7df]">
                                                {profile.category}
                                            </span>
                                            <span className="rounded-full border border-[#254f61] bg-[#0b1d26] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[#90d7df]">
                                                {profile.lane.replaceAll('-', ' ')}
                                            </span>
                                            <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${statusToneClasses[profile.browserDeliveryStatus]}`}>
                                                {profile.browserDeliveryStatus.replaceAll('-', ' ')}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-[#173342] bg-[#061017] px-4 py-3 text-right">
                                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#72f7d0]">Tauri seams</div>
                                        <div className="mt-1 text-2xl font-black text-white">{profile.tauriCommandCount}</div>
                                    </div>
                                </div>

                                <p className="mt-4 text-sm leading-6 text-[#97afbb]">{profile.rationale}</p>

                                <div className="mt-4 grid gap-4 md:grid-cols-2">
                                    <div>
                                        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#72f7d0]">Next step</div>
                                        <div className="mt-2 text-sm text-[#c9d8df]">{profile.nextStep}</div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#72f7d0]">Generated outputs</div>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {profile.generatedOutputs.map((output) => (
                                                <span key={output} className="rounded-full border border-[#254f61] bg-[#0b1d26] px-3 py-1 text-xs text-[#9ccbd6]">
                                                    {output}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {profile.blockers.length > 0 && (
                                    <div className="mt-4 rounded-2xl border border-[#4a3817] bg-[#171005] p-3">
                                        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#f2c55a]">Current blockers</div>
                                        <div className="mt-2 space-y-2">
                                            {profile.blockers.map((blocker) => (
                                                <div key={blocker} className="text-sm text-[#e4c984]">
                                                    {blocker}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                <section className="rounded-[26px] border border-[#152a35] bg-[#071017] p-5">
                    <div className="mb-4 text-[11px] font-black uppercase tracking-[0.26em] text-[#72f7d0]">
                        Kain recipes
                    </div>
                    <div className="grid gap-4 xl:grid-cols-2">
                        {KAIN_COMMAND_RECIPES.map((recipe) => (
                            <div key={recipe.id} className="rounded-2xl border border-[#173342] bg-[#08131a] p-4">
                                <div className="text-lg font-black uppercase tracking-[0.08em] text-white">{recipe.label}</div>
                                <p className="mt-2 text-sm leading-6 text-[#97afbb]">{recipe.summary}</p>
                                <div className="mt-4 rounded-2xl border border-[#173342] bg-[#03080b] p-3 font-mono text-xs text-[#8bd9ca]">
                                    {recipe.commandPreview}
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {recipe.generatedOutputs.map((output) => (
                                        <span key={output} className="rounded-full border border-[#254f61] bg-[#0b1d26] px-3 py-1 text-xs text-[#9ccbd6]">
                                            {output}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {errorMessage && (
                    <section className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                        {errorMessage}
                    </section>
                )}
            </div>
        </div>
    );
}

