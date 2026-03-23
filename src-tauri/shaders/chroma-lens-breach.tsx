import React, { useEffect, useRef } from 'react';
import { defineShader } from 'overlayterm-shader';

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('Unable to allocate shader.');
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || 'Shader compile failure';
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) {
    throw new Error('Unable to allocate shader program.');
  }
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) || 'Program link failure';
    gl.deleteProgram(program);
    throw new Error(log);
  }
  return program;
}

function parseAccent(color: string): [number, number, number] {
  const accent = color.startsWith('#') ? color : '#66ccff';
  if (accent.length !== 7) {
    return [0.4, 0.8, 1.0];
  }
  return [
    parseInt(accent.slice(1, 3), 16) / 255,
    parseInt(accent.slice(3, 5), 16) / 255,
    parseInt(accent.slice(5, 7), 16) / 255,
  ];
}

function ChromaLensBreachSurface({ context }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef(context);
  contextRef.current = context;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
    });
    if (!gl) {
      return;
    }

    const vertexSource = `
      attribute vec2 aPosition;
      varying vec2 vUv;
      void main() {
        vUv = aPosition * 0.5 + 0.5;
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const fragmentSource = `
      precision mediump float;
      varying vec2 vUv;
      uniform vec2 uResolution;
      uniform float uTime;
      uniform vec3 uAccent;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float lensAt(vec2 p, float scale) {
        return 1.0 / (1.0 + dot(p, p) * scale);
      }

      void main() {
        vec2 uv = vUv;
        vec2 p = uv * 2.0 - 1.0;
        p.x *= uResolution.x / max(uResolution.y, 1.0);
        float pulse = 0.5 + 0.5 * sin(uTime * 0.82);
        vec2 dir = normalize(p + vec2(0.001, 0.002));
        vec2 chromaShift = dir * (0.008 + pulse * 0.014);

        float lensR = lensAt(p - chromaShift * 1.4, 2.0);
        float lensG = lensAt(p, 2.1);
        float lensB = lensAt(p + chromaShift * 1.7, 2.35);
        float ringR = abs(sin(length(p - chromaShift * 0.8) * 12.0 - uTime * 2.1));
        float ringG = abs(sin(length(p) * 12.6 - uTime * 2.4));
        float ringB = abs(sin(length(p + chromaShift * 0.9) * 13.2 - uTime * 2.7));
        float ripple = smoothstep(0.92, 0.08, abs(length(p) - 0.42 - sin(uTime * 0.7) * 0.03));
        float flare = smoothstep(0.48, 0.04, abs(p.x * 0.85 + p.y * 0.35));
        float noise = hash(floor(uv * uResolution * 0.32) + floor(uTime * 4.0));

        vec3 color = vec3(lensR, lensG, lensB);
        color += vec3(ringR * 0.18, ringG * 0.12, ringB * 0.22);
        color += vec3(0.16, 0.34, 0.68) * ripple * 0.18;
        color += vec3(0.92, 0.96, 1.0) * flare * 0.06;
        color *= vec3(0.82, 0.92, 1.08) + uAccent * vec3(0.14, 0.18, 0.24);
        color += vec3(noise * 0.03);

        float alpha = clamp((lensG * 0.42 + ripple * 0.34 + flare * 0.14) * (0.7 + pulse * 0.22), 0.0, 1.0);
        gl_FragColor = vec4(color, alpha);
      }
    `;

    const program = createProgram(gl, vertexSource, fragmentSource);
    const quad = gl.createBuffer();
    if (!quad) {
      gl.deleteProgram(program);
      return;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'aPosition');
    const resolutionLocation = gl.getUniformLocation(program, 'uResolution');
    const timeLocation = gl.getUniformLocation(program, 'uTime');
    const accentLocation = gl.getUniformLocation(program, 'uAccent');
    let raf = 0;

    const render = (now: number) => {
      const liveContext = contextRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform1f(timeLocation, now * 0.001);
      const accent = parseAccent(liveContext.accentColor);
      gl.uniform3f(accentLocation, accent[0], accent[1], accent[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = window.requestAnimationFrame(render);
    };

    raf = window.requestAnimationFrame(render);
    return () => {
      window.cancelAnimationFrame(raf);
      gl.deleteProgram(program);
      gl.deleteBuffer(quad);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />;
}

export default defineShader({
  name: 'Chroma Lens Breach',
  description: 'A prismatic lens field with chromatic aberration, circular caustics, and a forward-pressing glass breach.',
  group: 'Shader Lab',
  tags: ['shader', 'lens', 'chromatic', 'breach', 'webgl'],
  background: {
    render: ChromaLensBreachSurface,
    resolveStyle: () => ({
      mixBlendMode: 'screen',
      opacity: 0.92,
    }),
  },
});
