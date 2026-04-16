import { describe, expect, it, vi } from 'vitest'
import ToolbarManager from '.'

describe('ToolbarManager.destroy', () => {
  it('is a no-op when the toolbar is disabled and no DOM element was created', () => {
    const canvas = {
      on: vi.fn(),
      off: vi.fn(),
      wrapperEl: document.createElement('div')
    }

    const editor = {
      canvas,
      options: {
        showToolbar: false
      }
    }

    const toolbarManager = new ToolbarManager({
      editor: editor as never
    })

    expect(() => toolbarManager.destroy()).not.toThrow()
    expect(canvas.off).not.toHaveBeenCalled()
  })
})
