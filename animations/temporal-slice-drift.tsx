import React, { useEffect, useRef } from 'react';
import { clamp01, defineAnimation, lerp } from 'overlayterm-animation';

function compileShader(gl, type, source) {
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

function createProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) {
    throw new Error('Unable to allocate program.');
  }
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

function parseAccent(color) {
  const hex = color.trim().match(/^#([0-9a-f]{3,8})$/i);
  if (!hex) {
    return [0.42, 0.72, 1];
  }

  const value = hex[1];
  const expand = input => parseInt(input.length === 1 ? input + input : input, 16) / 255;
  if (value.length === 3 || value.length === 4) {
    return [expand(value[0]), expand(value[1]), expand(value[2])];
  }

  return [
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
  ];
}

function TemporalSliceDriftLayer({ context }) {
  const canvasRef = useRef(null);

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
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float stripes(vec2 uv, float scale) {
        return smoothstep(0.92, 0.2, abs(fract(uv.y * scale) - 0.5));
      }

      void main() {
        vec2 uv = vUv;
        uv.x *= uResolution.x / max(uResolution.y, 1.0);

        float progress = uDirection < 0.5 ? uProgress : (1.0 - uProgress);
        float sliceCount = mix(16.0, 54.0, progress);
        float band = floor(uv.y * sliceCount + uTime * mix(2.0, 10.0, progress));
        float sliceDrift = (hash(vec2(band, floor(uTime * 3.0))) - 0.5) * (0.03 + progress * 0.12);
        float microJitter = (hash(vec2(band * 1.7, floor(uTime * 11.0))) - 0.5) * 0.012;
        float gate = smoothstep(0.1, 0.92, uv.y);

        uv.x += sliceDrift * gate;
        uv.x += microJitter * sin((uv.y + uTime * 0.14) * 64.0);
        uv.y += sin((uv.x + uTime * 0.4) * 10.0 + band * 0.34) * (0.002 + progress * 0.008);

        float center = smoothstep(0.52, 0.0, abs(uv.x - 0.5));
        float horizon = smoothstep(0.0, 0.28, uv.y) * smoothstep(1.0, 0.72, uv.y);
        float pulse = 0.5 + 0.5 * sin(uTime * 3.4 + band * 0.16);
        float scan = stripes(uv, sliceCount * 0.6);
        float glitch = step(0.94, hash(vec2(band, floor(uTime * 9.0))));

        vec3 cold = mix(vec3(0.03, 0.04, 0.08), uAccent, smoothstep(0.08, 0.96, uv.y));
        vec3 warm = vec3(1.0) * (0.08 + pulse * 0.08);
        vec3 color = cold + warm * center * 0.4 + uAccent * scan * 0.46;
        color += uAccent * glitch * 0.18;
        color += vec3(1.0) * horizon * 0.04;

        float alpha = clamp((center * 0.52 + scan * 0.4 + horizon * 0.22) * (0.35 + progress * 0.65), 0.0, 1.0);
        gl_FragColor = vec4(color, alpha);
      }
    `;

    const program = createProgram(gl, vertexSource, fragmentSource);
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'aPosition');
    const resolutionLocation = gl.getUniformLocation(program, 'uResolution');
    const timeLocation = gl.getUniformLocation(program, 'uTime');
    const progressLocation = gl.getUniformLocation(program, 'uProgress');
    const directionLocation = gl.getUniformLocation(program, 'uDirection');
    const accentLocation = gl.getUniformLocation(program, 'uAccent');
    const accent = parseAccent(context.accentColor);
    let raf = 0;

    const render = now => {
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
        opacity: 0.93,
        mixBlendMode: 'screen',
      }}
    />
  );
}

function shellStyle(context, direction) {
  const progress = clamp01(context.progress);
  const signed = context.verticalOrigin === 'top' ? -1 : 1;
  const enter = direction === 'enter';

  return {
    transform: `perspective(1700px) translate3d(${lerp(-22, 0, progress)}px, ${lerp(26, 0, progress) * signed}px, 0) scale(${enter ? lerp(0.8, 1, progress) : lerp(1, 0.88, progress)}) rotateX(${enter ? lerp(18, 0, progress) : lerp(0, -14, progress)}deg) rotateY(${enter ? lerp(-8, 0, progress) : lerp(0, 9, progress)}deg) skewY(${enter ? lerp(5, 0, progress) : lerp(0, -6, progress)}deg)`,
    opacity: context.baseOpacity * (enter ? progress : 1 - progress),
    filter: `blur(${enter ? lerp(18, 0, progress) : lerp(0, 16, progress)}px) saturate(${enter ? lerp(0.7, 1.1, progress) : lerp(1.1, 0.76, progress)}) brightness(${enter ? lerp(0.84, 1, progress) : lerp(1, 0.78, progress)})`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineAnimation({
  name: 'Temporal Slice Drift',
  description: 'A shader-driven slice field warps time into staggered horizontal bands with chroma drift and temporal glitching.',
  group: 'Shader Lab',
  tags: ['shader', 'time', 'slice', 'glitch', 'webgl'],
  open: {
    resolveShellStyle: context => shellStyle(context, 'enter'),
    renderOverlay: TemporalSliceDriftLayer,
  },
  close: {
    resolveShellStyle: context => shellStyle(context, 'exit'),
    renderOverlay: TemporalSliceDriftLayer,
  },
});
