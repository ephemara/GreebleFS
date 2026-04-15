import * as THREE from 'three';
import { getMonolithTokens } from '../theme-tokens';

function createParticleField(count, radius, color) {
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const stride = index * 3;
    const angle = Math.random() * Math.PI * 2;
    const spread = radius * (0.35 + Math.random() * 0.65);
    const height = (Math.random() - 0.5) * radius * 0.8;
    positions[stride] = Math.cos(angle) * spread;
    positions[stride + 1] = height;
    positions[stride + 2] = Math.sin(angle) * spread;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color,
    size: 0.042,
    transparent: true,
    opacity: 0.74,
    depthWrite: false,
  });

  return new THREE.Points(geometry, material);
}

export function ThreeBackdrop({ host, mode }) {
  const rootRef = React.useRef(null);

  React.useEffect(() => {
    const container = rootRef.current;
    if (!container) {
      return undefined;
    }

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (error) {
      console.warn('Vector Monolith: failed to create WebGL renderer', error);
      return undefined;
    }

    const tokens = getMonolithTokens(host, mode);
    const accentColor = new THREE.Color(tokens.accent);
    const emberColor = new THREE.Color(tokens.ember);
    const textColor = new THREE.Color('#ECFBFF');
    const isDock = mode === 'dock';

    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x02070a, isDock ? 0.075 : 0.058);

    const camera = new THREE.PerspectiveCamera(isDock ? 42 : 36, 1, 0.1, 100);
    camera.position.set(0, isDock ? 1.35 : 1.15, isDock ? 9.1 : 8.2);

    const hemisphereLight = new THREE.HemisphereLight(textColor, new THREE.Color('#021014'), 1.2);
    scene.add(hemisphereLight);

    const accentLight = new THREE.PointLight(accentColor, isDock ? 10 : 14, 24, 2);
    accentLight.position.set(3.4, 4.4, 5.6);
    scene.add(accentLight);

    const emberLight = new THREE.PointLight(emberColor, isDock ? 7 : 9, 20, 2);
    emberLight.position.set(-4.2, 1.8, 4.5);
    scene.add(emberLight);

    const monolithRig = new THREE.Group();
    monolithRig.position.y = isDock ? 0.3 : 0.45;
    scene.add(monolithRig);

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(isDock ? 0.9 : 1.15, 1),
      new THREE.MeshStandardMaterial({
        color: accentColor,
        emissive: accentColor,
        emissiveIntensity: 0.3,
        metalness: 0.78,
        roughness: 0.28,
        transparent: true,
        opacity: 0.86,
        wireframe: true,
      }),
    );
    monolithRig.add(core);

    const cage = new THREE.LineSegments(
      new THREE.EdgesGeometry(
        new THREE.BoxGeometry(isDock ? 3.8 : 4.8, isDock ? 1.9 : 2.6, isDock ? 2.2 : 2.8),
      ),
      new THREE.LineBasicMaterial({
        color: accentColor,
        transparent: true,
        opacity: 0.22,
      }),
    );
    monolithRig.add(cage);

    const orbitRingA = new THREE.Mesh(
      new THREE.TorusGeometry(isDock ? 2.2 : 2.5, 0.024, 14, 96),
      new THREE.MeshBasicMaterial({
        color: accentColor,
        transparent: true,
        opacity: 0.6,
      }),
    );
    orbitRingA.rotation.x = Math.PI / 2.35;
    monolithRig.add(orbitRingA);

    const orbitRingB = new THREE.Mesh(
      new THREE.TorusGeometry(isDock ? 1.8 : 2.05, 0.02, 12, 84),
      new THREE.MeshBasicMaterial({
        color: emberColor,
        transparent: true,
        opacity: 0.48,
      }),
    );
    orbitRingB.rotation.y = Math.PI / 2.6;
    orbitRingB.rotation.x = Math.PI / 4.4;
    monolithRig.add(orbitRingB);

    const runwayGroup = new THREE.Group();
    runwayGroup.position.set(0, isDock ? -1.8 : -2.3, isDock ? 0.4 : -0.1);
    scene.add(runwayGroup);

    const runwaySurface = new THREE.Mesh(
      new THREE.PlaneGeometry(isDock ? 11.5 : 10.8, isDock ? 6.6 : 8.6, 24, 24),
      new THREE.MeshBasicMaterial({
        color: accentColor,
        transparent: true,
        opacity: isDock ? 0.06 : 0.04,
        wireframe: true,
      }),
    );
    runwaySurface.rotation.x = -Math.PI / 2;
    runwayGroup.add(runwaySurface);

    const runwayOutline = new THREE.GridHelper(
      isDock ? 12 : 11,
      isDock ? 18 : 16,
      accentColor,
      emberColor,
    );
    runwayOutline.material.transparent = true;
    runwayOutline.material.opacity = isDock ? 0.22 : 0.14;
    runwayGroup.add(runwayOutline);

    const plateGeometry = new THREE.BoxGeometry(0.82, 0.36, 0.06);
    const plateMaterial = new THREE.MeshStandardMaterial({
      color: textColor,
      emissive: accentColor,
      emissiveIntensity: 0.14,
      metalness: 0.78,
      roughness: 0.18,
      transparent: true,
      opacity: 0.84,
    });

    const plates = Array.from({ length: isDock ? 6 : 9 }, (_, index) => {
      const plate = new THREE.Mesh(plateGeometry, plateMaterial.clone());
      monolithRig.add(plate);
      return {
        mesh: plate,
        angleOffset: (index / (isDock ? 6 : 9)) * Math.PI * 2,
        liftOffset: Math.random() * Math.PI * 2,
      };
    });

    const particles = createParticleField(isDock ? 88 : 132, isDock ? 6.2 : 7.6, accentColor);
    scene.add(particles);

    const clock = new THREE.Clock();

    const resizeRenderer = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (!width || !height) {
        return;
      }
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    resizeRenderer();

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          resizeRenderer();
        })
      : null;
    resizeObserver?.observe(container);

    let animationFrameId = 0;
    const renderFrame = () => {
      const elapsed = clock.getElapsedTime();

      core.rotation.x = elapsed * 0.34;
      core.rotation.y = elapsed * 0.28;
      orbitRingA.rotation.z = elapsed * 0.18;
      orbitRingB.rotation.z = -elapsed * 0.14;
      cage.rotation.y = elapsed * 0.12;

      monolithRig.rotation.y = elapsed * (isDock ? 0.16 : 0.11);
      monolithRig.rotation.x = Math.sin(elapsed * 0.3) * (isDock ? 0.06 : 0.08);
      runwayGroup.rotation.y = Math.sin(elapsed * 0.15) * (isDock ? 0.12 : 0.08);

      plates.forEach((plate, index) => {
        const angle = plate.angleOffset + elapsed * (isDock ? 0.35 : 0.24);
        const radius = isDock ? 2.3 : 2.75;
        const wave = Math.sin(elapsed * 1.1 + plate.liftOffset) * (isDock ? 0.16 : 0.28);
        plate.mesh.position.set(
          Math.cos(angle) * radius,
          wave,
          Math.sin(angle) * (isDock ? 1.2 : 1.6),
        );
        plate.mesh.rotation.y = angle + Math.PI / 2;
        plate.mesh.rotation.x = Math.sin(elapsed + index) * 0.08;
      });

      particles.rotation.y = elapsed * 0.04;
      particles.rotation.x = elapsed * 0.012;

      camera.position.x = Math.sin(elapsed * 0.18) * (isDock ? 0.38 : 0.52);
      camera.position.y = (isDock ? 1.35 : 1.15) + Math.cos(elapsed * 0.14) * 0.08;
      camera.lookAt(0, isDock ? 0.1 : 0.2, 0);

      renderer.render(scene, camera);
      animationFrameId = window.requestAnimationFrame(renderFrame);
    };

    animationFrameId = window.requestAnimationFrame(renderFrame);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver?.disconnect();
      plateGeometry.dispose();
      plates.forEach(plate => {
        plate.mesh.material.dispose();
      });
      orbitRingA.geometry.dispose();
      orbitRingA.material.dispose();
      orbitRingB.geometry.dispose();
      orbitRingB.material.dispose();
      runwaySurface.geometry.dispose();
      runwaySurface.material.dispose();
      runwayOutline.geometry.dispose();
      runwayOutline.material.dispose();
      core.geometry.dispose();
      core.material.dispose();
      cage.geometry.dispose();
      cage.material.dispose();
      particles.geometry.dispose();
      particles.material.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [host.theme.id, mode]);

  return (
    <div
      ref={rootRef}
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity: mode === 'dock' ? 0.94 : 1,
      }}
    />
  );
}
