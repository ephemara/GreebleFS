import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { PMREMGenerator } from 'three';
import { UploadCloud, Sun, CloudOff } from 'lucide-react';

interface KHDRWidgetProps {
    /** The Three.js Scene to apply the environment to */
    scene: THREE.Scene | null;
    /** The WebGLRenderer (needed for PMREMGenerator) */
    renderer: THREE.WebGLRenderer | null;

    /** Whether HDR is enabled by default on mount */
    defaultEnabled?: boolean;

    /** Callback for status updates (e.g. "HDR LOADED") */
    onStatusChange?: (status: string) => void;

    /** Callback when HDR state changes (active/inactive) - useful for adjusting other scene elements like ground roughness */
    onHDRActive?: (isActive: boolean) => void;
}

export const KHDRWidget: React.FC<KHDRWidgetProps> = ({
    scene,
    renderer,
    defaultEnabled = false,
    onStatusChange,
    onHDRActive
}) => {
    const [customHDR, setCustomHDR] = useState<string | null>(null);
    const hdrInputRef = useRef<HTMLInputElement>(null);
    const lastHdrUrlRef = useRef<string | null>(null);

    // Cache textures to avoid reloading when toggling
    const hdrTextureRef = useRef<THREE.Texture | null>(null);
    const hdrEnvMapRef = useRef<THREE.Texture | null>(null);
    const defaultEnvMapRef = useRef<THREE.Texture | null>(null); // Original scene env, if we want to restore?

    // On Mount: simple check or auto-load default
    useEffect(() => {
        if (defaultEnabled && !customHDR) {
            // Default HDR Path (assumed from KGreeble)
            const defaultHDR = '/hdr/HDR_029_Sky_Cloudy_Env.hdr';
            setCustomHDR(defaultHDR);
        }
    }, [defaultEnabled]);

    // --- HDR LOGIC ---
    useEffect(() => {
        if (!scene || !renderer) return;

        // If HDR is active
        if (customHDR) {
            // Check Cache
            if (hdrTextureRef.current && hdrEnvMapRef.current && lastHdrUrlRef.current === customHDR) {
                scene.background = hdrTextureRef.current;
                scene.environment = hdrEnvMapRef.current;
                if (onStatusChange) onStatusChange("HDR RESTORED");
                if (onHDRActive) onHDRActive(true);
                return;
            }

            // Load New
            if (onStatusChange) onStatusChange("LOADING HDR...");

            const loader = new RGBELoader();
            loader.setDataType(THREE.FloatType);
            loader.load(customHDR, (texture) => {
                texture.mapping = THREE.EquirectangularReflectionMapping;
                scene.background = texture;

                const pmremGenerator = new PMREMGenerator(renderer);
                pmremGenerator.compileEquirectangularShader();
                const envMap = pmremGenerator.fromEquirectangular(texture).texture;
                scene.environment = envMap;

                // Cache
                hdrTextureRef.current = texture;
                hdrEnvMapRef.current = envMap;
                lastHdrUrlRef.current = customHDR;

                pmremGenerator.dispose();

                if (onStatusChange) onStatusChange("HDR ENVIRONMENT APPLIED");
                if (onHDRActive) onHDRActive(true);

            }, undefined, (err) => {
                console.error("Failed to load HDR:", err);
                if (onStatusChange) onStatusChange("HDR LOAD FAILED");
                setCustomHDR(null); // Revert state
            });
        } else {
            // HDR Disabled
            // We should revert to whatever the scene had, OR let the parent app handle "non-HDR" state.
            // But we typically want to clear the background at least if we set it.

            // NOTE: We don't want to nuke the environment if the app uses a different system when HDR is off.
            // But usually this widget is the *controller* of the environment.
            // Ideally, we just set background to null (or color) and let parent restore.

            // However, keeping previous behavior from KGreeble:
            // It explicitly managed "Sky Mode" vs "Dark Mode" when HDR was off.
            // Here we just notify "onHDRActive(false)" and let the parent decide what to do.

            if (lastHdrUrlRef.current) {
                // Only clear if we were the ones who set it
                // Actually safer to just clear if we are toggling OFF
                scene.background = null;
                scene.environment = null;
            }

            if (onHDRActive) onHDRActive(false);
            if (onStatusChange) onStatusChange("HDR DISABLED");
        }

    }, [customHDR, scene, renderer]);

    // --- HANDLERS ---

    const handleHDRUploadClick = () => {
        hdrInputRef.current?.click();
    };

    const handleHDRUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setCustomHDR(url);
        }
    };

    const toggleDefaultHDR = () => {
        const defaultHDR = '/hdr/HDR_029_Sky_Cloudy_Env.hdr';
        if (customHDR === defaultHDR) {
            setCustomHDR(null); // Turn Off
        } else {
            setCustomHDR(defaultHDR); // Turn On
        }
    };

    const toggleOff = () => {
        setCustomHDR(null);
    };

    // --- RENDER ---
    return (
        <div className="flex items-center gap-1 bg-[#111]/80 p-1 rounded-lg border border-[#222] backdrop-blur-sm">
            {/* TOGGLE DEFAULT */}
            <button
                onClick={toggleDefaultHDR}
                className={`p-1.5 rounded-md transition-all ${customHDR === '/hdr/HDR_029_Sky_Cloudy_Env.hdr'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                        : 'text-gray-400 hover:text-white hover:bg-[#333]'
                    }`}
                title="Toggle Default Studio HDR"
            >
                <Sun size={14} />
            </button>

            {/* UPLOAD CUSTOM */}
            <button
                onClick={handleHDRUploadClick}
                className={`p-1.5 rounded-md transition-all ${customHDR && customHDR !== '/hdr/HDR_029_Sky_Cloudy_Env.hdr'
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50 shadow-[0_0_10px_rgba(249,115,22,0.2)]'
                        : 'text-gray-400 hover:text-white hover:bg-[#333]'
                    }`}
                title="Upload Custom .HDR / .EXR"
            >
                <UploadCloud size={14} />
            </button>
            <input
                type="file"
                ref={hdrInputRef}
                onChange={handleHDRUpload}
                accept=".hdr,.exr"
                className="hidden"
            />

            {/* OFF BUTTON (Only visible if something is on) */}
            {customHDR && (
                <button
                    onClick={toggleOff}
                    className="p-1.5 rounded-md text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all border border-transparent hover:border-red-500/30"
                    title="Disable HDR"
                >
                    <CloudOff size={14} />
                </button>
            )}
        </div>
    );
};
