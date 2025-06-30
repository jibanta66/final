import * as THREE from 'three';
// Assuming Vec3 is still relevant, though not directly used in the highlight methods shown
import { Vec3 } from './math';
import { ExtrusionGizmo } from './ExtrusionGizmo';

// --- Interfaces ---
export interface SelectedFace {
    id: string;
    objectId: string;
    faceIndex: number;
    normal: THREE.Vector3;
    center: THREE.Vector3;
    vertices: THREE.Vector3[]; // Ensure these are in world coordinates
    area: number;
    triangleIndices: number[]; // Track all triangle indices that make up this face
}

export interface SelectedEdge {
    id: string;
    objectId: string;
    edgeIndex: number;
    start: THREE.Vector3;
    end: THREE.Vector3;
    length: number;
    direction: THREE.Vector3;
}

export interface FaceEdgeHighlight {
    faces: THREE.Object3D[]; // This will hold the LineSegments for the grid
    edges: THREE.LineSegments[]; // Perimeter edges
    vertices: THREE.Points[]; // NEW: To hold the vertex highlights
}

// --- FaceEdgeSelector Class ---
export class FaceEdgeSelector {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;

    private selectedFaces: Map<string, SelectedFace> = new Map();
    private selectedEdges: Map<string, SelectedEdge> = new Map();
    private highlightObjects: FaceEdgeHighlight = { faces: [], edges: [], vertices: [] }; // Initialized with new vertices array

    // Materials
    private faceGridHighlightMaterial: THREE.LineBasicMaterial; // For the internal grid lines
    private faceVertexHighlightMaterial: THREE.PointsMaterial; // NEW: For the vertex points
    private edgeHighlightMaterial: THREE.LineBasicMaterial;    // For the perimeter edges
    private hoverFaceMaterial: THREE.MeshBasicMaterial;
    private hoverEdgeMaterial: THREE.LineBasicMaterial;

    private isActive: boolean = false;
    private hoveredFace: THREE.Mesh | null = null;
    private hoveredEdge: THREE.LineSegments | null = null;

    // Extrusion gizmo
    private extrusionGizmo: ExtrusionGizmo;
    private onExtrusionCallback?: (faceId: string, distance: number) => void;

    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
        this.scene = scene;
        this.camera = camera;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Initialize materials
        this.faceGridHighlightMaterial = new THREE.LineBasicMaterial({
            color: 0x4ade80, // Green for grid lines
            linewidth: 1,
            transparent: true,
            opacity: 0.7,
            depthTest: false
        });

        this.faceVertexHighlightMaterial = new THREE.PointsMaterial({ // NEW Material for vertices
            color: 0xffff00, // Yellow for vertices
            size: 5,         // Size of the points in pixels
            sizeAttenuation: false, // Keep pixel size constant regardless of distance
            transparent: true,
            opacity: 0.8,
            depthTest: false
        });

        this.edgeHighlightMaterial = new THREE.LineBasicMaterial({
            color: 0x22c55e, // Darker green for perimeter edges
            linewidth: 3,
            transparent: true,
            opacity: 0.8
        });

        this.hoverFaceMaterial = new THREE.MeshBasicMaterial({
            color: 0x60a5fa, // Blue for hover face
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide,
            depthTest: false
        });

        this.hoverEdgeMaterial = new THREE.LineBasicMaterial({
            color: 0x3b82f6, // Darker blue for hover edge
            linewidth: 2,
            transparent: true,
            opacity: 0.6
        });

