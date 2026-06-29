// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

;(function () {
  function uid() {
    return window.crypto.getRandomValues(new Uint32Array(1))[0]
  }

  const osName = __TEMPLATE_os_name__
  const protocolScheme = __TEMPLATE_protocol_scheme__
  const windowsDrivePathPattern = /^[a-zA-Z]:[\\/]/
  const FILE_PATH_KIND_DRIVE = '__TAURI_DRIVE__'
  const FILE_PATH_KIND_UNC = '__TAURI_UNC__'
  const FILE_PATH_KIND_ABSOLUTE = '__TAURI_ABSOLUTE__'
  const FILE_PATH_KIND_RELATIVE = '__TAURI_RELATIVE__'

  function resolveCustomProtocolUrl(path, protocol) {
    return osName === 'windows' || osName === 'android'
      ? `${protocolScheme}://${protocol}.localhost/${path}`
      : `${protocol}://localhost/${path}`
  }

  function encodeFilePathForProtocol(filePath, protocol) {
    if (protocol === 'ipc') {
      return encodeURIComponent(filePath)
    }

    const normalizedPath = String(filePath).replace(/\\/g, '/')
    let segments

    if (windowsDrivePathPattern.test(normalizedPath)) {
      segments = [
        FILE_PATH_KIND_DRIVE,
        normalizedPath[0].toUpperCase(),
        ...normalizedPath.slice(3).split('/').filter(Boolean)
      ]
    } else if (normalizedPath.startsWith('//')) {
      segments = [
        FILE_PATH_KIND_UNC,
        ...normalizedPath.slice(2).split('/').filter(Boolean)
      ]
    } else if (normalizedPath.startsWith('/')) {
      segments = [
        FILE_PATH_KIND_ABSOLUTE,
        ...normalizedPath.slice(1).split('/').filter(Boolean)
      ]
    } else {
      segments = [
        FILE_PATH_KIND_RELATIVE,
        ...normalizedPath.split('/').filter(Boolean)
      ]
    }

    return segments.map((segment) => encodeURIComponent(segment)).join('/')
  }

  Object.defineProperty(window.__TAURI_INTERNALS__, 'resolveCustomProtocolUrl', {
    value: resolveCustomProtocolUrl
  })

  Object.defineProperty(window.__TAURI_INTERNALS__, 'convertFileSrc', {
    value: function (filePath, protocol = 'asset') {
      const path = encodeFilePathForProtocol(filePath, protocol)
      return resolveCustomProtocolUrl(path, protocol)
    }
  })

  const callbacks = new Map()

  function registerCallback(callback, once) {
    const identifier = uid()
    callbacks.set(identifier, (data) => {
      if (once) {
        unregisterCallback(identifier)
      }
      return callback && callback(data)
    })
    return identifier
  }

  function unregisterCallback(id) {
    callbacks.delete(id)
  }

  function runCallback(id, data) {
    const callback = callbacks.get(id)
    if (callback) {
      callback(data)
    } else {
      console.warn(
        `[TAURI] Couldn't find callback id ${id}. This might happen when the app is reloaded while Rust is running an asynchronous operation.`
      )
    }
  }

  // Maybe let's rename it to `registerCallback`?
  Object.defineProperty(window.__TAURI_INTERNALS__, 'transformCallback', {
    value: registerCallback
  })

  Object.defineProperty(window.__TAURI_INTERNALS__, 'unregisterCallback', {
    value: unregisterCallback
  })

  Object.defineProperty(window.__TAURI_INTERNALS__, 'runCallback', {
    value: runCallback
  })

  // This is just for the debugging purposes
  Object.defineProperty(window.__TAURI_INTERNALS__, 'callbacks', {
    value: callbacks
  })

  const ipcQueue = []
  let isWaitingForIpc = false

  function waitForIpc() {
    if ('ipc' in window.__TAURI_INTERNALS__) {
      for (const action of ipcQueue) {
        action()
      }
    } else {
      setTimeout(waitForIpc, 50)
    }
  }

  Object.defineProperty(window.__TAURI_INTERNALS__, 'invoke', {
    value: function (cmd, payload = {}, options) {
      return new Promise(function (resolve, reject) {
        const callback = registerCallback((r) => {
          resolve(r)
          unregisterCallback(error)
        }, true)
        const error = registerCallback((e) => {
          reject(e)
          unregisterCallback(callback)
        }, true)

        const action = () => {
          window.__TAURI_INTERNALS__.ipc({
            cmd,
            callback,
            error,
            payload,
            options
          })
        }
        if ('ipc' in window.__TAURI_INTERNALS__) {
          action()
        } else {
          ipcQueue.push(action)
          if (!isWaitingForIpc) {
            waitForIpc()
            isWaitingForIpc = true
          }
        }
      })
    }
  })
})()
