import * as THREE from 'three';
import { SelectedFace } from './FaceEdgeSelector';
import { Vec3 } from './math';

export interface ExtrusionResult {
  geometry: THREE.BufferGeometry;
  position: Vec3;
  rotation: Vec3;
  success: boolean;
  error?: string;
}

export class FaceExtrusionEngine {
  /**
   * Creates a new 3D body by extruding a selected face with the exact same shape
   * The new body will be positioned at the face location with proper orientation
   */
  static extrudeFaceToNewBody(face: SelectedFace, distance: number): ExtrusionResult {
    try {
      console.log('Creating new body from face:', face.id, 'distance:', distance);

      // Create the face shape for extrusion with exact face geometry
      const shape = this.createExactShapeFromFace(face);
      if (!shape) {
        return this.createFallbackExtrusion(face, distance);
      }

      // Create extrusion settings similar to your example
      const extrudeSettings: THREE.ExtrudeGeometryOptions = {
        steps: 2,
        depth: Math.abs(distance),
        bevelEnabled: true,
        bevelThickness: 0.05, // Reduced bevel for cleaner results
        bevelSize: 0.05,
        bevelOffset: 0,
        bevelSegments: 1
      };

      // Create the extruded geometry
      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

      // IMPORTANT: Center the geometry first before positioning
      geometry.computeBoundingBox();
      if (geometry.boundingBox) {
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);
      }

      // Calculate the exact position for the new body at the face center
      // Offset by half the distance along the face normal
      const offsetDirection = face.normal.clone().normalize();
      const offset = offsetDirection.multiplyScalar(distance / 2);
      const position = face.center.clone().add(offset);

      // Calculate rotation to align with face normal
      const rotation = this.calculateRotationFromFaceNormal(face.normal);

      console.log('Successfully created extruded body at position:', position);
      
      return {
        geometry,
        position: new Vec3(position.x, position.y, position.z),
        rotation,
        success: true
      };

    } catch (error) {
      console.error('Face extrusion failed:', error);
      return this.createFallbackExtrusion(face, distance);
    }
  }

  /**
   * Creates an exact THREE.Shape from the selected face vertices
   * Preserves the exact face geometry for perfect shape matching
   */
  private static createExactShapeFromFace(face: SelectedFace): THREE.Shape | null {
    if (face.vertices.length < 3) {
      console.error('Face must have at least 3 vertices');
      return null;
    }

    try {
      // Project face vertices to a 2D plane for exact shape creation
      const localVertices = this.projectFaceToOptimal2D(face);
      
      if (localVertices.length < 3) {
        console.error('Failed to project face to 2D');
        return null;
      }

      // Create the shape with exact vertex positions
      const shape = new THREE.Shape();
      
      // Start with the first vertex
      shape.moveTo(localVertices[0].x, localVertices[0].y);
      
      // Add all remaining vertices to preserve exact shape
      for (let i = 1; i < localVertices.length; i++) {
        shape.lineTo(localVertices[i].x, localVertices[i].y);
      }
      
      // Close the shape
      shape.lineTo(localVertices[0].x, localVertices[0].y);

      console.log('Created exact shape with', localVertices.length, 'vertices');
      return shape;

    } catch (error) {
      console.error('Error creating exact shape from face:', error);
      return null;
    }
  }

  /**
   * Projects 3D face vertices to optimal 2D plane for exact shape preservation
   */
  private static projectFaceToOptimal2D(face: SelectedFace): THREE.Vector2[] {
    try {
      // Use face center as origin for proper centering
      const center = face.center.clone();
      const normal = face.normal.clone().normalize();
      
      // Create optimal coordinate system for the face plane
      let u = new THREE.Vector3();
      let v = new THREE.Vector3();
      
      // Find the best U vector (largest component difference)
      const absNormal = new THREE.Vector3(Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z));
      if (absNormal.x <= absNormal.y && absNormal.x <= absNormal.z) {
        u.set(1, 0, 0);
      } else if (absNormal.y <= absNormal.z) {
        u.set(0, 1, 0);
      } else {
        u.set(0, 0, 1);
      }
      
      // Create orthogonal basis
      v.crossVectors(normal, u).normalize();
      u.crossVectors(v, normal).normalize();

      // Project each vertex to the 2D plane relative to face center
      const projectedVertices: THREE.Vector2[] = [];
      
      for (const vertex of face.vertices) {
        const localPos = vertex.clone().sub(center);
        const x = localPos.dot(u);
        const y = localPos.dot(v);
        projectedVertices.push(new THREE.Vector2(x, y));
      }

      console.log('Projected', face.vertices.length, 'vertices to optimal 2D plane');
      return projectedVertices;

    } catch (error) {
      console.error('Error projecting face to optimal 2D:', error);
      return [];
    }
  }

  /**
   * Calculates precise rotation angles from a face normal vector
   */
  private static calculateRotationFromFaceNormal(normal: THREE.Vector3): Vec3 {
    const normalizedNormal = normal.clone().normalize();
    
    // Calculate Euler angles to align Z-axis with the face normal
    const rotationY = Math.atan2(normalizedNormal.x, normalizedNormal.z);
    const rotationX = -Math.asin(Math.max(-1, Math.min(1, normalizedNormal.y)));
    const rotationZ = 0; // No roll rotation needed

    return new Vec3(rotationX, rotationY, rotationZ);
  }

  /**
   * Creates a fallback extrusion when complex shape creation fails
   */
  private static createFallbackExtrusion(face: SelectedFace, distance: number): ExtrusionResult {
    try {
      console.log('Using fallback extrusion for face:', face.id);
      
      // Calculate face bounding box for fallback dimensions
      const vertices = face.vertices;
      const bounds = {
        min: new THREE.Vector3(Infinity, Infinity, Infinity),
        max: new THREE.Vector3(-Infinity, -Infinity, -Infinity)
      };

      vertices.forEach(vertex => {
        bounds.min.min(vertex);
        bounds.max.max(vertex);
      });

      const size = bounds.max.clone().sub(bounds.min);
      const width = Math.max(0.1, size.length() * 0.5); // Use diagonal for square
      const height = width;
      const depth = Math.abs(distance);

      // Create square shape for fallback
      const shape = new THREE.Shape();
      const halfWidth = width / 2;
      const halfHeight = height / 2;
      
      shape.moveTo(-halfWidth, -halfHeight);
      shape.lineTo(halfWidth, -halfHeight);
      shape.lineTo(halfWidth, halfHeight);
      shape.lineTo(-halfWidth, halfHeight);
      shape.lineTo(-halfWidth, -halfHeight);

      const extrudeSettings: THREE.ExtrudeGeometryOptions = {
        steps: 2,
        depth: depth,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.05,
        bevelOffset: 0,
        bevelSegments: 1
      };

      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

      // Center the geometry
      geometry.computeBoundingBox();
      if (geometry.boundingBox) {
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);
      }

      // Position at face center with offset
      const offsetDirection = face.normal.clone().normalize();
      const offset = offsetDirection.multiplyScalar(distance / 2);
      const position = face.center.clone().add(offset);
      const rotation = this.calculateRotationFromFaceNormal(face.normal);

      console.log('Created fallback square extrusion:', { width, height, depth, position });

      return {
        geometry,
        position: new Vec3(position.x, position.y, position.z),
        rotation,
        success: true
      };

    } catch (error) {
      console.error('Fallback extrusion failed:', error);
      return {
        geometry: new THREE.BoxGeometry(0.1, 0.1, 0.1),
        position: new Vec3(),
        rotation: new Vec3(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Creates multiple extruded bodies from multiple faces
   */
  static extrudeMultipleFaces(faces: SelectedFace[], distance: number): ExtrusionResult[] {
    return faces.map(face => this.extrudeFaceToNewBody(face, distance));
  }

  /**
   * Validates if a face can be extruded
   */
  static canExtrudeFace(face: SelectedFace): boolean {
    return face.vertices.length >= 3 && face.area > 0.001;
  }

  /**
   * Creates a triangulated mesh from face vertices for complex shapes
   */
  static createTriangulatedMesh(face: SelectedFace, distance: number): ExtrusionResult {
    try {
      // Create geometry from face vertices
      const vertices: number[] = [];
      const normals: number[] = [];
      const indices: number[] = [];

      // Add face vertices
      face.vertices.forEach(vertex => {
        vertices.push(vertex.x, vertex.y, vertex.z);
        normals.push(face.normal.x, face.normal.y, face.normal.z);
      });

      // Create triangulated indices for the face
      for (let i = 1; i < face.vertices.length - 1; i++) {
        indices.push(0, i, i + 1);
      }

      // Create extruded vertices
      const extrudeOffset = face.normal.clone().multiplyScalar(distance);
      face.vertices.forEach(vertex => {
        const extrudedVertex = vertex.clone().add(extrudeOffset);
        vertices.push(extrudedVertex.x, extrudedVertex.y, extrudedVertex.z);
        normals.push(face.normal.x, face.normal.y, face.normal.z);
      });

      // Add extruded face indices
      const vertexCount = face.vertices.length;
      for (let i = 1; i < vertexCount - 1; i++) {
        indices.push(vertexCount, vertexCount + i + 1, vertexCount + i);
      }

      // Add side faces
      for (let i = 0; i < vertexCount; i++) {
        const next = (i + 1) % vertexCount;
        
        // Two triangles per side face
        indices.push(i, next, vertexCount + i);
        indices.push(next, vertexCount + next, vertexCount + i);
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();

      // Center the geometry
      geometry.computeBoundingBox();
      if (geometry.boundingBox) {
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);
      }

      // Position at face center with offset
      const offsetDirection = face.normal.clone().normalize();
      const offset = offsetDirection.multiplyScalar(distance / 2);
      const position = face.center.clone().add(offset);
      const rotation = this.calculateRotationFromFaceNormal(face.normal);

      return {
        geometry,
        position: new Vec3(position.x, position.y, position.z),
        rotation,
        success: true
      };

    } catch (error) {
      console.error('Triangulated mesh creation failed:', error);
      return this.createFallbackExtrusion(face, distance);
    }
  }
}