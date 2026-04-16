import { describe, expect, it } from 'vitest';
import {
  EXPLORER_AUDIO_EXPORT_FORMATS,
  getAudioPreviewMimeType,
  getExplorerAudioExportFormatDefinition,
  getModelPreviewFormat,
  getMonacoLanguage,
  getVideoPreviewMimeType,
  isDirectAudioPreviewExtension,
  isAudioPreviewExtension,
  isEditableTextExtension,
  isExecutableExtension,
  isImagePreviewExtension,
  isVideoPreviewExtension,
} from '../config/filePreview';

describe('filePreview config', () => {
  it('detects image preview extensions', () => {
    expect(isImagePreviewExtension('png')).toBe(true);
    expect(isImagePreviewExtension('.webp')).toBe(true);
    expect(isImagePreviewExtension('obj')).toBe(false);
  });

  it('detects executable extensions', () => {
    expect(isExecutableExtension('exe')).toBe(true);
    expect(isExecutableExtension('ps1')).toBe(true);
    expect(isExecutableExtension('glb')).toBe(false);
  });

  it('detects audio preview extensions and maps their mime types', () => {
    expect(isAudioPreviewExtension('mp3')).toBe(true);
    expect(isAudioPreviewExtension('.opus')).toBe(true);
    expect(isAudioPreviewExtension('txt')).toBe(false);
    expect(getAudioPreviewMimeType('m4a')).toBe('audio/mp4');
    expect(getAudioPreviewMimeType('weba')).toBe('audio/webm');
    expect(getAudioPreviewMimeType('txt')).toBeNull();
  });

  it('keeps audio export formats and direct-playback hints data-driven', () => {
    expect(EXPLORER_AUDIO_EXPORT_FORMATS.map((format) => format.id)).toEqual(['mp3', 'wav', 'flac', 'ogg']);
    expect(getExplorerAudioExportFormatDefinition('wav')?.mimeType).toBe('audio/wav');
    expect(getExplorerAudioExportFormatDefinition('txt')).toBeNull();
    expect(isDirectAudioPreviewExtension('mp3')).toBe(true);
    expect(isDirectAudioPreviewExtension('wma')).toBe(false);
  });

  it('detects video preview extensions and maps their mime types', () => {
    expect(isVideoPreviewExtension('mp4')).toBe(true);
    expect(isVideoPreviewExtension('.mkv')).toBe(true);
    expect(isVideoPreviewExtension('txt')).toBe(false);
    expect(getVideoPreviewMimeType('mov')).toBe('video/quicktime');
    expect(getVideoPreviewMimeType('webm')).toBe('video/webm');
    expect(getVideoPreviewMimeType('txt')).toBeNull();
  });

  it('maps supported 3d extensions to model formats', () => {
    expect(getModelPreviewFormat('fbx')).toBe('fbx');
    expect(getModelPreviewFormat('glb')).toBe('glb');
    expect(getModelPreviewFormat('.gltf')).toBe('gltf');
    expect(getModelPreviewFormat('obj')).toBe('obj');
    expect(getModelPreviewFormat('stl')).toBe('stl');
    expect(getModelPreviewFormat('png')).toBeNull();
  });

  it('keeps 3d assets out of editable text mode even when small', () => {
    expect(isEditableTextExtension('obj', 1024)).toBe(false);
    expect(isEditableTextExtension('fbx', 1024)).toBe(false);
    expect(isEditableTextExtension('glb', 1024)).toBe(false);
  });

  it('keeps audio assets out of editable text mode even when small', () => {
    expect(isEditableTextExtension('mp3', 1024)).toBe(false);
    expect(isEditableTextExtension('flac', 1024)).toBe(false);
    expect(isEditableTextExtension('opus', 1024)).toBe(false);
  });

  it('keeps video assets out of editable text mode even when small', () => {
    expect(isEditableTextExtension('mp4', 1024)).toBe(false);
    expect(isEditableTextExtension('mkv', 1024)).toBe(false);
    expect(isEditableTextExtension('mov', 1024)).toBe(false);
  });

  it('still allows normal source files to open in the editor', () => {
    expect(isEditableTextExtension('ts', 1024)).toBe(true);
    expect(isEditableTextExtension('txt', 1024)).toBe(true);
    expect(isEditableTextExtension('', 1024)).toBe(true);
  });

  it('returns monaco language hints with sensible fallbacks', () => {
    expect(getMonacoLanguage('ts')).toBe('typescript');
    expect(getMonacoLanguage('wgsl')).toBe('wgsl');
    expect(getMonacoLanguage('obj')).toBe('plaintext');
    expect(getMonacoLanguage('')).toBe('plaintext');
  });
});
