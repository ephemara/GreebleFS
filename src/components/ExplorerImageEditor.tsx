import { useEffect, useRef, useState } from 'react';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import {
  Crop,
  RotateCcw,
  Save,
  ArrowUpLeft,
  ArrowUpRight,
  ImageIcon,
  X,
  Check,
} from 'lucide-react';
import { writeFile } from '@tauri-apps/plugin-fs';
import { useSettingsStore } from '../store/settingsStore';
import { matchesKeybinding } from '../config/hotkeys';
import { writeExplorerFile } from '../runtime/explorerBackend';
import {
  imageEditorFilterDefinitions,
  createDefaultImageFiltersState,
  buildCSSFilterString,
  type ExplorerImageFiltersState,
} from '../config/imageEditorFilters';

type ExplorerImageEditorProps = {
  imagePath: string;
  imageName: string;
  imageSource: string; // Base64 data URI
  onSaved?: () => Promise<void> | void;
};

type ImageEditorSaveState = 'idle' | 'saving' | 'dirty' | 'saved' | 'error';

const IMAGE_EDITOR_CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function getImageExtension(name: string): string {
  return name.trim().split('.').pop()?.toLowerCase() ?? '';
}

function getImageEditorContentType(name: string): string | null {
  return IMAGE_EDITOR_CONTENT_TYPE_BY_EXTENSION[getImageExtension(name)] ?? null;
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;
  return (
    element.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) ||
    Boolean(element.closest('.monaco-editor'))
  );
}

function buttonStyle(variant: 'primary' | 'default' | 'danger' | 'ghost' = 'default') {
  const base = {
    appearance: 'none' as const,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '6px 10px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 120ms ease',
    border: '1px solid transparent',
  };

  switch (variant) {
    case 'primary':
      return {
        ...base,
        background: 'rgba(59, 130, 246, 0.9)', // Blue 500
        borderColor: 'rgba(59, 130, 246, 1)',
        color: '#fff',
        boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)',
      };
    case 'danger':
      return {
        ...base,
        background: 'rgba(239, 68, 68, 0.15)', // Red 500
        borderColor: 'rgba(239, 68, 68, 0.3)',
        color: '#fca5a5',
      };
    case 'ghost':
      return {
        ...base,
        background: 'transparent',
        borderColor: 'transparent',
        color: 'var(--overlay-text-muted)',
      };
    case 'default':
    default:
      return {
        ...base,
        background: 'rgba(255, 255, 255, 0.06)',
        borderColor: 'rgba(255, 255, 255, 0.12)',
        color: 'var(--overlay-text-primary)',
      };
  }
}

const PREMIUM_SLIDER_STYLES = `
  .premium-slider {
    -webkit-appearance: none;
    width: 100%;
    height: 4px;
    border-radius: 2px;
    outline: none;
    transition: background 0.1s ease;
  }
  .premium-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #ffffff;
    cursor: pointer;
    box-shadow: 0 1px 5px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1);
    transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease;
  }
  .premium-slider::-webkit-slider-thumb:hover {
    box-shadow: 0 2px 8px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.2);
  }
  .premium-slider:active::-webkit-slider-thumb {
    transform: scale(1.3);
    background: #e2e8f0;
  }
`;

function PremiumSlider({ 
  def, 
  value, 
  onChange 
}: { 
  def: import('../config/imageEditorFilters').ImageEditorFilterDefinition; 
  value: number; 
  onChange: (val: number) => void;
}) {
  const isDefault = value === def.default;
  const percentage = ((value - def.min) / (def.max - def.min)) * 100;
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 600, color: isDefault ? 'var(--overlay-text-muted)' : '#f8fafc', transition: 'color 0.2s ease' }}>
        <label style={{ letterSpacing: '0.02em' }}>{def.label}</label>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}{def.unit}</span>
      </div>
      <div style={{ padding: '6px 0', display: 'flex', alignItems: 'center' }}>
        <input
          type="range"
          min={def.min}
          max={def.max}
          step={def.step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="premium-slider"
          style={{
            background: `linear-gradient(to right, #3b82f6 ${percentage}%, rgba(255, 255, 255, 0.1) ${percentage}%)`,
          }}
        />
      </div>
    </div>
  );
}

