import * as THREE from 'three';
import { SelectedFace } from './FaceEdgeSelector';

export interface GizmoSettings {
  arrowLength: number;
  arrowRadius: number;
  coneHeight: number;
  coneRadius: number;
  color: THREE.Color;
  hoverColor: THREE.Color;
  opacity: number;
}

export class ExtrusionGizmo {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;

  private gizmoGroup: THREE.Group;
  private arrowMesh: THREE.Mesh | null = null;
  private coneMesh: THREE.Mesh | null = null;
  private planeMesh: THREE.Mesh | null = null;
  private textSprite: THREE.Sprite | null = null;

  private isVisible: boolean = false;
  private isHovered: boolean = false;
  private isDragging: boolean = false;
  private dragStartPoint: THREE.Vector3 | null = null;
  private dragPlane: THREE.Plane | null = null;
  private currentDragDistance: number = 0;

  private currentFace: SelectedFace | null = null;
  private settings: GizmoSettings;

  // Materials
  private arrowMaterial: THREE.MeshBasicMaterial;
  private coneMaterial: THREE.MeshBasicMaterial;
  private planeMaterial: THREE.MeshBasicMaterial;
  private hoverMaterial: THREE.MeshBasicMaterial;

  // Render callback
  private onRenderNeeded?: () => void;

  // Callback for drag updates
  onDragUpdate?: (faceId: string, distance: number) => void;
  // Callback for when the drag officially ends
  onDragEnd?: (faceId: string, finalDistance: number) => void;


  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.settings = {
      arrowLength: 1.5,
      arrowRadius: 0.02,
      coneHeight: 0.3,
      coneRadius: 0.08,
      color: new THREE.Color(0xfbbf24), // Yellow
      hoverColor: new THREE.Color(0xf59e0b), // Orange
      opacity: 0.9
    };

    this.gizmoGroup = new THREE.Group();
    this.gizmoGroup.name = 'ExtrusionGizmo';
    this.scene.add(this.gizmoGroup);

    // Initialize materials directly in the constructor
    this.arrowMaterial = new THREE.MeshBasicMaterial({
      color: this.settings.color,
      transparent: true,
      opacity: this.settings.opacity,
      depthTest: false,
      depthWrite: false
    });

    this.coneMaterial = new THREE.MeshBasicMaterial({
      color: this.settings.color,
      transparent: true,
      opacity: this.settings.opacity,
      depthTest: false,
      depthWrite: false
    });

    this.planeMaterial = new THREE.MeshBasicMaterial({
      color: this.settings.color,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false
    });

    this.hoverMaterial = new THREE.MeshBasicMaterial({
      color: this.settings.hoverColor,
      transparent: true,
      opacity: this.settings.opacity,
      depthTest: false,
      depthWrite: false
    });

