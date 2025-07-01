import * as THREE from 'three';
import { SketchShape3D } from '../utils/sketch3d'; // Assuming sketch3d.ts is in the same folder or a parent utils folder

export interface ExtrusionSettings {
  depth: number;
  bevelEnabled: boolean;
  bevelThickness: number;
  bevelSize: number;
  bevelSegments: number;
}

export class ExtrusionEngine {
  /**
   * Extrudes the first valid, closed shape from a list of sketch shapes.
   * This version correctly handles different shape types like circles and polygons.
   * @param shapes An array of 3D sketch shapes.
   * @param settings The settings for the extrusion (depth, bevels, etc.).
   * @returns A BufferGeometry of the extruded model.
   */
  static extrudeSketch(shapes: SketchShape3D[], settings: ExtrusionSettings): THREE.BufferGeometry {
    if (shapes.length === 0) {
      console.warn('No shapes provided to extrude.');
      return new THREE.BoxGeometry(1, 1, 1); // Return a fallback geometry
    }

    console.log('Attempting to extrude from provided shapes:', shapes);

    // Find the first valid shape to extrude.
    const shapeToExtrude = shapes.find(s => s.closed && s.points.length >= 2); // Circle needs 2 pts, polygons need >= 3

    if (!shapeToExtrude) {
      console.warn('No valid, closed shape with at least 2 points found for extrusion.');
      return new THREE.BoxGeometry(1, 1, 1);
    }

    console.log(`Processing shape: ${shapeToExtrude.type} with ${shapeToExtrude.points.length} points`);

    const threeShape = new THREE.Shape();
    let transformMatrix: THREE.Matrix4; // This matrix transforms from 2D plane to original 3D orientation.
    let originalPlaneOrigin: THREE.Vector3; // To store the origin of the 2D plane

    // --- NEW LOGIC: Handle shapes based on their type ---
    if (shapeToExtrude.type === 'circle' && shapeToExtrude.points.length >= 2) {
      // For a circle, points[0] is center, points[1] is on the edge.
      const points3D = shapeToExtrude.points.map(p => p.position);
      const projection = this.projectPointsTo2DPlane(points3D);
      transformMatrix = projection.transformMatrix;
      const points2D = projection.points2D;

      const center2D = points2D[0];
      const edge2D = points2D[1];
      const radius = center2D.distanceTo(edge2D);

      console.log(`Creating circle for extrusion with 2D center at (${center2D.x}, ${center2D.y}) and radius ${radius}`);

      // Use absarc to create a true circle path for the shape.
      threeShape.absarc(center2D.x, center2D.y, radius, 0, Math.PI * 2, false);

      // Store the original 3D center of the circle to use for mesh positioning
      originalPlaneOrigin = points3D[0].clone();

    } else if (shapeToExtrude.type === 'rectangle' || shapeToExtrude.type === 'polygon') {
      if (shapeToExtrude.points.length < 3) {
        console.warn('Polygon-based shapes must have at least 3 points.');
        return new THREE.BoxGeometry(1, 1, 1);
      }
      // This is the default behavior for any shape defined by a list of vertices.
      const points3D = shapeToExtrude.points.map(p => p.position);
      const projection = this.projectPointsTo2DPlane(points3D);
      transformMatrix = projection.transformMatrix;
      const points2D = projection.points2D;

      if (points2D.length === 0) {
        console.warn('Projection to 2D failed for polygon-based shape, cannot extrude.');
        return new THREE.BoxGeometry(1, 1, 1);
      }

      console.log('Creating polygon-based shape for extrusion from points.');
      threeShape.setFromPoints(points2D);

      // For polygons, the 'origin' of the shape on the 2D plane is usually the first point,
      // but its "visual" center might be somewhere else. We'll rely on the mesh's position later.
      // We store the 'p0' from the projection as the reference point for the plane.
      originalPlaneOrigin = this.projectPointsTo2DPlane(points3D).p0; // Make p0 accessible from projectPointsTo2DPlane or use points3D[0] directly.
      // For now, let's just use the first point as a reference for polygons
      originalPlaneOrigin = points3D[0].clone();


    } else {
      console.warn(`Unsupported shape type for extrusion: "${shapeToExtrude.type}"`);
      return new THREE.BoxGeometry(1, 1, 1);
    }

    threeShape.closePath(); // Ensure the shape is closed for extrusion.

    // Define the extrusion settings for Three.js.
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: settings.depth,
      bevelEnabled: settings.bevelEnabled,
      bevelThickness: settings.bevelThickness,
      bevelSize: settings.bevelSize,
      bevelSegments: settings.bevelSegments,
    };

