import { CanvasOptions } from 'fabric'
import { ImageEditor } from './editor'
import { defaults } from './editor/defaults'

const activeEditorByContainerId = new Map<string, ImageEditor>()
let editorCanvasSequence = 0

function clearEditorWindowHandle(containerId: string, editor: ImageEditor): void {
  const globalWindow = window as Record<string, unknown>
  if (activeEditorByContainerId.get(containerId) === editor) {
    activeEditorByContainerId.delete(containerId)
  }
  if (globalWindow[containerId] === editor) {
    delete globalWindow[containerId]
  }
}

function destroyActiveEditorForContainer(containerId: string): void {
  activeEditorByContainerId.get(containerId)?.destroy()
}

/**
 * Инициализирует редактор, создавая канвас внутри контейнера.
 *
 * @param containerId — ID контейнера, в котором будут созданы оба канваса.
 * @param options — опции и настройки.
 */
export default function initEditor(containerId:string, options:Partial<CanvasOptions> = {}): Promise<ImageEditor> {
  const adjustedOptions:CanvasOptions = { ...defaults, ...options } as CanvasOptions

  // Находим контейнер по ID.
  const container = document.getElementById(containerId)
  if (!container) {
    return Promise.reject(new Error(`Editor container "${containerId}" was not found.`))
  }

  destroyActiveEditorForContainer(containerId)
  container.innerHTML = ''

  // Создаём канвас
  const editorCanvas = document.createElement('canvas')
  editorCanvas.id = `${containerId}-canvas-${editorCanvasSequence}`
  editorCanvasSequence += 1
  container.appendChild(editorCanvas)

  // Сохраняем контейнер в опциях
  adjustedOptions.editorContainer = container

  return new Promise((resolve, reject) => {
    let initSettled = false
    adjustedOptions._onReadyCallback = (editor: ImageEditor) => {
      if (activeEditorByContainerId.get(containerId) !== editor) {
        if (!initSettled) {
          initSettled = true
          reject(new Error(`Editor container "${containerId}" was superseded by a newer editor session.`))
        }
        editor.destroy()
        return
      }

      initSettled = true
      resolve(editor)
    }

    const editorInstance = new ImageEditor(editorCanvas.id, adjustedOptions)
    const originalDestroy = editorInstance.destroy.bind(editorInstance)
    editorInstance.destroy = () => {
      clearEditorWindowHandle(containerId, editorInstance)
      originalDestroy()

      if (!initSettled) {
        initSettled = true
        reject(new Error(`Editor container "${containerId}" was destroyed before it finished initializing.`))
      }
    }

    activeEditorByContainerId.set(containerId, editorInstance)
    ;(window as Record<string, unknown>)[containerId] = editorInstance
  })
}
