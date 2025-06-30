import * as THREE from 'three';
import { Vec3 } from './math';
import { Measurement } from './measurement';

export interface MeasurementDisplayOptions {
  textSize: number;
  arrowSize: number;
  lineWidth: number;
  color: THREE.Color;
  backgroundColor: THREE.Color;
  precision: number;
  showUnits: boolean;
  alwaysFaceCamera: boolean;
}

export interface RenderedMeasurement {
  id: string;
  measurement: Measurement;
  group: THREE.Group;
  textSprite: THREE.Sprite;
  line: THREE.Line;
  arrows: THREE.Mesh[];
  extensionLines: THREE.Line[];
}

export class MeasurementRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderedMeasurements: Map<string, RenderedMeasurement> = new Map();
  private options: MeasurementDisplayOptions;
  
  // Materials
  private lineMaterial: THREE.LineBasicMaterial;
  private arrowMaterial: THREE.MeshBasicMaterial;
  private extensionLineMaterial: THREE.LineBasicMaterial;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
    
    this.options = {
      textSize: 0.5,
      arrowSize: 0.2,
      lineWidth: 3,
      color: new THREE.Color(0x00ff00),
      backgroundColor: new THREE.Color(0x000000),
      precision: 2,
      showUnits: true,
      alwaysFaceCamera: true
    };

    this.initializeMaterials();
    console.log('MeasurementRenderer initialized');
  }

  private initializeMaterials(): void {
    this.lineMaterial = new THREE.LineBasicMaterial({
      color: this.options.color,
      linewidth: this.options.lineWidth,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      depthWrite: false
    });

    this.arrowMaterial = new THREE.MeshBasicMaterial({
      color: this.options.color,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      depthWrite: false
    });

    this.extensionLineMaterial = new THREE.LineBasicMaterial({
      color: this.options.color,
      linewidth: 1,
      transparent: true,
      opacity: 0.6,
      depthTest: false,
      depthWrite: false
    });
  }

  updateMeasurements(measurements: Measurement[]): void {
    console.log('Updating measurements in renderer:', measurements.length);
    
    // Remove measurements that no longer exist
    const currentIds = new Set(measurements.map(m => m.id));
    for (const [id, rendered] of this.renderedMeasurements) {
      if (!currentIds.has(id)) {
        this.removeMeasurement(id);
      }
    }

    // Add or update measurements
    measurements.forEach(measurement => {
      if (this.renderedMeasurements.has(measurement.id)) {
        this.updateMeasurement(measurement);
      } else {
        this.addMeasurement(measurement);
      }
    });
    
    console.log('Total rendered measurements:', this.renderedMeasurements.size);
  }

  private addMeasurement(measurement: Measurement): void {
    console.log('Adding measurement:', measurement.id, measurement.type);
    
    const group = new THREE.Group();
    group.name = `measurement-${measurement.id}`;
    group.renderOrder = 1000; // Render on top

    let renderedMeasurement: RenderedMeasurement;

    switch (measurement.type) {
      case 'distance':
        renderedMeasurement = this.createDistanceMeasurement(measurement, group);
        break;
      case 'angle':
        renderedMeasurement = this.createAngleMeasurement(measurement, group);
        break;
      case 'area':
        renderedMeasurement = this.createAreaMeasurement(measurement, group);
        break;
      default:
        console.warn('Unknown measurement type:', measurement.type);
        return;
    }

    this.scene.add(group);
    this.renderedMeasurements.set(measurement.id, renderedMeasurement);
    console.log('Measurement added to scene:', measurement.id);
  }

  private createDistanceMeasurement(measurement: Measurement, group: THREE.Group): RenderedMeasurement {
    const [point1, point2] = measurement.points;
    
    // Convert Vec3 to THREE.Vector3
    const p1 = new THREE.Vector3(point1.x, point1.y, point1.z);
    const p2 = new THREE.Vector3(point2.x, point2.y, point2.z);
    
    console.log('Creating distance measurement between:', p1, p2);
    
    // Calculate measurement line offset (perpendicular to the line between points)
    const direction = p2.clone().sub(p1).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    
    // If direction is parallel to up, use a different reference vector
    let offset: THREE.Vector3;
    if (Math.abs(direction.dot(up)) > 0.99) {
      offset = direction.clone().cross(new THREE.Vector3(1, 0, 0)).normalize().multiplyScalar(0.8);
    } else {
      offset = direction.clone().cross(up).normalize().multiplyScalar(0.8);
    }
    
    // Create offset measurement line
    const mp1 = p1.clone().add(offset);
    const mp2 = p2.clone().add(offset);
    const midPoint = mp1.clone().add(mp2).divideScalar(2);

    // Create main dimension line
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([mp1, mp2]);
    const line = new THREE.Line(lineGeometry, this.lineMaterial);
    group.add(line);

    // Create extension lines
    const extensionLines: THREE.Line[] = [];
    
    // Extension line 1
    const ext1Geometry = new THREE.BufferGeometry().setFromPoints([p1, mp1]);
    const ext1 = new THREE.Line(ext1Geometry, this.extensionLineMaterial);
    group.add(ext1);
    extensionLines.push(ext1);
    
    // Extension line 2
    const ext2Geometry = new THREE.BufferGeometry().setFromPoints([p2, mp2]);
    const ext2 = new THREE.Line(ext2Geometry, this.extensionLineMaterial);
    group.add(ext2);
    extensionLines.push(ext2);

    // Create arrows
    const arrows = this.createArrows(mp1, mp2, direction);
    arrows.forEach(arrow => group.add(arrow));

    // Create text label
    const textSprite = this.createTextSprite(
      `${measurement.value.toFixed(this.options.precision)}${this.options.showUnits ? ' mm' : ''}`,
      midPoint
    );
    group.add(textSprite);

    return {
      id: measurement.id,
      measurement,
      group,
      textSprite,
      line,
      arrows,
      extensionLines
    };
  }

  private createAngleMeasurement(measurement: Measurement, group: THREE.Group): RenderedMeasurement {
    const [point1, vertex, point2] = measurement.points;
    
    const p1 = new THREE.Vector3(point1.x, point1.y, point1.z);
    const pv = new THREE.Vector3(vertex.x, vertex.y, vertex.z);
    const p2 = new THREE.Vector3(point2.x, point2.y, point2.z);

    console.log('Creating angle measurement:', p1, pv, p2);

    // Create angle arc
    const v1 = p1.clone().sub(pv).normalize();
    const v2 = p2.clone().sub(pv).normalize();
    const angle = v1.angleTo(v2);
    
    const radius = 1.5;
    const arcPoints: THREE.Vector3[] = [];
    const segments = 32;
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const currentAngle = t * angle;
      
      // Create rotation quaternion
      const axis = v1.clone().cross(v2).normalize();
      const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, currentAngle);
      
      const point = v1.clone().multiplyScalar(radius).applyQuaternion(quaternion).add(pv);
      arcPoints.push(point);
    }

    // Create arc line
    const arcGeometry = new THREE.BufferGeometry().setFromPoints(arcPoints);
    const line = new THREE.Line(arcGeometry, this.lineMaterial);
    group.add(line);

    // Create extension lines to arc
    const extensionLines: THREE.Line[] = [];
    
    const arcStart = v1.clone().multiplyScalar(radius).add(pv);
    const arcEnd = v2.clone().multiplyScalar(radius).add(pv);
    
    const ext1Geometry = new THREE.BufferGeometry().setFromPoints([pv, arcStart]);
    const ext1 = new THREE.Line(ext1Geometry, this.extensionLineMaterial);
    group.add(ext1);
    extensionLines.push(ext1);
    
    const ext2Geometry = new THREE.BufferGeometry().setFromPoints([pv, arcEnd]);
    const ext2 = new THREE.Line(ext2Geometry, this.extensionLineMaterial);
    group.add(ext2);
    extensionLines.push(ext2);

    // Create arrows at arc ends
    const arrows = this.createAngleArrows(arcStart, arcEnd, pv);
    arrows.forEach(arrow => group.add(arrow));

    // Create text label at arc midpoint
    const midAngle = angle / 2;
    const midQuaternion = new THREE.Quaternion().setFromAxisAngle(v1.clone().cross(v2).normalize(), midAngle);
    const textPosition = v1.clone().multiplyScalar(radius * 1.3).applyQuaternion(midQuaternion).add(pv);
    
    const textSprite = this.createTextSprite(
      `${measurement.value.toFixed(1)}°`,
      textPosition
    );
    group.add(textSprite);

    return {
      id: measurement.id,
      measurement,
      group,
      textSprite,
      line,
      arrows,
      extensionLines
    };
  }

  private createAreaMeasurement(measurement: Measurement, group: THREE.Group): RenderedMeasurement {
    const points = measurement.points.map(p => new THREE.Vector3(p.x, p.y, p.z));
    
    console.log('Creating area measurement with', points.length, 'points');
    
    // Create outline
    const outlinePoints = [...points, points[0]]; // Close the loop
    const outlineGeometry = new THREE.BufferGeometry().setFromPoints(outlinePoints);
    const line = new THREE.Line(outlineGeometry, this.lineMaterial);
    group.add(line);

    // Calculate centroid for text placement
    const centroid = new THREE.Vector3();
    points.forEach(point => centroid.add(point));
    centroid.divideScalar(points.length);

    // Create text label
    const textSprite = this.createTextSprite(
      `${measurement.value.toFixed(this.options.precision)}${this.options.showUnits ? ' mm²' : ''}`,
      centroid
    );
    group.add(textSprite);

    return {
      id: measurement.id,
      measurement,
      group,
      textSprite,
      line,
      arrows: [],
      extensionLines: []
    };
  }

  private createArrows(start: THREE.Vector3, end: THREE.Vector3, direction: THREE.Vector3): THREE.Mesh[] {
    const arrows: THREE.Mesh[] = [];
    
    // Arrow geometry (cone)
    const arrowGeometry = new THREE.ConeGeometry(this.options.arrowSize * 0.5, this.options.arrowSize, 8);
    
    // Start arrow (pointing inward)
    const startArrow = new THREE.Mesh(arrowGeometry, this.arrowMaterial);
    startArrow.position.copy(start);
    startArrow.lookAt(start.clone().add(direction));
    startArrow.rotateX(Math.PI / 2);
    arrows.push(startArrow);
    
    // End arrow (pointing inward)
    const endArrow = new THREE.Mesh(arrowGeometry, this.arrowMaterial);
    endArrow.position.copy(end);
    endArrow.lookAt(end.clone().sub(direction));
    endArrow.rotateX(Math.PI / 2);
    arrows.push(endArrow);
    
    return arrows;
  }

  private createAngleArrows(start: THREE.Vector3, end: THREE.Vector3, vertex: THREE.Vector3): THREE.Mesh[] {
    const arrows: THREE.Mesh[] = [];
    const arrowGeometry = new THREE.ConeGeometry(this.options.arrowSize * 0.3, this.options.arrowSize * 0.8, 6);
    
    // Start arrow
    const startDir = start.clone().sub(vertex).normalize();
    const startArrow = new THREE.Mesh(arrowGeometry, this.arrowMaterial);
    startArrow.position.copy(start);
    startArrow.lookAt(start.clone().add(startDir.clone().cross(new THREE.Vector3(0, 1, 0))));
    arrows.push(startArrow);
    
    // End arrow
    const endDir = end.clone().sub(vertex).normalize();
    const endArrow = new THREE.Mesh(arrowGeometry, this.arrowMaterial);
    endArrow.position.copy(end);
    endArrow.lookAt(end.clone().add(endDir.clone().cross(new THREE.Vector3(0, 1, 0))));
    arrows.push(endArrow);
    
    return arrows;
  }

  private createTextSprite(text: string, position: THREE.Vector3): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    
    // Set canvas size
    canvas.width = 256;
    canvas.height = 64;
    
    // Configure text style
    context.font = 'bold 20px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Draw background with rounded corners
    context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.roundRect(context, 4, 4, canvas.width - 8, canvas.height - 8, 8);
    context.fill();
    
    // Draw border
    context.strokeStyle = '#00ff00';
    context.lineWidth = 2;
    this.roundRect(context, 4, 4, canvas.width - 8, canvas.height - 8, 8);
    context.stroke();
    
    // Draw text
    context.fillStyle = '#00ff00';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    
    // Create texture and sprite
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.copy(position);
    sprite.scale.set(this.options.textSize * 2, this.options.textSize * 0.5, 1);
    sprite.renderOrder = 1001; // Render on top of lines
    
    return sprite;
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  private updateMeasurement(measurement: Measurement): void {
    const rendered = this.renderedMeasurements.get(measurement.id);
    if (!rendered) return;

    // Remove old measurement and create new one
    this.removeMeasurement(measurement.id);
    this.addMeasurement(measurement);
  }

  private removeMeasurement(id: string): void {
    const rendered = this.renderedMeasurements.get(id);
    if (!rendered) return;

    console.log('Removing measurement:', id);

    // Dispose of geometries and materials
    rendered.group.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
      if (child instanceof THREE.Sprite) {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
    });

    this.scene.remove(rendered.group);
    this.renderedMeasurements.delete(id);
  }

  update(): void {
    // Update sprite orientations to face camera if enabled
    if (this.options.alwaysFaceCamera) {
      this.renderedMeasurements.forEach(rendered => {
        if (rendered.textSprite) {
          rendered.textSprite.lookAt(this.camera.position);
        }
      });
    }

    // Update scale based on camera distance for consistent size
    this.renderedMeasurements.forEach(rendered => {
      const distance = this.camera.position.distanceTo(rendered.textSprite.position);
      const scale = Math.max(0.2, Math.min(3.0, distance * 0.15));
      
      rendered.textSprite.scale.set(
        this.options.textSize * 2 * scale,
        this.options.textSize * 0.5 * scale,
        1
      );

      // Update arrow sizes
      rendered.arrows.forEach(arrow => {
        arrow.scale.setScalar(scale * 0.8);
      });
    });
  }

  setOptions(options: Partial<MeasurementDisplayOptions>): void {
    this.options = { ...this.options, ...options };
    this.initializeMaterials();
    
    // Update existing measurements with new options
    const measurements = Array.from(this.renderedMeasurements.values()).map(r => r.measurement);
    this.clearAll();
    measurements.forEach(m => this.addMeasurement(m));
  }

  clearAll(): void {
    const ids = Array.from(this.renderedMeasurements.keys());
    ids.forEach(id => this.removeMeasurement(id));
  }

  setVisibility(visible: boolean): void {
    this.renderedMeasurements.forEach(rendered => {
      rendered.group.visible = visible;
    });
  }

  dispose(): void {
    console.log('Disposing MeasurementRenderer');
    this.clearAll();
    this.lineMaterial.dispose();
    this.arrowMaterial.dispose();
    this.extensionLineMaterial.dispose();
  }
}