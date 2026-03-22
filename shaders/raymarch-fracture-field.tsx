import React, { useEffect, useRef } from 'react';
import { clamp01, defineAnimation, lerp } from 'overlayterm-animation';

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to create shader.');
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
  const program = gl.createProgram();
  if (!program) throw new Error('Unable to create program.');
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

function RaymarchFractureField({ context }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, depth: false, stencil: false });
    if (!gl) return;

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

      float sdBox(vec3 p, vec3 b) {
        vec3 d = abs(p) - b;
        return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
      }

      float mapScene(vec3 p) {
        vec3 q = mod(p, 2.3) - 1.15;
        float shell = sdBox(q, vec3(0.26, 0.26, 0.26));
        float ribs = sdBox(q, vec3(0.52, 0.03, 0.03));
        float ribs2 = sdBox(q, vec3(0.03, 0.52, 0.03));
        float ribs3 = sdBox(q, vec3(0.03, 0.03, 0.52));
        return min(shell, min(ribs, min(ribs2, ribs3)));
      }

      vec3 calcNormal(vec3 p) {
        vec2 e = vec2(0.001, 0.0);
        return normalize(vec3(
          mapScene(p + e.xyy) - mapScene(p - e.xyy),
          mapScene(p + e.yxy) - mapScene(p - e.yxy),
          mapScene(p + e.yyx) - mapScene(p - e.yyx)
        ));
      }

      void main() {
        vec2 uv = vUv * 2.0 - 1.0;
        uv.x *= uResolution.x / max(uResolution.y, 1.0);
        float dirMix = uDirection < 0.5 ? (1.0 - uProgress) : uProgress;
        vec3 ro = vec3(0.0, 0.0, -4.6 + dirMix * 1.4);
        vec3 rd = normalize(vec3(uv, 1.45));

        float yaw = uTime * 0.34 + dirMix * 1.2;
        float cy = cos(yaw);
        float sy = sin(yaw);
        mat2 rot = mat2(cy, -sy, sy, cy);
        ro.xz = rot * ro.xz;
        rd.xz = rot * rd.xz;

        float t = 0.0;
        float hit = 0.0;
        vec3 p = ro;
        for (int i = 0; i < 52; i++) {
          p = ro + rd * t;
          float d = mapScene(p);
          if (d < 0.002) {
            hit = 1.0;
            break;
          }
          t += d * 0.92;
          if (t > 14.0) break;
        }

        vec3 color = vec3(0.0);
        if (hit > 0.5) {
          vec3 normal = calcNormal(p);
          float fresnel = pow(1.0 - max(dot(normal, -rd), 0.0), 3.0);
          float pulse = 0.5 + 0.5 * sin(uTime * 1.5 + p.z * 2.0);
          color = mix(vec3(0.08, 0.18, 0.38), vec3(0.55, 0.92, 1.25), fresnel + pulse * 0.18);
          color *= 1.0 + fresnel * 0.65;
        }

        float vignette = smoothstep(1.4, 0.22, length(uv));
        float alpha = clamp(max(color.r, max(color.g, color.b)) * 0.72 * vignette, 0.0, 1.0);
        gl_FragColor = vec4(color * vignette, alpha);
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
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = window.requestAnimationFrame(render);
    };

    raf = window.requestAnimationFrame(render);
    return () => {
      window.cancelAnimationFrame(raf);
      gl.deleteProgram(program);
      gl.deleteBuffer(quad);
    };
  }, [context.direction, context.progress]);

  return <canvas ref={canvasRef} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', mixBlendMode: 'screen', opacity: 0.84 }} />;
}

function shellStyle(context, direction) {
  const progress = clamp01(context.progress);
  const signed = context.verticalOrigin === 'top' ? -1 : 1;
  const active = direction === 'enter' ? progress : 1 - progress;
  return {
    transform: `perspective(1400px) translate3d(0, ${lerp(18, 0, active) * signed}px, 0) scale(${direction === 'enter' ? lerp(0.76, 1, active) : lerp(1, 0.72, progress)}) rotateY(${direction === 'enter' ? lerp(24, 0, active) : lerp(0, -28, progress)}deg) rotateX(${direction === 'enter' ? lerp(-14, 0, active) : lerp(0, 16, progress)}deg)`,
    opacity: context.baseOpacity * (direction === 'enter' ? active : 1 - progress),
    filter: `blur(${direction === 'enter' ? lerp(18, 0, active) : lerp(0, 20, progress)}px) saturate(${direction === 'enter' ? lerp(0.52, 1, active) : lerp(1, 0.46, progress)}) brightness(${direction === 'enter' ? lerp(0.9, 1, active) : lerp(1, 0.78, progress)})`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineAnimation({
  name: 'Raymarch Fracture Field',
  description: 'A full-screen raymarched lattice pushes the animation system into true 3D shader territory.',
  group: 'Shader Lab',
  tags: ['shader', 'raymarch', '3d', 'fracture'],
  open: {
    resolveShellStyle: context => shellStyle(context, 'enter'),
    renderOverlay: RaymarchFractureField,
  },
  close: {
    resolveShellStyle: context => shellStyle(context, 'exit'),
    renderOverlay: RaymarchFractureField,
  },
});
