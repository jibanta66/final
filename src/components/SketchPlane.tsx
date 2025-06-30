import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Vec3 } from '../utils/math';

interface SketchPlaneProps {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  isActive: boolean;
  onSketchComplete: (shapes: any[]) => void;
  selectedObject?: THREE.Object3D | null;
}

export const SketchPlane: React.FC<SketchPlaneProps> = ({
  scene,
  camera,
  renderer,
  isActive,
  onSketchComplete,
  selectedObject
}) => {
  const [workplane, setWorkplane] = useState<THREE.Mesh | null>(null);
  const [sketchLines, setSketchLines] = useState<THREE.Line[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentLine, setCurrentLine] = useState<THREE.Line | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  // Create workplane on surface or in space
  const createWorkplane = (intersectionPoint: THREE.Vector3, normal: THREE.Vector3) => {
    // Remove existing workplane
    if (workplane) {
      scene.remove(workplane);
    }

    // Create workplane geometry
    const planeGeometry = new THREE.PlaneGeometry(10, 10, 10, 10);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      wireframe: false
    });

    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    
    // Position and orient the plane
    plane.position.copy(intersectionPoint);
    plane.lookAt(intersectionPoint.clone().add(normal));
    
    // Add grid lines to workplane
    const gridHelper = new THREE.GridHelper(10, 20, 0x4ade80, 0x4ade80);
    gridHelper.position.copy(intersectionPoint);
    gridHelper.lookAt(intersectionPoint.clone().add(normal));
    
    scene.add(plane);
    scene.add(gridHelper);
    
    setWorkplane(plane);
    return plane;
  };

  // Handle mouse events for sketching
  const handleMouseDown = (event: MouseEvent) => {
    if (!isActive || !workplane) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, camera);
    const intersects = raycasterRef.current.intersectObject(workplane);

    if (intersects.length > 0) {
      const point = intersects[0].point;
      startSketchLine(point);
      setIsDrawing(true);
    }
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (!isActive || !workplane || !isDrawing || !currentLine) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, camera);
    const intersects = raycasterRef.current.intersectObject(workplane);

    if (intersects.length > 0) {
      const point = intersects[0].point;
      updateSketchLine(point);
    }
  };

  const handleMouseUp = () => {
    if (!isActive || !isDrawing) return;
    
    finishSketchLine();
    setIsDrawing(false);
  };

  // Handle surface clicking to create workplane
  const handleSurfaceClick = (event: MouseEvent) => {
    if (!isActive) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, camera);
    
    // Check for intersection with objects
    const objects = scene.children.filter(child => 
      child instanceof THREE.Mesh && child !== workplane
    );
    
    const intersects = raycasterRef.current.intersectObjects(objects);

    if (intersects.length > 0) {
      const intersection = intersects[0];
      const point = intersection.point;
      const normal = intersection.face?.normal || new THREE.Vector3(0, 1, 0);
      
      // Transform normal to world space
      const worldNormal = normal.clone().transformDirection(intersection.object.matrixWorld);
      
      createWorkplane(point, worldNormal);
    } else {
      // Create workplane in free space
      const distance = 5;
      const direction = new THREE.Vector3();
      raycasterRef.current.ray.direction.normalize();
      const point = camera.position.clone().add(
        raycasterRef.current.ray.direction.multiplyScalar(distance)
      );
      
      createWorkplane(point, camera.getWorldDirection(direction).negate());
    }
  };

  const startSketchLine = (startPoint: THREE.Vector3) => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
      startPoint.x, startPoint.y, startPoint.z,
      startPoint.x, startPoint.y, startPoint.z
    ]);
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.LineBasicMaterial({
      color: 0x60a5fa,
      linewidth: 3
    });
    
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    setCurrentLine(line);
  };

  const updateSketchLine = (endPoint: THREE.Vector3) => {
    if (!currentLine) return;

    const geometry = currentLine.geometry as THREE.BufferGeometry;
    const positions = geometry.attributes.position.array as Float32Array;
    
    positions[3] = endPoint.x;
    positions[4] = endPoint.y;
    positions[5] = endPoint.z;
    
    geometry.attributes.position.needsUpdate = true;
  };

  const finishSketchLine = () => {
    if (currentLine) {
      setSketchLines(prev => [...prev, currentLine]);
      setCurrentLine(null);
    }
  };

  // Event listeners
  useEffect(() => {
    if (!isActive) return;

    const canvas = renderer.domElement;
    
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('click', handleSurfaceClick);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('click', handleSurfaceClick);
    };
  }, [isActive, workplane, isDrawing, currentLine]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (workplane) {
        scene.remove(workplane);
      }
      sketchLines.forEach(line => scene.remove(line));
    };
  }, []);

  return null;
};