        // Initialize extrusion gizmo
        this.extrusionGizmo = new ExtrusionGizmo(scene, camera);
        this.extrusionGizmo.setDragCallback((faceId, distance) => {
            if (this.onExtrusionCallback) {
                this.onExtrusionCallback(faceId, distance);
            }
        });
    }

    // --- Public Methods ---
    setActive(active: boolean): void {
        this.isActive = active;
        if (!active) {
            this.clearHover();
            this.clearSelection();
            this.extrusionGizmo.hide();
        }
    }

    isSelectionActive(): boolean {
        return this.isActive;
    }

    setExtrusionCallback(callback: (faceId: string, distance: number) => void): void {
        this.onExtrusionCallback = callback;
    }

    setRenderCallback(callback: () => void): void {
        this.extrusionGizmo.setRenderCallback(callback);
    }

    handleMouseMove(event: MouseEvent, canvas: HTMLCanvasElement, objects: THREE.Mesh[]): boolean {
        if (!this.isActive) return false;

        if (this.extrusionGizmo.handleMouseMove(event, canvas)) {
            return true;
        }

        const rect = canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.updateHover(objects);
        return false;
    }

    handleMouseDown(event: MouseEvent, canvas: HTMLCanvasElement): boolean {
        if (!this.isActive) return false;

        if (this.extrusionGizmo.handleMouseDown(event, canvas)) {
            return true;
        }
        return false;
    }

    handleMouseUp(event: MouseEvent): boolean {
        if (!this.isActive) return false;

        if (this.extrusionGizmo.handleMouseUp(event)) {
            return true;
        }
        return false;
    }

    handleClick(event: MouseEvent, canvas: HTMLCanvasElement, objects: THREE.Mesh[]): boolean {
        if (!this.isActive) return false;

        if (this.extrusionGizmo.isGizmoDragging()) {
            return false;
        }

        const rect = canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        return this.selectFaceOrEdge(objects);
    }

    clearSelection(): void {
        this.selectedFaces.clear();
        this.selectedEdges.clear();
        this.clearHighlights();
        this.clearHover();
        this.extrusionGizmo.hide();
        console.log('Selection cleared.');
    }

    getSelectedFaces(): SelectedFace[] {
        return Array.from(this.selectedFaces.values());
    }

    getSelectedEdges(): SelectedEdge[] {
        return Array.from(this.selectedEdges.values());
    }

    update(): void {
        this.extrusionGizmo.update();
    }

    // --- Face Extrusion Logic ---
    extrudeFace(faceId: string, distance: number): THREE.BufferGeometry | null {
        const face = this.selectedFaces.get(faceId);
        if (!face) {
            console.warn(`Face with ID ${faceId} not found for extrusion.`);
            return null;
        }

        if (face.vertices.length < 3) {
            console.error("Face has less than 3 vertices, cannot extrude.");
            return null;
        }

        console.group(`Extruding Face: ${faceId} with distance: ${distance.toFixed(4)}`);
        console.log("Face contains", face.triangleIndices.length, "triangles");
        console.log("Face vertices count:", face.vertices.length);
        console.log("Face area:", face.area.toFixed(4));
        console.log("Original World Vertices:", face.vertices.map(v => v.toArray().map(n => n.toFixed(4))));
        console.log("Original World Normal:", face.normal.toArray().map(n => n.toFixed(4)));

        const localVertices = this.projectFaceTo2D(face);

        if (localVertices.length === 0) {
            console.error("projectFaceTo2D returned no vertices or degenerate. Aborting extrusion.");
            console.groupEnd();
            return null;
        }
        console.log("Projected 2D vertices (relative to p0):", localVertices.map(v => `(${v.x.toFixed(4)}, ${v.y.toFixed(4)})`));

        const shape = new THREE.Shape();
        try {
            shape.setFromPoints(localVertices);
        } catch (e) {
            console.error("Error creating THREE.Shape from projected points:", e);
            console.groupEnd();
            return null;
        }

        const extrudeSettings = {
            depth: Math.abs(distance),
            bevelEnabled: false
        };

        if (Math.abs(distance) < 1e-6) {
            console.warn(`Extrusion distance is too small (${distance.toFixed(4)}), returning null geometry.`);
            console.groupEnd();
            return null;
        }

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

        const matrix = this.getFaceTransformMatrix(face);

        if (distance < 0) {
            const scaleMatrix = new THREE.Matrix4().makeScale(1, 1, -1);
            matrix.multiply(scaleMatrix);
        }

        geometry.applyMatrix4(matrix);

        console.log(`Extruded geometry created for face ${faceId} with distance ${distance.toFixed(4)}.`);

        geometry.computeBoundingBox();
        if (geometry.boundingBox) {
            console.log("Extruded geometry Bounding Box MIN:", geometry.boundingBox.min.toArray().map(n => n.toFixed(4)));
            console.log("Extruded geometry Bounding Box MAX:", geometry.boundingBox.max.toArray().map(n => n.toFixed(4)));
        } else {
            console.warn("Extruded geometry bounding box could not be computed.");
        }

        console.groupEnd();
        return geometry;
    }

    // --- Private Helper Methods ---

    private updateHover(objects: THREE.Mesh[]): void {
        this.clearHover();

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(objects, false);

        if (intersects.length > 0) {
            const intersection = intersects[0];
            const mesh = intersection.object as THREE.Mesh;

            if (intersection.face && mesh.geometry instanceof THREE.BufferGeometry) {
                this.createHoverFace(mesh, intersection.face, intersection.faceIndex!);
                this.createHoverEdges(mesh, intersection.face, intersection.faceIndex!);
            } else if (!(mesh.geometry instanceof THREE.BufferGeometry)) {
                console.warn("Hovered mesh does not have BufferGeometry. Skipping hover highlight.");
            }
        }
    }

    private selectFaceOrEdge(objects: THREE.Mesh[]): boolean {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(objects, false);

        if (intersects.length > 0) {
            const intersection = intersects[0];
            const mesh = intersection.object as THREE.Mesh;

            if (intersection.face && intersection.faceIndex !== undefined && mesh.geometry instanceof THREE.BufferGeometry) {
                const objectId = mesh.userData.id || 'unknown';
                const completeFace = this.findCompleteFace(mesh, intersection.face, intersection.faceIndex);
                const faceId = `${objectId}-face-${completeFace.faceIndex}`;

                if (this.selectedFaces.has(faceId)) {
                    this.deselectFace(faceId);
                } else {
                    this.clearSelection(); // Clear previous selection
                    this.selectCompleteFace(mesh, completeFace, objectId);
                }
                return true;
            } else if (!(mesh.geometry instanceof THREE.BufferGeometry)) {
                console.warn("Selected mesh does not have BufferGeometry. Skipping face selection.");
            }
        }
        return false;
    }

    private findCompleteFace(mesh: THREE.Mesh, clickedFace: THREE.Face, clickedFaceIndex: number): {
        faceIndex: number;
        triangleIndices: number[];
        vertices: THREE.Vector3[];
        normal: THREE.Vector3;
        center: THREE.Vector3;
        area: number;
    } {
        const geometry = mesh.geometry as THREE.BufferGeometry;
        const indices = geometry.index;

        if (!indices) {
            return this.getSingleTriangleFace(mesh, clickedFace, clickedFaceIndex);
        }

        const tolerance = 1e-6;
        const clickedNormal = clickedFace.normal.clone().normalize();
        const clickedVertices = this.getTriangleVertices(geometry, clickedFaceIndex);
        const worldClickedVertices = clickedVertices.map(v => v.clone().applyMatrix4(mesh.matrixWorld));

        const planePoint = worldClickedVertices[0];
        const worldNormal = clickedNormal.clone().transformDirection(mesh.matrixWorld).normalize();

        const coplanarTriangles: number[] = [clickedFaceIndex];
        const allVertices = new Set<string>();
        worldClickedVertices.forEach(v => allVertices.add(`${v.x.toFixed(6)},${v.y.toFixed(6)},${v.z.toFixed(6)}`));

        const triangleCount = indices.count / 3;
        for (let i = 0; i < triangleCount; i++) {
            if (i === clickedFaceIndex) continue;

            const triVertices = this.getTriangleVertices(geometry, i);
            const worldTriVertices = triVertices.map(v => v.clone().applyMatrix4(mesh.matrixWorld));

            const edge1 = new THREE.Vector3().subVectors(worldTriVertices[1], worldTriVertices[0]);
            const edge2 = new THREE.Vector3().subVectors(worldTriVertices[2], worldTriVertices[0]);
            const triNormal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();

            const normalDot = Math.abs(worldNormal.dot(triNormal));
            if (normalDot < 1 - tolerance) continue;

            const distanceToPlane = Math.abs(worldNormal.dot(new THREE.Vector3().subVectors(worldTriVertices[0], planePoint)));
            if (distanceToPlane > tolerance) continue;

            coplanarTriangles.push(i);
            worldTriVertices.forEach(v => allVertices.add(`${v.x.toFixed(6)},${v.y.toFixed(6)},${v.z.toFixed(6)}`));
        }

        const uniqueVertices = Array.from(allVertices).map(key => {
            const [x, y, z] = key.split(',').map(Number);
            return new THREE.Vector3(x, y, z);
        });

        const center = new THREE.Vector3();
        uniqueVertices.forEach(v => center.add(v));
        center.divideScalar(uniqueVertices.length);

        let totalArea = 0;
        for (const triIndex of coplanarTriangles) {
            const triVertices = this.getTriangleVertices(geometry, triIndex);
            const worldTriVertices = triVertices.map(v => v.clone().applyMatrix4(mesh.matrixWorld));
            totalArea += this.calculateTriangleArea(worldTriVertices[0], worldTriVertices[1], worldTriVertices[2]);
        }

        console.log(`Found complete face with ${coplanarTriangles.length} triangles, ${uniqueVertices.length} vertices, area: ${totalArea.toFixed(4)}`);

        return {
            faceIndex: clickedFaceIndex,
            triangleIndices: coplanarTriangles,
            vertices: uniqueVertices,
            normal: worldNormal,
            center,
            area: totalArea
        };
    }

    private getSingleTriangleFace(mesh: THREE.Mesh, face: THREE.Face, faceIndex: number): {
        faceIndex: number;
        triangleIndices: number[];
        vertices: THREE.Vector3[];
        normal: THREE.Vector3;
        center: THREE.Vector3;
        area: number;
    } {
        const geometry = mesh.geometry as THREE.BufferGeometry;
        const vertices = this.getTriangleVertices(geometry, faceIndex);
        const worldVertices = vertices.map(v => v.clone().applyMatrix4(mesh.matrixWorld));

        const worldNormal = face.normal.clone().transformDirection(mesh.matrixWorld).normalize();
        const center = new THREE.Vector3()
            .add(worldVertices[0])
            .add(worldVertices[1])
            .add(worldVertices[2])
            .divideScalar(3);

        const area = this.calculateTriangleArea(worldVertices[0], worldVertices[1], worldVertices[2]);

        return {
            faceIndex,
            triangleIndices: [faceIndex],
            vertices: worldVertices,
            normal: worldNormal,
            center,
            area
        };
    }

    private getTriangleVertices(geometry: THREE.BufferGeometry, triangleIndex: number): THREE.Vector3[] {
        const position = geometry.attributes.position;
        const indices = geometry.index;

        if (indices) {
            const a = indices.getX(triangleIndex * 3);
            const b = indices.getX(triangleIndex * 3 + 1);
            const c = indices.getX(triangleIndex * 3 + 2);

            return [
                new THREE.Vector3().fromBufferAttribute(position, a),
                new THREE.Vector3().fromBufferAttribute(position, b),
                new THREE.Vector3().fromBufferAttribute(position, c)
            ];
        } else {
            return [
                new THREE.Vector3().fromBufferAttribute(position, triangleIndex * 3),
                new THREE.Vector3().fromBufferAttribute(position, triangleIndex * 3 + 1),
                new THREE.Vector3().fromBufferAttribute(position, triangleIndex * 3 + 2)
            ];
        }
    }

    private selectCompleteFace(mesh: THREE.Mesh, completeFace: any, objectId: string): void {
        const faceId = `${objectId}-face-${completeFace.faceIndex}`;

        const selectedFace: SelectedFace = {
            id: faceId,
            objectId,
            faceIndex: completeFace.faceIndex,
            normal: completeFace.normal,
            center: completeFace.center,
            vertices: completeFace.vertices,
            area: completeFace.area,
            triangleIndices: completeFace.triangleIndices
        };

        this.selectedFaces.set(faceId, selectedFace);
        this.createFaceHighlight(selectedFace); // Creates grid lines AND vertex points
        this.createEdgeHighlights(selectedFace); // Creates perimeter edges

        this.extrusionGizmo.showForFace(selectedFace);

        console.log('Complete face selected:', faceId);
        console.log('Face contains', completeFace.triangleIndices.length, 'triangles');
        console.log('Face has', completeFace.vertices.length, 'unique vertices');
        console.log('Face area:', completeFace.area.toFixed(4));
        console.log('Face normal:', completeFace.normal.toArray().map((n: number) => n.toFixed(4)));
        console.log('Face center:', completeFace.center.toArray().map((n: number) => n.toFixed(4)));
    }

    private deselectFace(faceId: string): void {
        this.selectedFaces.delete(faceId);
        this.updateHighlights();

        if (this.selectedFaces.size === 0) {
            this.extrusionGizmo.hide();
        }
        console.log('Face deselected:', faceId);
    }

    /**
     * Helper to extract unique edges from a flat Float32Array of triangle vertices.
     * Used for creating the internal grid lines.
     */
    private getUniqueEdges(triangulatedVertices: Float32Array): Float32Array {
        const edges = new Set<string>();
        const result: number[] = [];

        for (let i = 0; i < triangulatedVertices.length; i += 9) { // Each triangle has 9 floats (3 vertices * 3 components)
            const v1 = new THREE.Vector3(triangulatedVertices[i], triangulatedVertices[i + 1], triangulatedVertices[i + 2]);
            const v2 = new THREE.Vector3(triangulatedVertices[i + 3], triangulatedVertices[i + 4], triangulatedVertices[i + 5]);
            const v3 = new THREE.Vector3(triangulatedVertices[i + 6], triangulatedVertices[i + 7], triangulatedVertices[i + 8]);

            const addEdge = (p1: THREE.Vector3, p2: THREE.Vector3) => {
                const key1 = `${p1.x.toFixed(6)},${p1.y.toFixed(6)},${p1.z.toFixed(6)}`;
                const key2 = `${p2.x.toFixed(6)},${p2.y.toFixed(6)},${p2.z.toFixed(6)}`;
                const edgeKey = [key1, key2].sort().join('-'); // Ensures consistent key for an edge regardless of direction

                if (!edges.has(edgeKey)) {
                    edges.add(edgeKey);
                    result.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
                }
            };

            addEdge(v1, v2);
            addEdge(v2, v3);
            addEdge(v3, v1);
        }
        return new Float32Array(result);
    }

    /**
     * Helper to extract unique vertices from a flat Float32Array (e.g., from triangulated face).
     * Used for creating the vertex points.
     */
    private getUniqueVertices(verticesData: Float32Array): Float32Array {
        const uniqueVertices = new Set<string>();
        const result: number[] = [];

        for (let i = 0; i < verticesData.length; i += 3) {
            const x = verticesData[i];
            const y = verticesData[i + 1];
            const z = verticesData[i + 2];
            const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`; // Use fixed precision for consistent keys

            if (!uniqueVertices.has(key)) {
                uniqueVertices.add(key);
                result.push(x, y, z);
            }
        }
        return new Float32Array(result);
    }

    private createFaceHighlight(face: SelectedFace): void {
        if (face.vertices.length < 3) {
            console.warn('Face has less than 3 vertices, cannot create grid highlight');
            return;
        }

        const triangulatedVertices = this.triangulateFace(face.vertices, face.normal);
        if (triangulatedVertices.length === 0) {
            console.warn('Triangulation failed for face grid, aborting.');
            return;
        }

        // --- NEW LOGGING FOR TRIANGLE COORDINATES ---
        console.group(`Details for Selected Face (ID: ${face.id}) Triangles:`);
        for (let i = 0; i < triangulatedVertices.length; i += 9) { // Each triangle has 9 floats (3 vertices * 3 components)
            const v1x = triangulatedVertices[i];
            const v1y = triangulatedVertices[i + 1];
            const v1z = triangulatedVertices[i + 2];

            const v2x = triangulatedVertices[i + 3];
            const v2y = triangulatedVertices[i + 4];
            const v2z = triangulatedVertices[i + 5];

            const v3x = triangulatedVertices[i + 6];
            const v3y = triangulatedVertices[i + 7];
            const v3z = triangulatedVertices[i + 8];

            const triangleNumber = (i / 9) + 1; // Calculate current triangle index (1-based)

            console.log(`  Triangle ${triangleNumber} Vertices:`);
            console.log(`    V1: (${v1x.toFixed(4)}, ${v1y.toFixed(4)}, ${v1z.toFixed(4)})`);
            console.log(`    V2: (${v2x.toFixed(4)}, ${v2y.toFixed(4)}, ${v2z.toFixed(4)})`);
            console.log(`    V3: (${v3x.toFixed(4)}, ${v3y.toFixed(4)}, ${v3z.toFixed(4)})`);
        }
        console.groupEnd();
        // --- END NEW LOGGING ---


        // 1. Create the mesh grid (LineSegments)
        const gridEdgesPositions = this.getUniqueEdges(triangulatedVertices);
        const gridGeometry = new THREE.BufferGeometry();
        gridGeometry.setAttribute('position', new THREE.BufferAttribute(gridEdgesPositions, 3));
        const highlightGrid = new THREE.LineSegments(gridGeometry, this.faceGridHighlightMaterial);
        highlightGrid.renderOrder = 1000;
        highlightGrid.userData = { type: 'face-grid-highlight', faceId: face.id };
        this.scene.add(highlightGrid);
        this.highlightObjects.faces.push(highlightGrid);

        // 2. Create the vertex points (Points)
        const uniqueFaceVertices = this.getUniqueVertices(triangulatedVertices);
        if (uniqueFaceVertices.length > 0) {
            const pointsGeometry = new THREE.BufferGeometry();
            pointsGeometry.setAttribute('position', new THREE.BufferAttribute(uniqueFaceVertices, 3));

            const highlightPoints = new THREE.Points(pointsGeometry, this.faceVertexHighlightMaterial);
            highlightPoints.renderOrder = 1002;
            highlightPoints.userData = { type: 'face-vertex-highlight', faceId: face.id };
            this.scene.add(highlightPoints);
            this.highlightObjects.vertices.push(highlightPoints);
        }
    }

    private triangulateFace(vertices: THREE.Vector3[], normal: THREE.Vector3): Float32Array {
        if (vertices.length < 3) {
            return new Float32Array();
        }

        if (vertices.length === 3) {
            const result = new Float32Array(9);
            for (let i = 0; i < 3; i++) {
                result[i * 3] = vertices[i].x;
                result[i * 3 + 1] = vertices[i].y;
                result[i * 3 + 2] = vertices[i].z;
            }
            return result;
        }

        // Simple fan triangulation for N-gons. For complex concave or hole-filled polygons,
        // consider a library like Earcut.js for robust triangulation.
        const triangles: number[] = [];
        const first = 0;

        for (let i = 1; i < vertices.length - 1; i++) {
            triangles.push(first, i, i + 1);
        }

        const result = new Float32Array(triangles.length * 3);
        for (let i = 0; i < triangles.length; i++) {
            const vertexIndex = triangles[i];
            const vertex = vertices[vertexIndex];
            result[i * 3] = vertex.x;
            result[i * 3 + 1] = vertex.y;
            result[i * 3 + 2] = vertex.z;
        }
        return result;
    }

    private createEdgeHighlights(face: SelectedFace): void {
        if (face.vertices.length < 3) return;

        for (let i = 0; i < face.vertices.length; i++) {
            const start = face.vertices[i];
            const end = face.vertices[(i + 1) % face.vertices.length];

            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array([
                start.x, start.y, start.z,
                end.x, end.y, end.z
            ]);

            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

            const edgeLine = new THREE.LineSegments(geometry, this.edgeHighlightMaterial);
            edgeLine.renderOrder = 1001; // Render slightly on top of the face grid
            edgeLine.userData = { type: 'edge-highlight', faceId: face.id, edgeIndex: i };

            this.scene.add(edgeLine);
            this.highlightObjects.edges.push(edgeLine);
        }
    }

    private createHoverFace(mesh: THREE.Mesh, face: THREE.Face, faceIndex: number): void {
        const geometry = mesh.geometry as THREE.BufferGeometry;
        const position = geometry.attributes.position;
        const indices = geometry.index;

        const vertices: THREE.Vector3[] = [];
        if (indices) {
            const a = indices.getX(faceIndex * 3);
            const b = indices.getX(faceIndex * 3 + 1);
            const c = indices.getX(faceIndex * 3 + 2);
            vertices.push(
                new THREE.Vector3().fromBufferAttribute(position, a),
                new THREE.Vector3().fromBufferAttribute(position, b),
                new THREE.Vector3().fromBufferAttribute(position, c)
            );
        } else {
            vertices.push(
                new THREE.Vector3().fromBufferAttribute(position, faceIndex * 3),
                new THREE.Vector3().fromBufferAttribute(position, faceIndex * 3 + 1),
                new THREE.Vector3().fromBufferAttribute(position, faceIndex * 3 + 2)
            );
        }

        const worldVertices = vertices.map(v => v.clone().applyMatrix4(mesh.matrixWorld));

        const hoverGeometry = new THREE.BufferGeometry();
        const hoverVertices = new Float32Array(9);
        for (let i = 0; i < 3; i++) {
            hoverVertices[i * 3] = worldVertices[i].x;
            hoverVertices[i * 3 + 1] = worldVertices[i].y;
            hoverVertices[i * 3 + 2] = worldVertices[i].z;
        }

        hoverGeometry.setAttribute('position', new THREE.BufferAttribute(hoverVertices, 3));
        hoverGeometry.computeVertexNormals();

        this.hoveredFace = new THREE.Mesh(hoverGeometry, this.hoverFaceMaterial);
        this.hoveredFace.renderOrder = 999;
        this.scene.add(this.hoveredFace);
    }

    private createHoverEdges(mesh: THREE.Mesh, face: THREE.Face, faceIndex: number): void {
        const geometry = mesh.geometry as THREE.BufferGeometry;
        const position = geometry.attributes.position;
        const indices = geometry.index;

        const vertices: THREE.Vector3[] = [];
        if (indices) {
            const a = indices.getX(faceIndex * 3);
            const b = indices.getX(faceIndex * 3 + 1);
            const c = indices.getX(faceIndex * 3 + 2);
            vertices.push(
                new THREE.Vector3().fromBufferAttribute(position, a),
                new THREE.Vector3().fromBufferAttribute(position, b),
                new THREE.Vector3().fromBufferAttribute(position, c)
            );
        } else {
            vertices.push(
                new THREE.Vector3().fromBufferAttribute(position, faceIndex * 3),
                new THREE.Vector3().fromBufferAttribute(position, faceIndex * 3 + 1),
                new THREE.Vector3().fromBufferAttribute(position, faceIndex * 3 + 2)
            );
        }

        const worldVertices = vertices.map(v => v.clone().applyMatrix4(mesh.matrixWorld));

        const edges = [
            [worldVertices[0], worldVertices[1]],
            [worldVertices[1], worldVertices[2]],
            [worldVertices[2], worldVertices[0]]
        ];

        const edgeGeometry = new THREE.BufferGeometry();
        const edgePositions = new Float32Array(18); // 3 edges * 2 vertices * 3 components

        let index = 0;
        edges.forEach(edge => {
            edgePositions[index++] = edge[0].x;
            edgePositions[index++] = edge[0].y;
            edgePositions[index++] = edge[0].z;
            edgePositions[index++] = edge[1].x;
            edgePositions[index++] = edge[1].y;
            edgePositions[index++] = edge[1].z;
        });

        edgeGeometry.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));

        this.hoveredEdge = new THREE.LineSegments(edgeGeometry, this.hoverEdgeMaterial);
        this.hoveredEdge.renderOrder = 1000;
        this.scene.add(this.hoveredEdge);
    }

    private clearHover(): void {
        if (this.hoveredFace) {
            this.scene.remove(this.hoveredFace);
            this.hoveredFace.geometry.dispose();
            this.hoveredFace = null;
        }

        if (this.hoveredEdge) {
            this.scene.remove(this.hoveredEdge);
            this.hoveredEdge.geometry.dispose();
            this.hoveredEdge = null;
        }
    }

    private updateHighlights(): void {
        this.clearHighlights();

        this.selectedFaces.forEach(face => {
            this.createFaceHighlight(face);
            this.createEdgeHighlights(face);
        });
    }

    private clearHighlights(): void {
        this.highlightObjects.faces.forEach(obj => {
            this.scene.remove(obj);
            // Use a type guard to ensure 'obj' has a 'geometry' property before disposing.
            // THREE.Mesh, THREE.LineSegments, and THREE.Points all have this.
            if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.Points) {
                obj.geometry.dispose();
            }
        });

        this.highlightObjects.edges.forEach(line => {
            this.scene.remove(line);
            line.geometry.dispose();
        });

        this.highlightObjects.vertices.forEach(points => {
            this.scene.remove(points);
            points.geometry.dispose();
        });

        this.highlightObjects.faces = [];
        this.highlightObjects.edges = [];
        this.highlightObjects.vertices = [];
    }

    private projectFaceTo2D(face: SelectedFace): THREE.Vector2[] {
        if (face.vertices.length < 3) {
            console.error("Face has less than 3 vertices");
            return [];
        }

        const vertices = face.vertices;
        const normal = face.normal.clone().normalize();

        let uAxis = new THREE.Vector3(1, 0, 0);
        if (Math.abs(normal.dot(uAxis)) > 0.9) {
            uAxis = new THREE.Vector3(0, 1, 0);
        }

        const vAxis = new THREE.Vector3().crossVectors(normal, uAxis).normalize();
        uAxis = new THREE.Vector3().crossVectors(vAxis, normal).normalize();

        const centroid = new THREE.Vector3();
        vertices.forEach(v => centroid.add(v));
        centroid.divideScalar(vertices.length);

        console.log("Projection centroid:", centroid.toArray().map(n => n.toFixed(4)));
        console.log("Projection U-axis:", uAxis.toArray().map(n => n.toFixed(4)));
        console.log("Projection V-axis:", vAxis.toArray().map(n => n.toFixed(4)));
        console.log("Projection Normal:", normal.toArray().map(n => n.toFixed(4)));

        const projectedVertices: THREE.Vector2[] = vertices.map(vertex => {
            const local = new THREE.Vector3().subVectors(vertex, centroid);
            return new THREE.Vector2(local.dot(uAxis), local.dot(vAxis));
        });

        console.log("Projected 2D vertices:", projectedVertices.map(v => `(${v.x.toFixed(4)}, ${v.y.toFixed(4)})`));

        const area = this.calculatePolygonArea2D(projectedVertices);
        console.log("Projected 2D area:", area.toFixed(6));

        if (Math.abs(area) < 1e-8) {
            console.error("Projected 2D vertices form a degenerate (zero-area) shape.");
            return [];
        }

        if (area < 0) {
            console.log("Reversing vertex order for counter-clockwise winding (projected 2D).");
            projectedVertices.reverse();
        }

        return projectedVertices;
    }

    private calculatePolygonArea2D(vertices: THREE.Vector2[]): number {
        if (vertices.length < 3) return 0;

        let area = 0;
        for (let i = 0; i < vertices.length; i++) {
            const j = (i + 1) % vertices.length;
            area += vertices[i].x * vertices[j].y;
            area -= vertices[j].x * vertices[i].y;
        }
        return area / 2;
    }

    private getFaceTransformMatrix(face: SelectedFace): THREE.Matrix4 {
        const normal = face.normal.clone().normalize();

        let uAxis = new THREE.Vector3(1, 0, 0);
        if (Math.abs(normal.dot(uAxis)) > 0.9) {
            uAxis = new THREE.Vector3(0, 1, 0);
        }

        const vAxis = new THREE.Vector3().crossVectors(normal, uAxis).normalize();
        uAxis = new THREE.Vector3().crossVectors(vAxis, normal).normalize();

        const origin = face.center.clone();

        const matrix = new THREE.Matrix4();
        matrix.set(
            uAxis.x, vAxis.x, normal.x, origin.x,
            uAxis.y, vAxis.y, normal.y, origin.y,
            uAxis.z, vAxis.z, normal.z, origin.z,
            0,       0,       0,       1
        );

        console.log('Face Transform Matrix Origin (Face Center):', origin.toArray().map(n => n.toFixed(4)));
        console.log('Face Transform Matrix U-Axis:', uAxis.toArray().map(n => n.toFixed(4)));
        console.log('Face Transform Matrix V-Axis:', vAxis.toArray().map(n => n.toFixed(4)));
        console.log('Face Transform Matrix Normal:', normal.toArray().map(n => n.toFixed(4)));

        return matrix;
    }

    private calculateTriangleArea(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): number {
        const ab = b.clone().sub(a);
        const ac = c.clone().sub(a);
        return ab.cross(ac).length() * 0.5;
    }

    getMeasurementBetweenFaces(): number | null {
        const faces = Array.from(this.selectedFaces.values());
        if (faces.length !== 2) return null;

        return faces[0].center.distanceTo(faces[1].center);
    }

    dispose(): void {
        this.clearSelection();
        this.faceGridHighlightMaterial.dispose();
        this.faceVertexHighlightMaterial.dispose();
        this.edgeHighlightMaterial.dispose();
        this.hoverFaceMaterial.dispose();
        this.hoverEdgeMaterial.dispose();
        this.extrusionGizmo.dispose();
        console.log('FaceEdgeSelector disposed.');
    }
}