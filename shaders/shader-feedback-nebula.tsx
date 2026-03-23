import React, { useEffect, useRef } from 'react';
import { clamp01, defineShader } from 'overlayterm-shader';

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('Unable to allocate shader.');
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || 'Unknown shader compile failure';
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) {
    throw new Error('Unable to allocate shader program.');
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) || 'Unknown shader link failure';
    gl.deleteProgram(program);
    throw new Error(log);
  }
  return program;
}

function createSimulationTarget(gl: WebGLRenderingContext, width: number, height: number) {
  const texture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  if (!texture || !framebuffer) {
    throw new Error('Unable to allocate feedback target.');
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return { texture, framebuffer, width, height };
}

function ShaderFeedbackNebulaSurface({ context }) {
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

    const feedbackSource = `
      precision mediump float;
      varying vec2 vUv;
      uniform sampler2D uPrev;
      uniform vec2 uResolution;
      uniform float uTime;
      uniform float uEnergy;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        vec2 uv = vUv;
        vec2 p = uv * 2.0 - 1.0;
        p.x *= uResolution.x / max(uResolution.y, 1.0);
        float dist = length(p);
        float ang = atan(p.y, p.x);
        vec2 swirl = vec2(cos(ang + uTime * 0.33), sin(ang - uTime * 0.25));
        vec2 sampleUv = uv + swirl * (0.003 + dist * 0.009) + vec2(sin(uTime + uv.y * 24.0), cos(uTime * 1.1 + uv.x * 19.0)) * 0.0025;
        vec4 prev = texture2D(uPrev, sampleUv) * 0.972;

        float pulse = smoothstep(1.35, 0.08, dist) * (0.02 + uEnergy * 0.03);
        float filament = pow(max(0.0, 1.0 - abs(sin(ang * 4.0 + uTime * 0.85))), 6.0) * smoothstep(1.2, 0.18, dist);
        float stars = step(0.9955, hash(floor(uv * uResolution * 0.24) + floor(uTime * 8.0)));
        vec3 inject = vec3(0.05, 0.18, 0.42) * pulse;
        inject += vec3(0.14, 0.72, 1.08) * filament * (0.04 + uEnergy * 0.03);
        inject += vec3(0.95, 0.98, 1.0) * stars * (0.025 + uEnergy * 0.015);

        gl_FragColor = vec4(prev.rgb + inject, 1.0);
      }
    `;

    const displaySource = `
      precision mediump float;
      varying vec2 vUv;
      uniform sampler2D uTexture;
      uniform float uEnergy;
      void main() {
        vec3 color = texture2D(uTexture, vUv).rgb;
        float glow = max(color.r, max(color.g, color.b));
        float alpha = smoothstep(0.02, 0.9, glow) * (0.16 + glow * 0.9) * (0.82 + uEnergy * 0.18);
        gl_FragColor = vec4(color, alpha);
      }
    `;

    const feedbackProgram = createProgram(gl, vertexSource, feedbackSource);
    const displayProgram = createProgram(gl, vertexSource, displaySource);
    const quad = gl.createBuffer();
    if (!quad) {
      gl.deleteProgram(feedbackProgram);
      gl.deleteProgram(displayProgram);
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const feedbackPosition = gl.getAttribLocation(feedbackProgram, 'aPosition');
    const displayPosition = gl.getAttribLocation(displayProgram, 'aPosition');
    const feedbackPrev = gl.getUniformLocation(feedbackProgram, 'uPrev');
    const feedbackResolution = gl.getUniformLocation(feedbackProgram, 'uResolution');
    const feedbackTime = gl.getUniformLocation(feedbackProgram, 'uTime');
    const feedbackEnergy = gl.getUniformLocation(feedbackProgram, 'uEnergy');
    const displayTexture = gl.getUniformLocation(displayProgram, 'uTexture');
    const displayEnergy = gl.getUniformLocation(displayProgram, 'uEnergy');

    let readTarget: ReturnType<typeof createSimulationTarget> | null = null;
    let writeTarget: ReturnType<typeof createSimulationTarget> | null = null;
    let raf = 0;

    const ensureTargets = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const nextWidth = Math.max(220, Math.floor(canvas.clientWidth * dpr * 0.35));
      const nextHeight = Math.max(140, Math.floor(canvas.clientHeight * dpr * 0.35));

      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));

      if (readTarget && writeTarget && readTarget.width === nextWidth && readTarget.height === nextHeight) {
        return;
      }

      [readTarget, writeTarget].forEach(target => {
        if (!target) {
          return;
        }
        gl.deleteTexture(target.texture);
        gl.deleteFramebuffer(target.framebuffer);
      });

      readTarget = createSimulationTarget(gl, nextWidth, nextHeight);
      writeTarget = createSimulationTarget(gl, nextWidth, nextHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, readTarget.framebuffer);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, writeTarget.framebuffer);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    };

    const render = (now: number) => {
      const liveContext = contextRef.current;
      ensureTargets();
      if (!readTarget || !writeTarget) {
        raf = window.requestAnimationFrame(render);
        return;
      }

      const energy = clamp01(0.42 + liveContext.blurStrength / 48 + (liveContext.isSettingsActive ? 0.18 : 0));
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);

      gl.bindFramebuffer(gl.FRAMEBUFFER, writeTarget.framebuffer);
      gl.viewport(0, 0, writeTarget.width, writeTarget.height);
      gl.useProgram(feedbackProgram);
      gl.enableVertexAttribArray(feedbackPosition);
      gl.vertexAttribPointer(feedbackPosition, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, readTarget.texture);
      gl.uniform1i(feedbackPrev, 0);
      gl.uniform2f(feedbackResolution, writeTarget.width, writeTarget.height);
      gl.uniform1f(feedbackTime, now * 0.001);
      gl.uniform1f(feedbackEnergy, energy);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(displayProgram);
      gl.enableVertexAttribArray(displayPosition);
      gl.vertexAttribPointer(displayPosition, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, writeTarget.texture);
      gl.uniform1i(displayTexture, 0);
      gl.uniform1f(displayEnergy, energy);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      const swap = readTarget;
      readTarget = writeTarget;
      writeTarget = swap;
      raf = window.requestAnimationFrame(render);
    };

    raf = window.requestAnimationFrame(render);
    return () => {
      window.cancelAnimationFrame(raf);
      gl.deleteProgram(feedbackProgram);
      gl.deleteProgram(displayProgram);
      gl.deleteBuffer(quad);
      [readTarget, writeTarget].forEach(target => {
        if (!target) {
          return;
        }
        gl.deleteTexture(target.texture);
        gl.deleteFramebuffer(target.framebuffer);
      });
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />;
}

export default defineShader({
  name: 'Shader Feedback Nebula',
  description: 'A ping-pong feedback shader that smears light into a living volumetric nebula.',
  group: 'Shader Lab',
  tags: ['shader', 'feedback', 'ping-pong', 'nebula', 'webgl'],
  background: {
    render: ShaderFeedbackNebulaSurface,
    resolveStyle: () => ({
      mixBlendMode: 'screen',
      opacity: 0.92,
    }),
  },
});
