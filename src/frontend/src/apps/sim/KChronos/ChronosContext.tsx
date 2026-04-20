import React, { createContext, useContext, useState, useRef } from 'react';

interface ChronosContextType {
    // Status
    status: string;
    setStatus: React.Dispatch<React.SetStateAction<string>>;
    activeTab: string;
    setActiveTab: React.Dispatch<React.SetStateAction<string>>;

    // Core State
    simRes: number;
    setSimRes: React.Dispatch<React.SetStateAction<number>>;
    mode: number;
    setMode: React.Dispatch<React.SetStateAction<number>>;
    speed: number;
    setSpeed: React.Dispatch<React.SetStateAction<number>>;
    chaos: number;
    setChaos: React.Dispatch<React.SetStateAction<number>>;
    damping: number;
    setDamping: React.Dispatch<React.SetStateAction<number>>;

    // Scripting
    userScript: string;
    setUserScript: React.Dispatch<React.SetStateAction<string>>;
    compileStatus: string;
    setCompileStatus: React.Dispatch<React.SetStateAction<string>>;
    isScriptActive: boolean;
    setIsScriptActive: React.Dispatch<React.SetStateAction<boolean>>;

    // Visuals
    pointSize: number;
    setPointSize: React.Dispatch<React.SetStateAction<number>>;
    opacity: number;
    setOpacity: React.Dispatch<React.SetStateAction<number>>;
    colorHex: string;
    setColorHex: React.Dispatch<React.SetStateAction<string>>;
    color2Hex: string;
    setColor2Hex: React.Dispatch<React.SetStateAction<string>>;
    colorMode: string;
    setColorMode: React.Dispatch<React.SetStateAction<string>>;
    gradientStrength: number;
    setGradientStrength: React.Dispatch<React.SetStateAction<number>>;
    highFidelity: boolean;
    setHighFidelity: React.Dispatch<React.SetStateAction<boolean>>;
    autoOrbit: boolean;
    setAutoOrbit: React.Dispatch<React.SetStateAction<boolean>>;

    // Export State
    recResolution: string;
    setRecResolution: React.Dispatch<React.SetStateAction<string>>;
    recQuality: string;
    setRecQuality: React.Dispatch<React.SetStateAction<string>>;
    recFormat: string;
    setRecFormat: React.Dispatch<React.SetStateAction<string>>;
    isRecording: boolean;
    setIsRecording: React.Dispatch<React.SetStateAction<boolean>>;
    isRecordingVAT: boolean;
    setIsRecordingVAT: React.Dispatch<React.SetStateAction<boolean>>;
    isRecordingSequence: boolean;
    setIsRecordingSequence: React.Dispatch<React.SetStateAction<boolean>>;
    vatFramesCaptured: number;
    setVatFramesCaptured: React.Dispatch<React.SetStateAction<number>>;
    sequenceFramesCaptured: number;
    setSequenceFramesCaptured: React.Dispatch<React.SetStateAction<number>>;
    processingProgress: number;
    setProcessingProgress: React.Dispatch<React.SetStateAction<number>>;

    // Refs (Mutable references shared across components)
    engineRef: React.MutableRefObject<any>;
    mountRef: React.MutableRefObject<HTMLDivElement | null>;
    vatFramesRef: React.MutableRefObject<any[]>;
    sequenceFramesRef: React.MutableRefObject<any[]>;

    // Actions
    onCommit?: (blob: Blob, name: string) => void;
}

export const ChronosContext = createContext<ChronosContextType | null>(null);

export const useChronos = () => {
    const context = useContext(ChronosContext);
    if (!context) {
        throw new Error("useChronos must be used within a ChronosProvider");
    }
    return context;
};

export const ChronosProvider: React.FC<{ children: React.ReactNode, onCommit?: (blob: Blob, name: string) => void }> = ({ children, onCommit }) => {
    const [status, setStatus] = useState("K-CHRONOS: SCIENCE KERNEL");
    const [activeTab, setActiveTab] = useState('core');
    const [simRes, setSimRes] = useState(256);
    const [mode, setMode] = useState(0);
    const [speed, setSpeed] = useState(1.0);
    const [chaos, setChaos] = useState(0.5);
    const [damping, setDamping] = useState(0.96);
    const [userScript, setUserScript] = useState("force.y += sin(p.x * 2.0 + t) * 0.5;");
    const [compileStatus, setCompileStatus] = useState("READY");
    const [isScriptActive, setIsScriptActive] = useState(false);
    const [pointSize, setPointSize] = useState(2.0);
    const [opacity, setOpacity] = useState(0.8);
    // Color System
    const [colorHex, setColorHex] = useState("#00ffcc");
    const [color2Hex, setColor2Hex] = useState("#ff00cc");
    const [colorMode, setColorMode] = useState<string>('SOLID'); // SOLID, VELOCITY, POSITION, ANGLE
    const [gradientStrength, setGradientStrength] = useState(1.0);
    const [highFidelity, setHighFidelity] = useState(false); // New

    const [autoOrbit, setAutoOrbit] = useState(false);
    const [recResolution, setRecResolution] = useState('WINDOW');
    const [recQuality, setRecQuality] = useState('HIGH');
    const [recFormat, setRecFormat] = useState('WEBM');
    const [isRecording, setIsRecording] = useState(false);
    const [isRecordingVAT, setIsRecordingVAT] = useState(false);
    const [isRecordingSequence, setIsRecordingSequence] = useState(false);
    const [vatFramesCaptured, setVatFramesCaptured] = useState(0);
    const [sequenceFramesCaptured, setSequenceFramesCaptured] = useState(0);
    const [processingProgress, setProcessingProgress] = useState(0);

    const engineRef = useRef<any>(null);
    const mountRef = useRef<HTMLDivElement>(null);
    const vatFramesRef = useRef<any[]>([]);
    const sequenceFramesRef = useRef<any[]>([]);

    const value = {
        status, setStatus,
        activeTab, setActiveTab,
        simRes, setSimRes,
        mode, setMode,
        speed, setSpeed,
        chaos, setChaos,
        damping, setDamping,
        userScript, setUserScript,
        compileStatus, setCompileStatus,
        isScriptActive, setIsScriptActive,
        pointSize, setPointSize,
        opacity, setOpacity,
        colorHex, setColorHex,
        color2Hex, setColor2Hex,
        colorMode, setColorMode,
        gradientStrength, setGradientStrength,
        highFidelity, setHighFidelity,
        autoOrbit, setAutoOrbit,
        recResolution, setRecResolution,
        recQuality, setRecQuality,
        recFormat, setRecFormat,
        isRecording, setIsRecording,
        isRecordingVAT, setIsRecordingVAT,
        isRecordingSequence, setIsRecordingSequence,
        vatFramesCaptured, setVatFramesCaptured,
        sequenceFramesCaptured, setSequenceFramesCaptured,
        processingProgress, setProcessingProgress,
        engineRef,
        mountRef,
        vatFramesRef,
        sequenceFramesRef,
        onCommit
    };

    return (
        <ChronosContext.Provider value={value}>
            {children}
        </ChronosContext.Provider>
    );
};
