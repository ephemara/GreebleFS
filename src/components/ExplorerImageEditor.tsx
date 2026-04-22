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
} from '@/components/AppIcons';
import { writeFile } from '@tauri-apps/plugin-fs';
import { useSettingsStore } from '../store/settingsStore';
import { matchesKeybinding } from '../config/hotkeys';
import { writeExplorerFile } from '../runtime/explorerBackend';
import { OverlayScrollArea } from './OverlayScrollArea';
import { PremiumSlider as PremiumSliderControl } from './PremiumSlider';
import {
  imageEditorFilterDefinitions,
  createDefaultImageFiltersState,
  buildCSSFilterString,
  type ExplorerImageFiltersState,
} from '../config/imageEditorFilters';
import { getImageEditorContentType } from '../config/filePreview';

type ExplorerImageEditorProps = {
  imagePath: string;
  imageName: string;
  imageSource: string; // Base64 data URI
  mode?: 'preview' | 'edit';
  onSaved?: () => Promise<void> | void;
};

type ImageEditorSaveState = 'idle' | 'saving' | 'dirty' | 'saved' | 'error';

type ImagePreviewTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

const DEFAULT_IMAGE_PREVIEW_TRANSFORM: ImagePreviewTransform = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

const IMAGE_PREVIEW_MIN_SCALE = 0.5;
const IMAGE_PREVIEW_MAX_SCALE = 6;
const IMAGE_PREVIEW_ZOOM_SENSITIVITY = 0.0015;

function clampValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeImagePreviewTransform(
  transform: ImagePreviewTransform,
  viewport: HTMLDivElement | null,
  image: HTMLImageElement | null,
): ImagePreviewTransform {
  const nextScale = Number(
    clampValue(transform.scale, IMAGE_PREVIEW_MIN_SCALE, IMAGE_PREVIEW_MAX_SCALE).toFixed(2),
  );

  if (!viewport || !image) {
    return {
      scale: nextScale,
      offsetX: Number(transform.offsetX.toFixed(2)),
      offsetY: Number(transform.offsetY.toFixed(2)),
    };
  }

  const viewportWidth = viewport.clientWidth;
  const viewportHeight = viewport.clientHeight;
  const baseWidth = image.clientWidth;
  const baseHeight = image.clientHeight;

  if (viewportWidth <= 0 || viewportHeight <= 0 || baseWidth <= 0 || baseHeight <= 0) {
    return {
      scale: nextScale,
      offsetX: Number(transform.offsetX.toFixed(2)),
      offsetY: Number(transform.offsetY.toFixed(2)),
    };
  }

  const scaledWidth = baseWidth * nextScale;
  const scaledHeight = baseHeight * nextScale;
  const maxOffsetX = Math.max(0, (scaledWidth - viewportWidth) / 2);
  const maxOffsetY = Math.max(0, (scaledHeight - viewportHeight) / 2);

  return {
    scale: nextScale,
    offsetX: Number(clampValue(transform.offsetX, -maxOffsetX, maxOffsetX).toFixed(2)),
    offsetY: Number(clampValue(transform.offsetY, -maxOffsetY, maxOffsetY).toFixed(2)),
  };
}

function getImageExtension(name: string): string {
  return name.trim().split('.').pop()?.toLowerCase() ?? '';
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

function ImageFilterSlider({
  def,
  value,
  onChange
}: { 
  def: import('../config/imageEditorFilters').ImageEditorFilterDefinition; 
  value: number; 
  onChange: (val: number) => void;
}) {
  const isDefault = value === def.default;
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 600, color: isDefault ? 'var(--overlay-text-muted)' : '#f8fafc', transition: 'color 0.2s ease' }}>
        <label style={{ letterSpacing: '0.02em' }}>{def.label}</label>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}{def.unit}</span>
      </div>
      <div style={{ padding: '6px 0', display: 'flex', alignItems: 'center' }}>
        <PremiumSliderControl
          ariaLabel={def.label}
          ariaValueText={`${value}${def.unit}`}
          min={def.min}
          max={def.max}
          step={def.step}
          value={value}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

