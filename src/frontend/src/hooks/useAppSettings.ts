import React, { useState, useEffect } from 'react';
import { PerformanceSettings } from '../core/types/kernel';
import { checkApiKey, connectApi } from '../core/utils/apiUtils';

export const useAppSettings = () => {
    const [activeModuleId, setActiveModuleId] = useState<string>('sculpt');
    const [bootSequence, setBootSequence] = useState(true);
    const [showProjectSelector, setShowProjectSelector] = useState(false);
    const [persistenceEnabled, setPersistenceEnabled] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [visitedModules, setVisitedModules] = useState<Set<string>>(new Set(['sculpt']));
    const [hasApiKey, setHasApiKey] = useState(false);
    const [isProjectLoading, setIsProjectLoading] = useState(false);
    const [perfSettings, setPerfSettings] = useState<PerformanceSettings>({
        resolution: 1.0,
        shadows: true,
        postFX: true,
        antialiasing: true,
        mode: 'BALANCED'
    });
    // Viewport Mode: 'simple' = Three.js apps, 'advanced' = Bevy unified viewport
    const [viewportMode, setViewportMode] = useState<'simple' | 'advanced'>('simple');

    useEffect(() => {
        checkApiKey().then(setHasApiKey);
    }, []);

    useEffect(() => {
        setTimeout(() => {
            setBootSequence(false);
            setShowProjectSelector(true);
        }, 800);
    }, []);

    const switchModule = (id: string) => {
        setActiveModuleId(id);
        setVisitedModules(prev => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
        setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    };

    const handleKillTasks = (e: React.MouseEvent) => {
        e.stopPropagation();
        setVisitedModules(new Set([activeModuleId]));
    };

    const handleConnectApi = async () => {
        await connectApi();
        setHasApiKey(true);
    };

    const applyPerfPreset = (mode: 'ECO' | 'BALANCED' | 'ULTRA') => {
        if (mode === 'ECO') {
            setPerfSettings({
                resolution: 0.5,
                shadows: false,
                postFX: false,
                antialiasing: false,
                mode: 'ECO'
            });
        } else if (mode === 'BALANCED') {
            setPerfSettings({
                resolution: 1.0,
                shadows: true,
                postFX: true,
                antialiasing: true,
                mode: 'BALANCED'
            });
        } else if (mode === 'ULTRA') {
            setPerfSettings({
                resolution: 1.5,
                shadows: true,
                postFX: true,
                antialiasing: true,
                mode: 'ULTRA'
            });
        }
    };

    return {
        // State
        activeModuleId,
        bootSequence,
        showProjectSelector,
        persistenceEnabled,
        isSettingsOpen,
        visitedModules,
        hasApiKey,
        isProjectLoading,
        perfSettings,
        viewportMode,
        // Setters
        setActiveModuleId,
        setBootSequence,
        setShowProjectSelector,
        setPersistenceEnabled,
        setIsSettingsOpen,
        setVisitedModules,
        setIsProjectLoading,
        setPerfSettings,
        setViewportMode,
        // Actions
        switchModule,
        handleKillTasks,
        handleConnectApi,
        applyPerfPreset
    };
};