    this.createGizmo();
  }

  // Set render callback to trigger re-renders
  setRenderCallback(callback: () => void): void {
    this.onRenderNeeded = callback;
  }

  // Trigger a render update
  private triggerRender(): void {
    if (this.onRenderNeeded) {
      this.onRenderNeeded();
    }
  }

  // Removed initializeMaterials as it's now inline in constructor
  // private initializeMaterials(): void { ... }

  private createGizmo(): void {
    // Create arrow shaft (cylinder)
    const arrowGeometry = new THREE.CylinderGeometry(
      this.settings.arrowRadius,
      this.settings.arrowRadius,
      this.settings.arrowLength,
      8
    );
    this.arrowMesh = new THREE.Mesh(arrowGeometry, this.arrowMaterial);
    this.arrowMesh.userData = { type: 'extrusion-gizmo', part: 'arrow' };
    this.gizmoGroup.add(this.arrowMesh);

    // Create arrow head (cone)
    const coneGeometry = new THREE.ConeGeometry(
      this.settings.coneRadius,
      this.settings.coneHeight,
      8
    );
    this.coneMesh = new THREE.Mesh(coneGeometry, this.coneMaterial);
    this.coneMesh.userData = { type: 'extrusion-gizmo', part: 'cone' };
    this.gizmoGroup.add(this.coneMesh);

    // Create invisible drag plane
    const planeGeometry = new THREE.CircleGeometry(0.5, 16);
    this.planeMesh = new THREE.Mesh(planeGeometry, this.planeMaterial);
    this.planeMesh.userData = { type: 'extrusion-gizmo', part: 'plane' };
    this.planeMesh.visible = false; // Initially invisible
    this.gizmoGroup.add(this.planeMesh);

    // Create text label
    this.createTextLabel();

    // Set initial visibility
    this.gizmoGroup.visible = false;
  }

  private createTextLabel(): void {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 64;

    context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = '#ffffff';
    context.font = 'bold 24px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('EXTRUDE', canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.8,
      depthTest: false
    });

    this.textSprite = new THREE.Sprite(spriteMaterial);
    this.textSprite.scale.set(0.5, 0.125, 1);
    this.textSprite.userData = { type: 'extrusion-gizmo', part: 'label' };
    this.gizmoGroup.add(this.textSprite);
  }

  showForFace(face: SelectedFace): void {
    this.currentFace = face;
    this.isVisible = true;
    this.currentDragDistance = 0; // Reset drag distance when showing for a new face

    // Position gizmo at face center
    this.gizmoGroup.position.copy(face.center);

    // Orient gizmo along face normal
    const normal = face.normal.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);

    // Create rotation matrix to align with normal
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(up, normal);
    this.gizmoGroup.setRotationFromQuaternion(quaternion);

    // Position arrow components
    if (this.arrowMesh) {
      this.arrowMesh.position.set(0, this.settings.arrowLength / 2, 0);
    }

    if (this.coneMesh) {
      this.coneMesh.position.set(0, this.settings.arrowLength + this.settings.coneHeight / 2, 0);
    }

    if (this.planeMesh) {
      this.planeMesh.position.set(0, 0, 0);
      this.planeMesh.lookAt(this.camera.position);
    }

    if (this.textSprite) {
      this.textSprite.position.set(0, this.settings.arrowLength + this.settings.coneHeight + 0.3, 0);
      this.updateTextLabel(0); // Ensure label is reset
    }

    // Scale based on distance to camera
    this.updateScale();

    this.gizmoGroup.visible = true;
    this.triggerRender(); // Force render update
    console.log('Extrusion gizmo shown for face:', face.id);
  }

  hide(): void {
    this.isVisible = false;
    this.currentFace = null;
    this.gizmoGroup.visible = false;
    this.stopDragging(); // Ensure drag is stopped when hiding
    this.triggerRender(); // Force render update
    console.log('Extrusion gizmo hidden');
  }

  handleMouseMove(event: MouseEvent, canvas: HTMLCanvasElement): boolean {
    if (!this.isVisible) return false;

    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    if (this.isDragging && this.dragPlane && this.dragStartPoint && this.currentFace) {
      this.updateDrag();
      this.triggerRender(); // Force render update during drag
      return true; // Prevent camera movement
    }

    // Check for hover
    this.updateHover();
    return false;
  }

  handleMouseDown(event: MouseEvent, canvas: HTMLCanvasElement): boolean {
    if (!this.isVisible) return false; // Always check visibility first

    // *** CHANGE IS HERE: Check for right mouse button (event.button === 2) ***
    if (event.button !== 2) {
      return false; // Only proceed if right-click
    }

    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const result = this.startDrag();
    if (result) {
      this.triggerRender(); // Force render update
    }
    return result;
  }

  handleMouseUp(event: MouseEvent): boolean {
    if (this.isDragging && this.currentFace) {
      const finalDistance = this.currentDragDistance; // Capture the final distance
      this.stopDragging();
      this.triggerRender(); // Force render update

      // Trigger the onDragEnd callback after stopping the drag
      if (this.onDragEnd) {
        this.onDragEnd(this.currentFace.id, finalDistance);
      }
      return true;
    }
    return false;
  }

  private updateHover(): void {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const gizmoObjects = [this.arrowMesh, this.coneMesh].filter(obj => obj !== null) as THREE.Mesh[];
    const intersects = this.raycaster.intersectObjects(gizmoObjects);

    const wasHovered = this.isHovered;
    this.isHovered = intersects.length > 0;

    if (this.isHovered !== wasHovered) {
      this.updateHoverState();
      this.triggerRender(); // Force render update for hover state
    }
  }

  private updateHoverState(): void {
    const material = this.isHovered ? this.hoverMaterial : this.arrowMaterial;

    if (this.arrowMesh) {
      this.arrowMesh.material = material;
    }

    if (this.coneMesh) {
      this.coneMesh.material = material;
    }

    // Update cursor style
    if (this.isHovered) {
      document.body.style.cursor = 'grab';
    } else {
      document.body.style.cursor = 'default';
    }
  }

  private startDrag(): boolean {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const gizmoObjects = [this.arrowMesh, this.coneMesh].filter(obj => obj !== null) as THREE.Mesh[];
    const intersects = this.raycaster.intersectObjects(gizmoObjects);

    if (intersects.length > 0 && this.currentFace) {
      this.isDragging = true;
      this.dragStartPoint = intersects[0].point.clone();

      // Create drag plane perpendicular to face normal
      this.dragPlane = new THREE.Plane(this.currentFace.normal, -this.currentFace.normal.dot(this.currentFace.center));

      // Show drag plane
      if (this.planeMesh) {
        this.planeMesh.visible = true;
      }

      // Update cursor
      document.body.style.cursor = 'grabbing';

      console.log('Started gizmo drag');
      return true;
    }

    return false;
  }

  private updateDrag(): void {
    if (!this.dragPlane || !this.dragStartPoint || !this.currentFace) return;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const currentPoint = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.dragPlane, currentPoint);

    if (currentPoint) {
      const dragVector = currentPoint.clone().sub(this.dragStartPoint);
      const dragDistance = dragVector.dot(this.currentFace.normal);
      this.currentDragDistance = dragDistance; // Store the current drag distance

      // Update gizmo position (This moves the gizmo along the normal, not the actual object)
      const newPosition = this.currentFace.center.clone().add(
        this.currentFace.normal.clone().multiplyScalar(dragDistance)
      );
      this.gizmoGroup.position.copy(newPosition);

      // Update text label to show distance
      this.updateTextLabel(dragDistance);

      // Trigger face scaling (this would be handled by the FaceEdgeSelector)
      this.onDragUpdate?.(this.currentFace.id, dragDistance);
    }
  }

  private stopDragging(): void {
    this.isDragging = false;
    this.dragStartPoint = null;
    this.dragPlane = null;
    this.currentDragDistance = 0; // Reset stored distance

    // Hide drag plane
    if (this.planeMesh) {
      this.planeMesh.visible = false;
    }

    // Reset cursor
    document.body.style.cursor = this.isHovered ? 'grab' : 'default';

    // Reset text label to default 'EXTRUDE'
    this.updateTextLabel(0);

    console.log('Stopped gizmo drag');
  }

  private updateTextLabel(distance: number): void {
    if (!this.textSprite) return;

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 64;

    context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = distance > 0 ? '#10b981' : distance < 0 ? '#ef4444' : '#ffffff';
    context.font = 'bold 20px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    if (Math.abs(distance) > 0.01) {
      const operation = distance > 0 ? 'EXTRUDE' : 'INTRUDE';
      const value = Math.abs(distance).toFixed(2);
      context.fillText(`${operation} ${value}`, canvas.width / 2, canvas.height / 2);
    } else {
      context.fillText('EXTRUDE', canvas.width / 2, canvas.height / 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    (this.textSprite.material as THREE.SpriteMaterial).map = texture;
    (this.textSprite.material as THREE.SpriteMaterial).needsUpdate = true;
  }

  private updateScale(): void {
    if (!this.currentFace) return;

    // Scale gizmo based on distance to camera
    const distance = this.camera.position.distanceTo(this.currentFace.center);
    // Adjust these values to control how the gizmo scales with distance
    const scale = Math.max(0.1, Math.min(2.0, distance * 0.1));
    this.gizmoGroup.scale.setScalar(scale);

    // Keep text sprite's orientation consistent
    if (this.textSprite) {
        this.textSprite.lookAt(this.camera.position);
        // Ensure the sprite always faces the camera regardless of the gizmo group's rotation
        // by resetting its rotation relative to the camera
        const targetQuaternion = new THREE.Quaternion();
        this.camera.getWorldQuaternion(targetQuaternion);
        // We need to invert the gizmoGroup's rotation to get the local rotation for the sprite
        const invGizmoRotation = this.gizmoGroup.quaternion.clone().invert();
        this.textSprite.quaternion.copy(targetQuaternion).premultiply(invGizmoRotation);
    }
  }

  update(): void {
    if (this.isVisible && this.currentFace) {
      this.updateScale();

      // Update plane orientation to face camera (if visible)
      if (this.planeMesh && this.planeMesh.visible) {
        this.planeMesh.lookAt(this.camera.position);
      }
    }
  }

  setDragCallback(callback: (faceId: string, distance: number) => void): void {
    this.onDragUpdate = callback;
  }

  setDragEndCallback(callback: (faceId: string, finalDistance: number) => void): void {
    this.onDragEnd = callback;
  }

  isGizmoDragging(): boolean {
    return this.isDragging;
  }

  dispose(): void {
    this.hide();
    this.scene.remove(this.gizmoGroup);

    // Dispose materials
    this.arrowMaterial.dispose();
    this.coneMaterial.dispose();
    this.planeMaterial.dispose();
    this.hoverMaterial.dispose();

    // Dispose geometries
    if (this.arrowMesh) this.arrowMesh.geometry.dispose();
    if (this.coneMesh) this.coneMesh.geometry.dispose();
    if (this.planeMesh) this.planeMesh.geometry.dispose();
    if (this.textSprite) {
      const material = this.textSprite.material as THREE.SpriteMaterial;
      if (material.map) material.map.dispose();
      material.dispose();
    }
  }
}