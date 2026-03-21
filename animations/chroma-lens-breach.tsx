import React, { useEffect, useRef } from 'react';
import { clamp01, defineAnimation, lerp } from 'overlayterm-animation';

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

function createProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
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

function ChromaLensBreach({ context }: { context: any }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
      uniform float uProgress;
      uniform float uDirection;
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
        float progress = uDirection < 0.5 ? uProgress : 1.0 - uProgress;
        vec2 dir = normalize(p + vec2(0.001, 0.002));
        vec2 chromaShift = dir * (0.010 + progress * 0.016);

        float lensR = lensAt(p - chromaShift * 1.4, 2.0);
        float lensG = lensAt(p, 2.1);
        float lensB = lensAt(p + chromaShift * 1.7, 2.35);
        float ringR = abs(sin(length(p - chromaShift * 0.8) * 12.0 - uTime * 2.1 + progress * 4.0));
        float ringG = abs(sin(length(p) * 12.6 - uTime * 2.4 + progress * 4.2));
        float ringB = abs(sin(length(p + chromaShift * 0.9) * 13.2 - uTime * 2.7 + progress * 4.5));
        float ripple = smoothstep(0.92, 0.08, abs(length(p) - 0.42 - sin(uTime * 0.7) * 0.03));
        float flare = smoothstep(0.48, 0.04, abs(p.x * 0.85 + p.y * 0.35));
        float noise = hash(floor(uv * uResolution * 0.32) + floor(uTime * 4.0));

        vec3 color = vec3(lensR, lensG, lensB);
        color += vec3(ringR * 0.18, ringG * 0.12, ringB * 0.22);
        color += vec3(0.16, 0.34, 0.68) * ripple * 0.18;
        color += vec3(0.92, 0.96, 1.0) * flare * 0.06;
        color *= vec3(0.82, 0.92, 1.08) + uAccent * vec3(0.14, 0.18, 0.24);
        color += vec3(noise * 0.03);

        float alpha = clamp((lensG * 0.42 + ripple * 0.34 + flare * 0.14) * (0.72 + progress * 0.24), 0.0, 1.0);
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
    const progressLocation = gl.getUniformLocation(program, 'uProgress');
    const directionLocation = gl.getUniformLocation(program, 'uDirection');
    const accentLocation = gl.getUniformLocation(program, 'uAccent');

    let raf = 0;
    const render = (now: number) => {
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
      gl.uniform1f(progressLocation, clamp01(context.progress));
      gl.uniform1f(directionLocation, context.direction === 'enter' ? 0 : 1);

      const accent = context.accentColor.startsWith('#')
        ? context.accentColor
        : '#66ccff';
      const parsed = accent.length === 7
        ? [
            parseInt(accent.slice(1, 3), 16) / 255,
            parseInt(accent.slice(3, 5), 16) / 255,
            parseInt(accent.slice(5, 7), 16) / 255,
          ]
        : [0.4, 0.8, 1.0];
      gl.uniform3f(accentLocation, parsed[0], parsed[1], parsed[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      raf = window.requestAnimationFrame(render);
    };

    raf = window.requestAnimationFrame(render);
    return () => {
      window.cancelAnimationFrame(raf);
      gl.deleteProgram(program);
      gl.deleteBuffer(quad);
    };
  }, [context.accentColor, context.direction, context.progress]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        mixBlendMode: 'screen',
        opacity: 0.92,
      }}
    />
  );
}

function shellStyle(context: any, direction: 'enter' | 'exit') {
  const progress = clamp01(context.progress);
  const signed = context.verticalOrigin === 'top' ? -1 : 1;
  const active = direction === 'enter' ? progress : 1 - progress;

  return {
    transform: `perspective(1350px) translate3d(0, ${lerp(26, 0, active) * signed}px, 0) scale(${direction === 'enter' ? lerp(0.78, 1, active) : lerp(1, 0.82, progress)}) rotateY(${direction === 'enter' ? lerp(-16, 0, active) : lerp(0, 14, progress)}deg)`,
    opacity: context.baseOpacity * (direction === 'enter' ? active : 1 - progress),
    filter: `blur(${direction === 'enter' ? lerp(18, 0, active) : lerp(0, 18, progress)}px) saturate(${direction === 'enter' ? lerp(0.68, 1.08, active) : lerp(1.08, 0.64, progress)}) brightness(${direction === 'enter' ? lerp(0.82, 1, active) : lerp(1, 0.72, progress)})`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineAnimation({
  name: 'Chroma Lens Breach',
  description: 'A prismatic lens fracture with chromatic aberration, circular caustics, and a forward-pressing shell warp.',
  group: 'Showcase',
  tags: ['lens', 'chromatic', 'breach', 'webgl'],
  open: {
    resolveShellStyle: context => shellStyle(context, 'enter'),
    renderOverlay: ChromaLensBreach,
  },
  close: {
    resolveShellStyle: context => shellStyle(context, 'exit'),
    renderOverlay: ChromaLensBreach,
  },
});