    console.log('Using extrude settings:', extrudeSettings);

    try {
      // Create the geometry. It will be created "flat" on the world's XY plane,
      // relative to its local origin.
      const geometry = new THREE.ExtrudeGeometry(threeShape, extrudeSettings);

      // Re-orient the extruded geometry back into the original 3D orientation.
      // This matrix takes points from the 2D projection plane (where the shape was defined)
      // back to their original 3D coordinates.
      geometry.applyMatrix4(transformMatrix);

      // !!! IMPORTANT: REMOVE THIS LINE !!!
      // geometry.center(); // This is what was moving your object to the global origin.

      console.log('Extrusion successful. Geometry created without centering.');
      return geometry;
    } catch (error) {
      console.error('THREE.ExtrudeGeometry failed:', error);
      return new THREE.BoxGeometry(1, 1, 1); // Return a fallback on error
    }
  }

  /**
   * Projects an array of 3D points onto a 2D plane that best fits them.
   * @param points3D The array of 3D points to project.
   * @returns An object containing the projected 2D points and the matrix used for the transformation.
   */
  private static projectPointsTo2DPlane(points3D: THREE.Vector3[]): { points2D: THREE.Vector2[], transformMatrix: THREE.Matrix4, p0: THREE.Vector3 } {
    if (points3D.length < 2) {
      console.warn("Cannot define a plane with fewer than 2 points.");
      return { points2D: [], transformMatrix: new THREE.Matrix4(), p0: new THREE.Vector3() };
    }

    const p0 = points3D[0];
    const u = points3D[1].clone().sub(p0).normalize();
    let n: THREE.Vector3;

    if (points3D.length < 3) {
      // For a line (2 points), we must guess the plane's normal.
      // This is not robust but provides a fallback.
      // We want 'n' to be perpendicular to 'u' and preferably align with world axes
      n = new THREE.Vector3(0, 0, 1); // Default to Z-axis
      // If the line is parallel to Z-axis, use Y-axis for normal
      if (Math.abs(u.dot(n)) > 0.99) {
        n.set(0, 1, 0);
      }
      // Ensure 'n' is orthogonal to 'u'
      if (Math.abs(u.dot(n)) > 0.001) { // If not nearly orthogonal
          n.crossVectors(u, new THREE.Vector3(0, 1, 0)).normalize(); // Try cross with Y
          if (n.lengthSq() < 0.001) { // If still problematic (e.g., u is parallel to Y)
              n.crossVectors(u, new THREE.Vector3(1, 0, 0)).normalize(); // Try cross with X
          }
      }
    } else {
      // For 3+ points, we can calculate the normal from the first triangle.
      const tempVec = points3D[2].clone().sub(p0);
      n = u.clone().cross(tempVec).normalize();
    }

    const v = n.clone().cross(u).normalize();

    // The transformMatrix effectively maps points from the 2D plane (with p0 as origin, u as X-axis, v as Y-axis)
    // back to the original 3D space.
    const transformMatrix = new THREE.Matrix4().makeBasis(u, v, n).setPosition(p0);
    const inverseMatrix = transformMatrix.clone().invert(); // This matrix projects 3D points onto our 2D plane.

    const points2D = points3D.map(point => {
      const projectedPoint = point.clone().applyMatrix4(inverseMatrix);
      return new THREE.Vector2(projectedPoint.x, projectedPoint.y);
    });

    // console.log('Successfully projected 3D points to 2D:', points2D);
    return { points2D, transformMatrix, p0 }; // Also return p0 for reference
  }

  // ... (createExtrusionPresets remains the same)
  static createExtrusionPresets(): { [key: string]: ExtrusionSettings } {
    return {
      simple: {
        depth: 1,
        bevelEnabled: false,
        bevelThickness: 0,
        bevelSize: 0,
        bevelSegments: 1,
      },
      beveled: {
        depth: 1,
        bevelEnabled: true,
        bevelThickness: 0.1,
        bevelSize: 0.1,
        bevelSegments: 3,
      },
      deep: {
        depth: 2,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.05,
        bevelSegments: 2,
      },
    };
  }
}