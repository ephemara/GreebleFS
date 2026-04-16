import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockState } = vi.hoisted(() => ({
  mockState: {
    instances: [] as Array<{
      canvasId: string
      destroy: ReturnType<typeof vi.fn>
      destroySpy: ReturnType<typeof vi.fn>
      options: Record<string, unknown>
    }>
  }
}))

vi.mock('./editor', () => ({
  ImageEditor: class MockImageEditor {
    public destroySpy = vi.fn()
    public destroy = this.destroySpy
    public canvasId: string
    public options: Record<string, unknown>

    constructor(canvasId: string, options: Record<string, unknown>) {
      this.canvasId = canvasId
      this.options = options
      mockState.instances.push(this)
    }
  }
}))

describe('img-editor initEditor', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="editor-host"></div>'
    mockState.instances.length = 0
  })

  it('destroys a pending editor before reinitializing the same container', async () => {
    const { default: initEditor } = await import('./main')

    const firstInitPromise = initEditor('editor-host')
    const firstEditor = mockState.instances[0]
    const handledFirstInitPromise = firstInitPromise.catch((error) => error)

    const secondInitPromise = initEditor('editor-host')
    const secondEditor = mockState.instances[1]

    expect(firstEditor.destroySpy).toHaveBeenCalledTimes(1)
    expect(firstEditor.canvasId).not.toBe(secondEditor.canvasId)
    expect(document.querySelectorAll('#editor-host canvas')).toHaveLength(1)

    ;(secondEditor.options._onReadyCallback as (editor: unknown) => void)(secondEditor)

    await expect(handledFirstInitPromise).resolves.toMatchObject({
      message: expect.stringContaining('destroyed before it finished initializing')
    })
    await expect(secondInitPromise).resolves.toBe(secondEditor)
  })
})
