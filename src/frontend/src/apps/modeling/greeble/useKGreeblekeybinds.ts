


import React, { useEffect } from 'react';

export const useKGreebleKeybinds = (
    keysPressedRef: React.MutableRefObject<any>,
    sceneRef: React.MutableRefObject<any>,
    setStatus: (s: string) => void
) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => { 
          if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
          keysPressedRef.current[e.key.toLowerCase()] = true; 
          if (e.key === 'Shift') keysPressedRef.current['shift'] = true;
    
          // FRAME OBJECT HOTKEY (F)
          if (e.key.toLowerCase() === 'f') {
              const { selectedObject, rootGroup, camera, controls } = sceneRef.current;
              const target = selectedObject || rootGroup;
              
              if (target) {
                  const box = new window.THREE.Box3().setFromObject(target);
                  if (box.isEmpty()) return;
    
                  const center = box.getCenter(new window.THREE.Vector3());
                  const size = box.getSize(new window.THREE.Vector3());
                  const maxDim = Math.max(size.x, size.y, size.z);
                  
                  const fov = camera.fov * (Math.PI / 180);
                  let cameraZ = maxDim / (2 * Math.tan(fov / 2));
                  cameraZ *= 1.5; 
    
                  const direction = new window.THREE.Vector3().subVectors(camera.position, controls.target).normalize();
                  const newPos = center.clone().add(direction.multiplyScalar(cameraZ));
    
                  controls.target.copy(center);
                  camera.position.copy(newPos);
                  controls.update();
                  setStatus(selectedObject ? "Subject Focused" : "Scene Framed");
              }
          }
        };
        const handleKeyUp = (e: KeyboardEvent) => { 
          keysPressedRef.current[e.key.toLowerCase()] = false; 
          if (e.key === 'Shift') keysPressedRef.current['shift'] = false;
        };
        
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('keyup', handleKeyUp);
        };
      }, []);
};