export function ExplorerImageEditor({
  imagePath,
  imageName,
  imageSource,
  mode = 'edit',
  onSaved,
}: ExplorerImageEditorProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const previewImageRef = useRef<HTMLImageElement | null>(null);
  const cropperImageRef = useRef<HTMLImageElement | null>(null);
  const cropperRef = useRef<Cropper | null>(null);
  
  const [baseImage, setBaseImage] = useState<HTMLImageElement | null>(null);
  const [filters, setFilters] = useState<ExplorerImageFiltersState>(createDefaultImageFiltersState());
  const [previewTransform, setPreviewTransform] = useState<ImagePreviewTransform>(
    DEFAULT_IMAGE_PREVIEW_TRANSFORM,
  );
  const [isPreviewDragging, setIsPreviewDragging] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [saveState, setSaveState] = useState<ImageEditorSaveState>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  
  const contentType = getImageEditorContentType(getImageExtension(imageName));
  const isEditableFormat = contentType !== null;
  const showEditingChrome = mode === 'edit' && isEditableFormat;
  const keybindings = useSettingsStore((state) => state.settings.keybindings);

  // Initialize Base Image
  useEffect(() => {
    if (!isEditableFormat) return;
    
    // Clear state on path change
    setBaseImage(null);
    setFilters(createDefaultImageFiltersState());
    setPreviewTransform(DEFAULT_IMAGE_PREVIEW_TRANSFORM);
    setIsPreviewDragging(false);
    setIsCropping(false);
    setSaveState('idle');
    setStatusMessage('');

    const img = new Image();
    img.onload = () => {
      setBaseImage(img);
      setPreviewTransform(DEFAULT_IMAGE_PREVIEW_TRANSFORM);
      setIsPreviewDragging(false);
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
      if (!showEditingChrome) return;

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
  }, [keybindings, isCropping, isEditableFormat, baseImage, filters, showEditingChrome]);

  useEffect(() => {
    if (!showEditingChrome && isCropping) {
      cropperRef.current?.destroy();
      cropperRef.current = null;
      setIsCropping(false);
    }
  }, [isCropping, showEditingChrome]);

  // Actions
  const resetPreviewViewport = () => {
    setPreviewTransform(DEFAULT_IMAGE_PREVIEW_TRANSFORM);
    setIsPreviewDragging(false);
  };

  const handleReset = () => {
    setFilters(createDefaultImageFiltersState());
    resetPreviewViewport();
  };

  const saveImage = async () => {
    if (!showEditingChrome || !contentType || saveState === 'saving' || !baseImage) return;

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

      // Prefer the plugin fast path when the host registered it, but fall back to the
      // explorer backend so save still works in builds where the fs plugin is absent.
      if (imagePath.startsWith('cloud://')) {
        await writeExplorerFile(imagePath, Array.from(uint8Array));
      } else {
        try {
          await writeFile(imagePath, uint8Array);
        } catch {
          await writeExplorerFile(imagePath, Array.from(uint8Array));
        }
      }
      
      // Keep changes baked into a new base image, reset filters
      const objectUrl = URL.createObjectURL(blob);
      const newImg = new Image();
      newImg.onload = () => {
        setBaseImage(newImg);
        setFilters(createDefaultImageFiltersState());
        resetPreviewViewport();
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
    if (!showEditingChrome || !baseImage || isCropping) return;
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
      resetPreviewViewport();
      cancelCropping();
      setSaveState('dirty');
      setStatusMessage('Unsaved crop changes');
    };
    newImg.src = croppedCanvas.toDataURL(contentType ?? 'image/png');
  };

  const handlePreviewWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!baseImage || isCropping) return;

    const viewport = previewViewportRef.current;
    if (!viewport) return;

    event.preventDefault();
    event.stopPropagation();

    const zoomFactor = Math.exp(-event.deltaY * IMAGE_PREVIEW_ZOOM_SENSITIVITY);
    const viewportRect = viewport.getBoundingClientRect();
    const focusX = event.clientX - viewportRect.left - viewportRect.width / 2;
    const focusY = event.clientY - viewportRect.top - viewportRect.height / 2;

    setPreviewTransform((current) => {
      const nextScale = Number(
        clampValue(
          current.scale * zoomFactor,
          IMAGE_PREVIEW_MIN_SCALE,
          IMAGE_PREVIEW_MAX_SCALE,
        ).toFixed(2),
      );
      if (nextScale === current.scale) {
        return current;
      }

      const scaleRatio = nextScale / current.scale;
      return normalizeImagePreviewTransform(
        {
          scale: nextScale,
          offsetX: current.offsetX * scaleRatio + (1 - scaleRatio) * focusX,
          offsetY: current.offsetY * scaleRatio + (1 - scaleRatio) * focusY,
        },
        viewport,
        previewImageRef.current,
      );
    });
  };

  const handlePreviewMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!baseImage || isCropping || event.button !== 0) return;

    const viewport = previewViewportRef.current;
    if (!viewport) return;

    event.preventDefault();

    const startTransform = previewTransform;
    const startClientX = event.clientX;
    const startClientY = event.clientY;

    setIsPreviewDragging(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      setPreviewTransform(
        normalizeImagePreviewTransform(
          {
            scale: startTransform.scale,
            offsetX: startTransform.offsetX + (moveEvent.clientX - startClientX),
            offsetY: startTransform.offsetY + (moveEvent.clientY - startClientY),
          },
          viewport,
          previewImageRef.current,
        ),
      );
    };

    const stopDragging = () => {
      setIsPreviewDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopDragging);
      window.removeEventListener('blur', stopDragging);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopDragging);
    window.addEventListener('blur', stopDragging);
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
    <div
      ref={rootRef}
      data-testid="explorer-image-editor"
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
          minHeight: showEditingChrome ? '40%' : '100%',
          borderBottom: showEditingChrome
            ? '1px solid var(--overlay-explorer-preview-border, rgba(255,255,255,0.1))'
            : 'none',
          backgroundImage: checkerboardCSS,
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
          backgroundColor: 'rgba(0,0,0,0.4)',
        }}
      >
        {!isCropping && (
          <div
            ref={previewViewportRef}
            data-testid="explorer-image-editor-preview"
            onWheel={handlePreviewWheel}
            onMouseDown={handlePreviewMouseDown}
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
              userSelect: 'none',
              cursor: baseImage ? (isPreviewDragging ? 'grabbing' : 'grab') : 'default',
            }}
          >
            {!baseImage && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--overlay-text-muted)' }}>
                <ImageIcon size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>Loading image...</span>
              </div>
            )}

            {/* GPU-Accelerated Hardware Preview Layer */}
            {baseImage && (
              <img
                ref={previewImageRef}
                data-testid="explorer-image-editor-preview-image"
                src={baseImage.src}
                draggable={false}
                onDragStart={(event) => event.preventDefault()}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  borderRadius: 4,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  filter: buildCSSFilterString(filters),
                  transform: `translate(${previewTransform.offsetX}px, ${previewTransform.offsetY}px) scale(${previewTransform.scale})`,
                  transformOrigin: 'center center',
                  willChange: 'transform, filter',
                }}
                alt="Hardware Preview"
              />
            )}

            {baseImage && (
              <div
                data-testid="explorer-image-editor-preview-zoom"
                style={{
                  position: 'absolute',
                  right: 12,
                  bottom: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: 'rgba(10, 14, 24, 0.58)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.24)',
                  color: 'var(--overlay-text-primary)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.03em',
                  pointerEvents: 'none',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <span style={{ opacity: 0.72 }}>Preview</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(previewTransform.scale * 100)}%</span>
              </div>
            )}
          </div>
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

      {showEditingChrome && (
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
          <OverlayScrollArea
            style={{ flex: 1, minHeight: 0 }}
            viewportStyle={{ padding: '16px' }}
            scrollbarStyle="themed"
          >
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
                    <ImageFilterSlider
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
          </OverlayScrollArea>
        </div>
      )}
    </div>
    </>
  );
}
