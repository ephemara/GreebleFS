import React, { useState, useCallback, useEffect, useRef } from 'react';
import { KernelArtifact, KernelMaterial, KernelAlpha } from '../core/types/kernel';
import { commitToKernel, mergeArtifacts, weldArtifact, createMaterial, createAlpha } from '../services/kernelServices';
import { processImport, loadProject, saveProject } from '../services/projectServices';
import { CATEGORY_CONFIG } from '../config/appConfig';
import { useZenWorkspaceStore } from '../core/zen/store';

export const useKernelApp = () => {
    const zenWorkspace = useZenWorkspaceStore((state) => state.document);
    const resetZenWorkspace = useZenWorkspaceStore((state) => state.resetWorkspace);
    const hydrateZenWorkspace = useZenWorkspaceStore((state) => state.hydrateWorkspace);
    const upsertKernelArtifactToWorkspace = useZenWorkspaceStore((state) => state.upsertKernelArtifact);
    const removeKernelArtifactFromWorkspace = useZenWorkspaceStore((state) => state.removeKernelArtifact);
    const upsertKernelMaterialToWorkspace = useZenWorkspaceStore((state) => state.upsertKernelMaterial);
    const removeKernelMaterialFromWorkspace = useZenWorkspaceStore((state) => state.removeKernelMaterial);
    const upsertKernelAlphaToWorkspace = useZenWorkspaceStore((state) => state.upsertKernelAlpha);
    const removeKernelAlphaFromWorkspace = useZenWorkspaceStore((state) => state.removeKernelAlpha);
    const setActiveSelectionInWorkspace = useZenWorkspaceStore((state) => state.setActiveSelection);

    const [kernelArtifacts, setKernelArtifacts] = useState<KernelArtifact[]>([]);
    const [kernelMaterials, setKernelMaterials] = useState<KernelMaterial[]>([]);
    const [kernelAlphas, setKernelAlphas] = useState<KernelAlpha[]>([]);
    const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);
    const [previewArtifactId, setPreviewArtifactId] = useState<string | null>(null);
    const [selectedArtifactIds, setSelectedArtifactIds] = useState<string[]>([]);
    const [isMerging, setIsMerging] = useState(false);
    const [kernelStatus, setKernelStatus] = useState("IDLE");
    const [isImporting, setIsImporting] = useState(false);
    const [isAssetBrowserOpen, setIsAssetBrowserOpen] = useState(false);
    const [browserTab, setBrowserTab] = useState<'ARTIFACTS' | 'MATERIALS' | 'ALPHAS'>('ARTIFACTS');
    const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
    const [tempImage, setTempImage] = useState<string | null>(null);
    const pendingWorkspaceArtifactSyncRef = useRef<{ active: boolean; id: string | null }>({
        active: false,
        id: null
    });

    // Initialize folders open state
    useEffect(() => {
        const initial: Record<string, boolean> = {};
        Object.keys(CATEGORY_CONFIG).forEach(k => initial[k] = true);
        setOpenFolders(prev => ({ ...initial, ...prev }));
    }, []);

    useEffect(() => {
        kernelArtifacts.forEach((artifact) => upsertKernelArtifactToWorkspace(artifact));
    }, [kernelArtifacts, upsertKernelArtifactToWorkspace]);

    useEffect(() => {
        kernelMaterials.forEach((material) => upsertKernelMaterialToWorkspace(material));
    }, [kernelMaterials, upsertKernelMaterialToWorkspace]);

    useEffect(() => {
        kernelAlphas.forEach((alpha) => upsertKernelAlphaToWorkspace(alpha));
    }, [kernelAlphas, upsertKernelAlphaToWorkspace]);

    useEffect(() => {
        if (activeArtifactId === zenWorkspace.activeAssetId) {
            if (
                pendingWorkspaceArtifactSyncRef.current.active &&
                pendingWorkspaceArtifactSyncRef.current.id === zenWorkspace.activeAssetId
            ) {
                pendingWorkspaceArtifactSyncRef.current = { active: false, id: null };
            }
            return;
        }

        if (pendingWorkspaceArtifactSyncRef.current.active) {
            return;
        }

        setActiveArtifactId(zenWorkspace.activeAssetId);
        setPreviewArtifactId((currentPreviewId) => {
            if (currentPreviewId === activeArtifactId || currentPreviewId === null) {
                return zenWorkspace.activeAssetId;
            }

            return currentPreviewId;
        });
    }, [activeArtifactId, zenWorkspace.activeAssetId]);

    useEffect(() => {
        if (activeArtifactId === zenWorkspace.activeAssetId) return;

        pendingWorkspaceArtifactSyncRef.current = {
            active: true,
            id: activeArtifactId
        };

        setActiveSelectionInWorkspace(
            activeArtifactId
                ? { activeAssetId: activeArtifactId }
                : { activeAssetId: null, activeEntityId: null, activeLayerId: null }
        );
    }, [activeArtifactId, setActiveSelectionInWorkspace, zenWorkspace.activeAssetId]);

    const handleCommitToKernel = useCallback(async (blob: Blob, source: string) => {
        const newArtifact = await commitToKernel(
            blob,
            source,
            kernelArtifacts.length,
            setKernelStatus
        );
        setKernelArtifacts(prev => [newArtifact, ...prev]);
        setActiveArtifactId(newArtifact.id);
        setPreviewArtifactId(newArtifact.id);
        upsertKernelArtifactToWorkspace(newArtifact);
    }, [kernelArtifacts.length, upsertKernelArtifactToWorkspace]);

    const handleMergeArtifacts = useCallback(async () => {
        if (selectedArtifactIds.length < 2) return;
        setIsMerging(true);
        await mergeArtifacts(
            selectedArtifactIds,
            kernelArtifacts,
            handleCommitToKernel,
            setKernelStatus
        );
        setSelectedArtifactIds([]);
        setIsMerging(false);
    }, [selectedArtifactIds, kernelArtifacts, handleCommitToKernel]);

    const toggleArtifactWeld = useCallback(async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const art = kernelArtifacts.find(a => a.id === id);
        if (!art || art.isProcessing) return;

        if (art.isWelded) {
            setKernelArtifacts(prev => prev.map(a => a.id === id ? { ...a, isWelded: false } : a));
            setKernelStatus("WELD REVERTED");
            return;
        }

        if (art.weldedBlob) {
            setKernelArtifacts(prev => prev.map(a => a.id === id ? { ...a, isWelded: true } : a));
            setKernelStatus("RESTORED MONOLITH");
            return;
        }

        setKernelArtifacts(prev => prev.map(a => a.id === id ? { ...a, isProcessing: true } : a));

        try {
            const weldedBlob = await weldArtifact(art, setKernelStatus);
            setKernelArtifacts(prev => prev.map(a =>
                a.id === id ? { ...a, isWelded: true, weldedBlob, isProcessing: false } : a
            ));
        } catch (err) {
            console.error(err);
            setKernelArtifacts(prev => prev.map(a => a.id === id ? { ...a, isProcessing: false } : a));
        }
    }, [kernelArtifacts]);

    const toggleArtifactSelection = useCallback((id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedArtifactIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    }, []);

    const handleDeleteArtifact = useCallback((id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setKernelArtifacts(prev => prev.filter(a => a.id !== id));
        setSelectedArtifactIds(prev => prev.filter(mid => mid !== id));
        if (activeArtifactId === id) setActiveArtifactId(null);
        if (previewArtifactId === id) setPreviewArtifactId(null);
        removeKernelArtifactFromWorkspace(id);
    }, [activeArtifactId, previewArtifactId, removeKernelArtifactFromWorkspace]);

    const handleDownloadArtifact = useCallback((id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const art = kernelArtifacts.find(a => a.id === id);
        if (art) {
            const blobToDL = (art.isWelded && art.weldedBlob) ? art.weldedBlob : art.blob;
            const url = URL.createObjectURL(blobToDL);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${art.name}${art.isWelded ? '_Monolith' : ''}.glb`;
            a.click();
            URL.revokeObjectURL(url);
        }
    }, [kernelArtifacts]);

    const handleMaterialCommit = useCallback((maps: any) => {
        const newMat = createMaterial(maps, kernelMaterials.length);
        setKernelMaterials(prev => [...prev, newMat]);
        setKernelStatus("MATERIAL STORED");
        upsertKernelMaterialToWorkspace(newMat);
        return newMat;
    }, [kernelMaterials.length, upsertKernelMaterialToWorkspace]);

    const handleAlphaCommit = useCallback((alphaData: { name: string, url: string }) => {
        const newAlpha = createAlpha(alphaData, kernelAlphas.length);
        setKernelAlphas(prev => [...prev, newAlpha]);
        setKernelStatus("ALPHA STORED");
        upsertKernelAlphaToWorkspace(newAlpha);
    }, [kernelAlphas.length, upsertKernelAlphaToWorkspace]);

    const handleDeleteMaterial = useCallback((id: string) => {
        setKernelMaterials(prev => prev.filter(m => m.id !== id));
        removeKernelMaterialFromWorkspace(id);
    }, [removeKernelMaterialFromWorkspace]);

    const handleDeleteAlpha = useCallback((id: string) => {
        setKernelAlphas(prev => prev.filter(a => a.id !== id));
        removeKernelAlphaFromWorkspace(id);
    }, [removeKernelAlphaFromWorkspace]);

    const getActiveArtifactBlob = useCallback(() => {
        const resolvedArtifactId = zenWorkspace.activeAssetId ?? activeArtifactId;
        const art = kernelArtifacts.find(a => a.id === resolvedArtifactId);
        if (!art) return null;
        return (art.isWelded && art.weldedBlob) ? art.weldedBlob : art.blob;
    }, [kernelArtifacts, activeArtifactId, zenWorkspace.activeAssetId]);

    const processFileImport = useCallback(async (file: File) => {
        setIsImporting(true);
        try {
            await processImport(file, handleCommitToKernel, setKernelStatus);
        } finally {
            setIsImporting(false);
        }
    }, [handleCommitToKernel]);

    const processAlphaImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        Array.from(files).forEach((file: File) => {
            const url = URL.createObjectURL(file);
            handleAlphaCommit({ name: file.name, url: url });
        });
    }, [handleAlphaCommit]);

    const handleNewProject = useCallback(() => {
        setKernelArtifacts([]);
        setKernelMaterials([]);
        setKernelAlphas([]);
        setActiveArtifactId(null);
        setPreviewArtifactId(null);
        setKernelStatus("SESSION INITIALIZED");
        resetZenWorkspace('sculpt');
    }, [resetZenWorkspace]);

    const handleLoadProject = useCallback(async (file: File) => {
        try {
            const result = await loadProject(file, setKernelStatus);
            setKernelArtifacts(result.artifacts);
            setKernelMaterials(result.materials);
            setKernelAlphas(result.alphas);
            hydrateZenWorkspace(result.workspace);
            setActiveArtifactId(result.workspace.activeAssetId ?? result.artifacts[0]?.id ?? null);
            setPreviewArtifactId(result.workspace.activeAssetId ?? result.artifacts[0]?.id ?? null);
            return true;
        } catch (e) {
            return false;
        }
    }, [hydrateZenWorkspace]);

    const handleSaveProject = useCallback(async () => {
        await saveProject(kernelArtifacts, kernelMaterials, kernelAlphas, setKernelStatus, zenWorkspace);
    }, [kernelArtifacts, kernelMaterials, kernelAlphas, zenWorkspace]);

    const openAssetBrowser = useCallback(() => {
        setIsAssetBrowserOpen(true);
        if (activeArtifactId) setPreviewArtifactId(activeArtifactId);
    }, [activeArtifactId]);

    return {
        // State
        kernelArtifacts,
        kernelMaterials,
        kernelAlphas,
        activeArtifactId,
        previewArtifactId,
        selectedArtifactIds,
        isMerging,
        kernelStatus,
        isImporting,
        isAssetBrowserOpen,
        browserTab,
        openFolders,
        // Setters
        setKernelArtifacts,
        setKernelMaterials,
        setKernelAlphas,
        setActiveArtifactId,
        setPreviewArtifactId,
        setSelectedArtifactIds,
        setKernelStatus,
        setIsAssetBrowserOpen,
        setBrowserTab,
        setOpenFolders,
        // Actions
        handleCommitToKernel,
        handleMergeArtifacts,
        toggleArtifactWeld,
        toggleArtifactSelection,
        handleDeleteArtifact,
        handleDownloadArtifact,
        handleMaterialCommit,
        handleAlphaCommit,
        handleDeleteMaterial,
        handleDeleteAlpha,
        getActiveArtifactBlob,
        processFileImport,
        processAlphaImport,
        handleNewProject,
        handleLoadProject,
        handleSaveProject,
        openAssetBrowser,
        // Inter-App Communication
        zenWorkspace,
        tempImage,
        setTempImage
    };
};
