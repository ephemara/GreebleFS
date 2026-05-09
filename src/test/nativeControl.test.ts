import { beforeEach, describe, expect, it, vi } from 'vitest'

const nativeControlMock = vi.hoisted(() => ({
  available: false,
  isNativeControlAvailable: vi.fn(() => nativeControlMock.available),
  nativeCall: vi.fn(),
  nativeControlCapabilities: vi.fn()
}))

vi.mock('@tauri-apps/api/native-control', () => ({
  isNativeControlAvailable: nativeControlMock.isNativeControlAvailable,
  nativeCall: nativeControlMock.nativeCall,
  nativeControlCapabilities: nativeControlMock.nativeControlCapabilities
}))

describe('nativeControl runtime', () => {
  beforeEach(() => {
    nativeControlMock.available = false
    nativeControlMock.isNativeControlAvailable.mockClear()
    nativeControlMock.nativeCall.mockReset()
    nativeControlMock.nativeControlCapabilities.mockReset()
  })

  it('reports native control availability from Tauron', async () => {
    const { isGreebleNativeControlAvailable } = await import('../runtime/nativeControl')

    nativeControlMock.available = true

    expect(isGreebleNativeControlAvailable()).toBe(true)
    expect(nativeControlMock.isNativeControlAvailable).toHaveBeenCalledTimes(1)
  })

  it('routes native calls without generated Tauri bindings', async () => {
    const { callGreebleNative } = await import('../runtime/nativeControl')
    nativeControlMock.nativeCall.mockResolvedValue({ entries: 3 })

    await expect(
      callGreebleNative('fs', 'listDir', { path: 'D:/Projects' }, { correlationId: 'scan-1' })
    ).resolves.toEqual({ entries: 3 })

    expect(nativeControlMock.nativeCall).toHaveBeenCalledWith(
      'fs',
      'listDir',
      { path: 'D:/Projects' },
      { correlationId: 'scan-1' }
    )
  })

  it('uses invoke fallbacks when native control is absent', async () => {
    const { callGreebleNativeWithInvokeFallback } = await import('../runtime/nativeControl')
    const fallback = vi.fn().mockResolvedValue({ ok: true })

    await expect(
      callGreebleNativeWithInvokeFallback('settings', 'status', undefined, fallback)
    ).resolves.toEqual({ ok: true })

    expect(nativeControlMock.nativeCall).not.toHaveBeenCalled()
    expect(fallback).toHaveBeenCalledTimes(1)
  })

  it('falls back after a native control call fails', async () => {
    const { callGreebleNativeWithInvokeFallback } = await import('../runtime/nativeControl')
    const fallback = vi.fn().mockResolvedValue({ recovered: true })
    nativeControlMock.available = true
    nativeControlMock.nativeCall.mockRejectedValue(new Error('native lane unavailable'))

    await expect(
      callGreebleNativeWithInvokeFallback('settings', 'status', { compact: true }, fallback)
    ).resolves.toEqual({ recovered: true })

    expect(nativeControlMock.nativeCall).toHaveBeenCalledWith(
      'settings',
      'status',
      { compact: true },
      {}
    )
    expect(fallback).toHaveBeenCalledTimes(1)
  })

  it('keeps capability probing centralized', async () => {
    const { getGreebleNativeControlCapabilities } = await import('../runtime/nativeControl')
    nativeControlMock.nativeControlCapabilities.mockResolvedValue({
      available: true,
      hostObject: 'tauronNativeControl',
      protocolVersion: 1,
      dataPlane: 'native-stream'
    })

    await expect(getGreebleNativeControlCapabilities()).resolves.toMatchObject({
      available: true,
      hostObject: 'tauronNativeControl'
    })
  })
})