export function ExplorerImageEditor({
  imagePath,
  imageName,
  imageSource,
  onSaved,
}: ExplorerImageEditorProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cropperImageRef = useRef<HTMLImageElement | null>(null);
  const cropperRef = useRef<Cropper | null>(null);
  
  const [baseImage, setBaseImage] = useState<HTMLImageElement | null>(null);
  const [filters, setFilters] = useState<ExplorerImageFiltersState>(createDefaultImageFiltersState());
  const [isCropping, setIsCropping] = useState(false);
  const [saveState, setSaveState] = useState<ImageEditorSaveState>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  
  const contentType = getImageEditorContentType(imageName);
  const isEditableFormat = contentType !== null;
  const keybindings = useSettingsStore((state) => state.settings.keybindings);

  // Initialize Base Image
  useEffect(() => {
    if (!isEditableFormat) return;
    
    // Clear state on path change
    setBaseImage(null);
    setFilters(createDefaultImageFiltersState());
    setIsCropping(false);
    setSaveState('idle');
    setStatusMessage('');

    const img = new Image();
    img.onload = () => {
      setBaseImage(img);
    };
    img.onerror = () => {
      setSaveState('error');
      setStatusMessage('Failed to parse image for editing.');
    };
    img.src = imageSource;
  }, [imagePath, imageSource, isEditableFormat]);

  // Drop heavy DOM canvas handling. 
  // We use an <img /> in the render tree directly instead for much better GPU performance!

  // Track dirty state
  useEffect(() => {
    const isDirty = JSON.stringify(filters) !== JSON.stringify(createDefaultImageFiltersState());
    if (saveState !== 'saving' && saveState !== 'error') {
      if (isDirty) {
        setSaveState('dirty');
        setStatusMessage('Unsaved filter changes');
      } else if (saveState === 'dirty') {
        setSaveState('idle');
        setStatusMessage('');
      }
    }
  }, [filters, saveState]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const root = rootRef.current;
      const activeElement = document.activeElement;
      const hasEditorFocus = Boolean(
        root &&
        (root.contains(activeElement) || activeElement === document.body)
      );

      if (!hasEditorFocus || isEditableKeyboardTarget(event.target)) return;

      if (matchesKeybinding(event, keybindings.saveFile) && !isCropping && isEditableFormat) {
        event.preventDefault();
        saveImage();
      }
      if (matchesKeybinding(event, keybindings.imageEditorReset) && !isCropping) {
        event.preventDefault();
        handleReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keybindings, isCropping, isEditableFormat, baseImage, filters]);

  // Actions
  const handleReset = () => {
    setFilters(createDefaultImageFiltersState());
  };

  const saveImage = async () => {
    if (!contentType || saveState === 'saving' || !baseImage) return;

    setSaveState('saving');
    setStatusMessage('Saving to disk...');

    try {
      const offscreen = document.createElement('canvas');
      offscreen.width = baseImage.width;
      offscreen.height = baseImage.height;
      const oCtx = offscreen.getContext('2d');
      if (!oCtx) throw new Error('Could not create offscreen context');
      
      // Bake the CSS filters into the final pixels output
      oCtx.filter = buildCSSFilterString(filters);
      oCtx.drawImage(baseImage, 0, 0);

      // Create blob from baked canvas
      const blob = await new Promise<Blob | null>((resolve) => {
        offscreen.toBlob((b) => resolve(b), contentType, 0.95);
      });

      if (!blob) throw new Error('Failed to generate image blob');

      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Overwrite the file on disk
      // We explicitly bypass writeExplorerFile for local paths because converting a
      // large Uint8Array to number[] causes massive JSON IPC stringification lag/crashes!
      if (imagePath.startsWith('cloud://')) {
        await writeExplorerFile(imagePath, Array.from(uint8Array));
      } else {
        await writeFile(imagePath, uint8Array);
      }
      
      // Keep changes baked into a new base image, reset filters
      const objectUrl = URL.createObjectURL(blob);
      const newImg = new Image();
      newImg.onload = () => {
        setBaseImage(newImg);
        setFilters(createDefaultImageFiltersState());
        URL.revokeObjectURL(objectUrl);
        
        setSaveState('saved');
        setStatusMessage('Saved successfully');
        setTimeout(() => {
          setSaveState('idle');
          setStatusMessage('');
        }, 3000);
      };
      newImg.src = objectUrl;

      await onSaved?.();
    } catch (e) {
      console.error('ExplorerImageEditor: save failed', e);
      setSaveState('error');
      setStatusMessage(String(e));
    }
  };

  const startCropping = () => {
    if (!baseImage || isCropping) return;
    setIsCropping(true);

    // Wait a tick for the cropper container to be un-hidden, then init
    setTimeout(() => {
      const imgTarget = cropperImageRef.current;
      if (!imgTarget) return;

      // We crop the structurally "raw" image but visually show the CSS filters
      imgTarget.src = baseImage.src;
      imgTarget.style.filter = buildCSSFilterString(filters);

      cropperRef.current = new Cropper(imgTarget, {
        viewMode: 2,
        background: false,
        autoCropArea: 0.9,
        responsive: true,
        restore: false,
      });
    }, 0);
  };

  const cancelCropping = () => {
    if (cropperRef.current) {
      cropperRef.current.destroy();
      cropperRef.current = null;
    }
    setIsCropping(false);
  };

  const applyCropping = () => {
    if (!cropperRef.current) return;

    const croppedCanvas = cropperRef.current.getCroppedCanvas({
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
    });

    const newImg = new Image();
    newImg.onload = () => {
      setBaseImage(newImg);
      cancelCropping();
      setSaveState('dirty');
      setStatusMessage('Unsaved crop changes');
    };
    newImg.src = croppedCanvas.toDataURL(contentType ?? 'image/png');
  };

  // Status/Preview Tone styling
  const statusTone =
    saveState === 'error' ? '#fca5a5' :
    saveState === 'saving' ? '#93c5fd' :
    saveState === 'dirty' ? '#fde047' :
    saveState === 'saved' ? '#86efac' :
    'transparent';

  // Unsupported formats fallback
  if (!isEditableFormat) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'radial-gradient(circle at top, rgba(255,255,255,0.08), transparent 50%), var(--overlay-explorer-preview-bg)' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--overlay-explorer-preview-border)', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--overlay-text-primary)' }}>Static image preview</span>
            <span style={{ fontSize: 10, color: 'var(--overlay-text-muted)' }}>Live editor is available for PNG, JPG, and WebP files.</span>
          </div>
          <span style={{ padding: '4px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, color: 'var(--overlay-text-muted)', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }}>
            {getImageExtension(imageName).toUpperCase() || 'IMAGE'}
          </span>
        </div>
        <div style={{ flex: 1, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box' }}>
          <img src={imageSource} alt={imageName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 'var(--overlay-explorer-control-radius)', boxShadow: '0 4px 24px rgba(0,0,0,0.6)' }} />
        </div>
      </div>
    );
  }

  const checkerboardCSS = `
    linear-gradient(45deg, rgba(255,255,255,0.02) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(255,255,255,0.02) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.02) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.02) 75%)
  `;

  return (
    <>
    <style>{PREMIUM_SLIDER_STYLES}</style>
    <div
      ref={rootRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: 'var(--overlay-explorer-preview-bg, #111827)'
      }}
    >
      {/* Top Main Workspace */}
      <div 
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          minHeight: '40%',
          borderBottom: '1px solid var(--overlay-explorer-preview-border, rgba(255,255,255,0.1))',
          backgroundImage: checkerboardCSS,
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
          backgroundColor: 'rgba(0,0,0,0.4)',
        }}
      >
        {!baseImage && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--overlay-text-muted)' }}>
            <ImageIcon size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Loading image...</span>
          </div>
        )}

        {/* GPU-Accelerated Hardware Preview Layer */}
        {!isCropping && baseImage && (
          <img
            src={baseImage.src}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: 4,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              filter: buildCSSFilterString(filters),
              willChange: 'filter',       // Forces dedicated composite layer
              transform: 'translateZ(0)', // Guards against Safari/WebKit rendering hiccups
            }}
            alt="Hardware Preview"
          />
        )}

        {/* Crop Mode */}
        <div style={{
          display: isCropping ? 'flex' : 'none',
          width: '100%',
          height: '100%',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <img
            ref={cropperImageRef}
            style={{ maxWidth: '100%', maxHeight: '100%' }}
            alt="cropper interface"
          />
        </div>
      </div>

      {/* Bottom Compact Controls */}
      <div style={{
        width: '100%',
        maxHeight: '55%',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        background: 'var(--overlay-explorer-preview-bg, #1f2937)'
      }}>
        {/* Sticky Toolbar */}
        <div style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--overlay-explorer-preview-border, rgba(255,255,255,0.08))',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 20
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button disabled={isCropping || !baseImage} onClick={() => void saveImage()} style={{...buttonStyle('primary'), opacity: (isCropping || !baseImage) ? 0.5 : 1}}>
              <Save size={13} />
              Save
            </button>
            <button disabled={isCropping} onClick={handleReset} style={{...buttonStyle('default'), opacity: isCropping ? 0.5 : 1}}>
              <RotateCcw size={13} />
              Reset All
            </button>
            <button disabled={isCropping} onClick={startCropping} style={{...buttonStyle('default'), opacity: isCropping ? 0.5 : 1}}>
              <Crop size={13} />
              Crop Tool
            </button>
          </div>
          
          {statusMessage && (
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              color: statusTone,
              padding: '4px 8px',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: 4,
              border: `1px solid ${statusTone}40`
            }}>
              {statusMessage}
            </div>
          )}
        </div>

        {/* Tools Body */}
        <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            {/* Standard Filter section (hidden during crop) */}
            <div style={{ display: isCropping ? 'none' : 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                fontSize: 10,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--overlay-text-muted)',
                paddingBottom: 4,
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}>
                Adjustments
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px 24px' }}>
                {imageEditorFilterDefinitions.map((def) => (
                  <PremiumSlider 
                    key={def.key} 
                    def={def} 
                    value={filters[def.key]} 
                    onChange={(val) => setFilters(prev => ({ ...prev, [def.key]: val }))} 
                  />
                ))}
              </div>
            </div>

            {/* Crop section (shown during crop) */}
            <div style={{ display: isCropping ? 'flex' : 'none', flexDirection: 'column', gap: 12 }}>
              <div style={{
                fontSize: 10,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--overlay-text-muted)',
                paddingBottom: 4,
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}>
                Crop & Rotate Tools
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => cropperRef.current?.setAspectRatio(NaN)} style={buttonStyle('default')}>Free</button>
                <button onClick={() => cropperRef.current?.setAspectRatio(1)} style={buttonStyle('default')}>1:1</button>
                <button onClick={() => cropperRef.current?.setAspectRatio(4/3)} style={buttonStyle('default')}>4:3</button>
                <button onClick={() => cropperRef.current?.setAspectRatio(16/9)} style={buttonStyle('default')}>16:9</button>
                
                <div style={{ width: 1, background: 'rgba(255,255,255,0.1)', margin: '0 8px' }} />

                <button onClick={() => cropperRef.current?.rotate(-90)} style={buttonStyle('default')}>
                  <ArrowUpLeft size={13} /> Left
                </button>
                <button onClick={() => cropperRef.current?.rotate(90)} style={buttonStyle('default')}>
                  <ArrowUpRight size={13} /> Right
                </button>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button onClick={cancelCropping} style={buttonStyle('danger')}>
                  <X size={13} /> Cancel
                </button>
                <button onClick={applyCropping} style={buttonStyle('primary')}>
                  <Check size={13} /> Apply Crop
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
    </>
  );
}
