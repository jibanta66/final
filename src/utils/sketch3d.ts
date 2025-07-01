import * as THREE from 'three';

export interface SketchPoint3D {
    position: THREE.Vector3;
    id: string;
    onSurface?: boolean;
    surfaceNormal?: THREE.Vector3;
}

export interface SketchShape3D {
    type: 'line' | 'rectangle' | 'circle' | 'polygon' | 'spline';
    points: SketchPoint3D[];
    id: string;
    closed: boolean;
    workplane?: THREE.Plane;
    normal?: THREE.Vector3;
}

export class SketchEngine3D {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;

    private shapes: SketchShape3D[] = [];
    private currentTool: string = 'line';
    private sketchMode: 'surface' | 'plane' | 'free' = 'surface'; // 'surface' mode will attempt to align to clicked surfaces
    private isDrawing: boolean = false;
    private currentShape: SketchShape3D | null = null;
    private workplane: THREE.Mesh | null = null;
    private gridHelper: THREE.GridHelper | null = null;

    private snapToGrid: boolean = true;
    private gridSize: number = 0.5;
    private workplaneVisible: boolean = true;

    private sketchLines: THREE.Line[] = [];
    private sketchMeshes: THREE.Mesh[] = [];
    private previewLine: THREE.Line | null = null;
    private previewMesh: THREE.Mesh | null = null;
    private sketchPoints: THREE.Mesh[] = [];

    // Drawing state
    private startPoint: THREE.Vector3 | null = null;
    private isDragging: boolean = false;
    private hasWorkplane: boolean = false; // Tracks if a workplane has been set

    // Multi-line drawing state for connected lines
    private multiLinePoints: THREE.Vector3[] = [];
    private isMultiLineMode: boolean = false;

    // --- New property to store the initial click point for dynamic workplane creation ---
    private initialClickPoint: THREE.Vector3 | null = null;
    private initialClickNormal: THREE.Vector3 | null = null;

    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Workplane is not created in constructor anymore
    }

    private clearWorkplane(): void {
        if (this.workplane) {
            this.scene.remove(this.workplane);
            this.workplane.geometry.dispose();
            (this.workplane.material as THREE.Material).dispose();
            this.workplane = null;
        }

        if (this.gridHelper) {
            this.scene.remove(this.gridHelper);
            (this.gridHelper.material as THREE.Material).dispose();
            this.gridHelper = null;
        }

        this.hasWorkplane = false;
        this.initialClickPoint = null; // Clear initial click data
        this.initialClickNormal = null;
        console.log('Workplane cleared');
    }

    // Main event handlers
    handleClick(event: MouseEvent): boolean {
        // Ensure mouse position is always updated first
        this.updateMousePosition(event);

        // Ignore click if currently dragging (to avoid conflicts)
        if (this.isDragging) return false;

        // If no workplane exists, the first click defines it
        if (!this.hasWorkplane) {
            return this.initializeWorkplane();
        }

        switch (this.currentTool) {
            case 'line':
                return this.handleLineClick();
            case 'rectangle':
                // rectangle uses drag only, ignore click
                return false;
            case 'circle':
                // circle uses drag only, ignore click
                return false;
            case 'polygon':
                return this.handlePolygonClick();
            default:
                return false;
        }
    }

    // Start dragging for rectangle or circle
    handleMouseDown(event: MouseEvent): boolean {
        if (event.button !== 0 || !this.hasWorkplane) return false; // Only allow drag if workplane exists

        this.updateMousePosition(event); // Update mouse position on mouse down

        if (this.currentTool === 'rectangle' || this.currentTool === 'circle') {
            return this.startDragOperation();
        }

        return false;
    }

    // Update preview during dragging
    handleMouseMove(event: MouseEvent): boolean {
        this.updateMousePosition(event); // Update mouse position on mouse move

        if (this.isDragging && this.hasWorkplane) {
            this.updateDragPreview();
            return true;
        }

        // Show preview for multi-line mode
        if (this.isMultiLineMode && this.multiLinePoints.length > 0) {
            this.updateMultiLinePreview();
            return true;
        }

        return false;
    }

    // Finish drawing shape on mouse up if dragging
    handleMouseUp(event: MouseEvent): boolean {
        this.updateMousePosition(event); // Update mouse position on mouse up

        if (this.isDragging && this.hasWorkplane) {
            this.finishDragOperation();
            return true;
        }
        return false;
    }

    handleDoubleClick(event: MouseEvent): boolean {
        this.updateMousePosition(event); // Update mouse position on double click

        if (this.currentTool === 'polygon' && this.currentShape) {
            this.finishPolygon();
            return true;
        }

        // Double-click to finish multi-line drawing
        if (this.currentTool === 'line' && this.isMultiLineMode && this.multiLinePoints.length >= 2) {
            this.finishMultiLine();
            return true;
        }

        return false;
    }

    // Tool-specific handlers
    private handleLineClick(): boolean {
        const point = this.getWorkplaneIntersection();
        if (!point) return false;

        if (!this.isMultiLineMode) {
            // Start multi-line mode
            this.isMultiLineMode = true;
            this.multiLinePoints = [point.clone()];
            this.addSketchPoint(point);
            console.log('Started multi-line drawing at:', point);
        } else {
            // Add point to multi-line
            this.multiLinePoints.push(point.clone());
            this.addSketchPoint(point);
            this.updateMultiLinePreview();
            console.log('Added point to multi-line:', point);
        }

        return true;
    }

    private handlePolygonClick(): boolean {
        const point = this.getWorkplaneIntersection();
        if (!point) return false;

        if (!this.currentShape) {
            this.currentShape = {
                type: 'polygon',
                points: [{
                    position: point.clone(),
                    id: `point-${Date.now()}`,
                    onSurface: true
                }],
                id: `polygon-${Date.now()}`,
                closed: false
            };
            this.addSketchPoint(point);
            console.log('Started polygon at:', point);
        } else {
            this.currentShape.points.push({
                position: point.clone(),
                id: `point-${Date.now()}`,
                onSurface: true
            });
            this.addSketchPoint(point);
            this.updatePolygonPreview();
        }
        return true;
    }

    // Drag operations
    private startDragOperation(): boolean {
        const point = this.getWorkplaneIntersection();
        if (!point) return false;

        this.startPoint = point.clone();
        this.isDragging = true;

        this.clearPreview();
        this.addSketchPoint(point);
        console.log(`Started dragging ${this.currentTool} at:`, point);
        return true;
    }

    private updateDragPreview(): void {
        if (!this.startPoint) return;
        const currentPoint = this.getWorkplaneIntersection();
        if (!currentPoint) return;

        this.clearPreview();

        if (this.currentTool === 'rectangle') {
            this.createRectanglePreview(this.startPoint, currentPoint);
        } else if (this.currentTool === 'circle') {
            this.createCirclePreview(this.startPoint, currentPoint);
        }
    }

    private finishDragOperation(): void {
        if (!this.startPoint) return;

        const endPoint = this.getWorkplaneIntersection();
        if (!endPoint) {
            console.warn('No end point found on drag finish!');
            this.isDragging = false;
            this.startPoint = null;
            this.clearPreview();
            return;
        }

        console.log('Drag finished from', this.startPoint, 'to', endPoint);

        // Check distance threshold to avoid zero-area shapes
        if (this.startPoint.distanceTo(endPoint) < 0.01) {
            console.warn("Drag distance too small; ignoring shape creation.");
            this.isDragging = false;
            this.startPoint = null;
            this.clearPreview();
            return;
        }

        if (this.currentTool === 'rectangle') {
            this.finishRectangle(endPoint);
        } else if (this.currentTool === 'circle') {
            this.finishCircle(endPoint);
        }

        this.isDragging = false;
        this.startPoint = null;
        this.clearPreview();
    }

    // Multi-line drawing methods
    private updateMultiLinePreview(): void {
        if (this.multiLinePoints.length === 0) return;

        const currentPoint = this.getWorkplaneIntersection();
        if (!currentPoint) return;

        this.clearPreview();

        // Create preview line from last point to current mouse position
        const previewPoints = [...this.multiLinePoints, currentPoint];

        const geometry = new THREE.BufferGeometry().setFromPoints(previewPoints);
        const material = new THREE.LineBasicMaterial({
            color: 0x60a5fa,
            transparent: true,
            opacity: 0.7,
            linewidth: 2
        });

        this.previewLine = new THREE.Line(geometry, material);
        this.scene.add(this.previewLine);
    }

    private finishMultiLine(): void {
        if (this.multiLinePoints.length < 2) return;

        // Create a closed polygon from the multi-line points
        const shape: SketchShape3D = {
            type: 'polygon', // Changed from 'line' to 'polygon' for extrusion
            points: this.multiLinePoints.map((pos, i) => ({
                position: pos.clone(),
                id: `point-${Date.now()}-${i}`,
                onSurface: true
            })),
            id: `multiline-${Date.now()}`,
            closed: true // Mark as closed for extrusion
        };

        this.createSketchLine(shape);
        this.shapes.push(shape);
        console.log('Created multi-line shape (as closed polygon):', shape);

        // Reset multi-line state
        this.isMultiLineMode = false;
        this.multiLinePoints = [];
        this.clearPreview();
    }

    // Shape completion methods
    private finishRectangle(endPoint: THREE.Vector3): void {
        if (!this.startPoint) return;

        const start = this.startPoint;
        const end = endPoint;

        // Convert to local workplane coordinates for rectangle corner calculation
        const startLocal = this.worldToWorkplane(start);
        const endLocal = this.worldToWorkplane(end);

        const corners = [
            new THREE.Vector3(startLocal.x, startLocal.y, 0),
            new THREE.Vector3(endLocal.x, startLocal.y, 0),
            new THREE.Vector3(endLocal.x, endLocal.y, 0),
            new THREE.Vector3(startLocal.x, endLocal.y, 0)
        ];

        const worldCorners = corners.map(corner => this.workplaneToWorld(corner));

        const shape: SketchShape3D = {
            type: 'rectangle',
            points: worldCorners.map((pos, i) => ({
                position: pos,
                id: `point-${Date.now()}-${i}`,
                onSurface: true
            })),
            id: `rect-${Date.now()}`,
            closed: true
        };

        worldCorners.forEach(corner => this.addSketchPoint(corner));
        this.createSketchLine(shape);
        this.shapes.push(shape);
        console.log('Created rectangle shape:', shape);
    }

    private finishCircle(edgePoint: THREE.Vector3): void {
        if (!this.startPoint) return;

        const shape: SketchShape3D = {
            type: 'circle',
            points: [
                {
                    position: this.startPoint.clone(),
                    id: `point-${Date.now()}`,
                    onSurface: true
                },
                {
                    position: edgePoint.clone(),
                    id: `point-${Date.now()}`,
                    onSurface: true
                }
            ],
            id: `circle-${Date.now()}`,
            closed: true
        };

        this.addSketchPoint(edgePoint);
        this.createSketchCircle(shape);
        this.shapes.push(shape);
        console.log('Created circle:', shape);
    }

    private finishPolygon(): void {
        if (!this.currentShape || this.currentShape.points.length < 3) return;

        this.currentShape.closed = true;
        this.createSketchLine(this.currentShape);
        this.shapes.push(this.currentShape);
        console.log('Created polygon:', this.currentShape);
        this.currentShape = null;
        this.clearPreview();
    }

    // Preview methods
    private createRectanglePreview(start: THREE.Vector3, end: THREE.Vector3): void {
        const startLocal = this.worldToWorkplane(start);
        const endLocal = this.worldToWorkplane(end);

        const corners = [
            new THREE.Vector3(startLocal.x, startLocal.y, 0),
            new THREE.Vector3(endLocal.x, startLocal.y, 0),
            new THREE.Vector3(endLocal.x, endLocal.y, 0),
            new THREE.Vector3(startLocal.x, endLocal.y, 0),
            new THREE.Vector3(startLocal.x, startLocal.y, 0), // close rectangle
        ];

        const worldCorners = corners.map(corner => this.workplaneToWorld(corner));

        const geometry = new THREE.BufferGeometry().setFromPoints(worldCorners);
        const material = new THREE.LineBasicMaterial({
            color: 0x60a5fa,
            transparent: true,
            opacity: 0.7,
            linewidth: 2,
        });

        this.previewLine = new THREE.Line(geometry, material);
        this.scene.add(this.previewLine);
    }

    private createCirclePreview(center: THREE.Vector3, edge: THREE.Vector3): void {
        if (this.previewLine) {
            this.scene.remove(this.previewLine);
            this.previewLine.geometry.dispose();
            (this.previewLine.material as THREE.Material).dispose();
            this.previewLine = null;
        }

        // Project center and edge to workplane to get 2D radius
        const centerLocal = this.worldToWorkplane(center);
        const edgeLocal = this.worldToWorkplane(edge);
        const radius2D = centerLocal.distanceTo(edgeLocal);


        const curve = new THREE.EllipseCurve(
            0, 0,
            radius2D, radius2D, // Use 2D radius for the curve
            0, 2 * Math.PI,
            false,
            0
        );

        const points = curve.getPoints(64);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0x60a5fa,
            transparent: true,
            opacity: 0.7,
            linewidth: 2
        });

        this.previewLine = new THREE.Line(geometry, material);

        // Position the preview line correctly relative to the workplane
        // The circle is drawn at (0,0) of the local workplane, so its center should be at centerLocal
        this.previewLine.position.copy(this.workplaneToWorld(new THREE.Vector3(centerLocal.x, centerLocal.y, 0)));

        // Apply workplane rotation to the preview line
        if (this.workplane) {
            this.previewLine.quaternion.copy(this.workplane.quaternion); // Use quaternion for rotation
        }

        this.scene.add(this.previewLine);
    }

    private updatePolygonPreview(): void {
        if (!this.currentShape) return;
        this.clearPreview();

        const pointsWorld = this.currentShape.points.map(p => p.position.clone());
        // For preview, close the loop visually
        pointsWorld.push(pointsWorld[0].clone());

        const geometry = new THREE.BufferGeometry().setFromPoints(pointsWorld);
        const material = new THREE.LineBasicMaterial({
            color: 0x60a5fa,
            transparent: true,
            opacity: 0.7,
            linewidth: 2
        });

        this.previewLine = new THREE.Line(geometry, material);
        this.scene.add(this.previewLine);
    }

    // Sketch helpers
    private createSketchLine(shape: SketchShape3D): void {
        const points = shape.points.map(p => p.position.clone());
        if (shape.closed) {
            points.push(points[0].clone()); // closes the loop
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 2 });
        const line = new THREE.Line(geometry, material);

        this.scene.add(line);
        this.sketchLines.push(line);
    }

    private createSketchCircle(shape: SketchShape3D): void {
        const center = shape.points[0].position;
        const edge = shape.points[1].position;

        // Project center and edge to workplane to get 2D radius
        const centerLocal = this.worldToWorkplane(center);
        const edgeLocal = this.worldToWorkplane(edge);
        const radius2D = centerLocal.distanceTo(edgeLocal);

        const curve = new THREE.EllipseCurve(
            0, 0,
            radius2D, radius2D,
            0, 2 * Math.PI,
            false,
            0
        );

        const points = curve.getPoints(64);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 2 });

        const circle = new THREE.Line(geometry, material);
        // Position the circle correctly relative to the workplane
        circle.position.copy(this.workplaneToWorld(new THREE.Vector3(centerLocal.x, centerLocal.y, 0)));

        if (this.workplane) {
            circle.quaternion.copy(this.workplane.quaternion); // Use quaternion for rotation
        }

        this.scene.add(circle);
        this.sketchLines.push(circle);
    }

    private addSketchPoint(position: THREE.Vector3): void {
        const geometry = new THREE.SphereGeometry(0.02, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const pointMesh = new THREE.Mesh(geometry, material);
        pointMesh.position.copy(position);
        this.scene.add(pointMesh);
        this.sketchPoints.push(pointMesh);
    }

    // New / Modified Workplane Helper Methods
    private initializeWorkplane(): boolean {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        // Intersect with all objects in the scene, excluding the camera itself
        // To prevent the ray from hitting the workplane before it's defined,
        // we might need a specific list of "hittable" objects. For now,
        // intersecting with all children (excluding grid/workplane itself once created) is common.
        // If your scene has other objects, they will be considered.
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        let intersectionPoint: THREE.Vector3 | null = null;
        let surfaceNormal: THREE.Vector3 | null = null;

        // Filter out the workplane and grid helper themselves if they happen to exist from a previous state
        const filteredIntersects = intersects.filter(i =>
            i.object !== this.workplane && i.object !== this.gridHelper
        );

        if (filteredIntersects.length > 0) {
            // Found an intersection with an existing object
            intersectionPoint = filteredIntersects[0].point;
            // Get the normal of the intersected face, transformed to world space
            if (filteredIntersects[0].face && filteredIntersects[0].object instanceof THREE.Mesh) {
                surfaceNormal = filteredIntersects[0].face.normal.clone();
                surfaceNormal.transformDirection(filteredIntersects[0].object.matrixWorld);
            }
            console.log('Clicked on existing object at:', intersectionPoint, 'Normal:', surfaceNormal);
        } else {
            // No object intersected, fall back to a plane perpendicular to the camera's view
            console.log('No object intersected, falling back to camera-aligned plane.');
            const plane = new THREE.Plane();
            const cameraDirection = new THREE.Vector3();
            this.camera.getWorldDirection(cameraDirection);
            // Define a plane that is at the camera's focus (e.g., origin)
            // and is perpendicular to the camera's view direction.
            // This needs a reference point. Let's use the current camera position as a reference point.
            // Or, for a more "flat" initial experience in empty space, project onto a default XZ plane.
            // For now, let's keep the camera-aligned plane, but make its origin responsive to the ray.
            
            // To get a point on a "virtual" plane that the ray hits:
            // Define a virtual plane (e.g., at Y=0, or perpendicular to camera)
            // If the sketchMode is 'free' or no object is clicked, a common fallback is an XZ plane at some reasonable Y.
            // Let's use a virtual plane through the camera's lookAt target, or (0,0,0) if no target
            const target = new THREE.Vector3();
            this.camera.getWorldPosition(target); // Start from camera position
            
            // This attempts to project the mouse ray onto an infinite plane
            // which can be either the XZ plane or perpendicular to camera.
            // For dynamic workplane, the fallback should probably be an XZ plane.
            const virtualPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Y=0 plane
            
            const intersectPoint = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(virtualPlane, intersectPoint)) {
                intersectionPoint = intersectPoint;
                surfaceNormal = new THREE.Vector3(0, 1, 0); // Normal of the Y=0 plane
            } else {
                // If ray doesn't intersect Y=0 plane (e.g., camera looking straight down/up),
                // fall back to a point directly in front of the camera.
                intersectionPoint = this.raycaster.ray.at(5, new THREE.Vector3()); // 5 units in front of camera
                surfaceNormal = new THREE.Vector3(0, 1, 0); // Still assume Y-up plane for drawing
            }
        }

        if (intersectionPoint && surfaceNormal) {
            this.initialClickPoint = intersectionPoint;
            this.initialClickNormal = surfaceNormal;
            this.createWorkplaneAtPoint(this.initialClickPoint, this.initialClickNormal);
            this.hasWorkplane = true;
            return true;
        }

        console.warn('Could not initialize workplane: No suitable intersection point found.');
        return false;
    }

    private createWorkplaneAtPoint(position: THREE.Vector3, normal: THREE.Vector3): void {
        this.clearWorkplane(); // Clear any existing workplane first

        const geometry = new THREE.PlaneGeometry(100, 100);
        const material = new THREE.MeshBasicMaterial({
            color: 0xcccccc,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.4
        });
        this.workplane = new THREE.Mesh(geometry, material);

        // Position the workplane at the clicked point
        this.workplane.position.copy(position);

        // Orient the workplane to align with the normal
        // The PlaneGeometry is created on the XY plane (normal is Z+).
        // We need to rotate its Z+ axis to match the target 'normal'.
        this.workplane.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

        this.scene.add(this.workplane);

        // Create and position grid helper
        // GridHelper is by default on the XZ plane.
        // We need to rotate it to match the workplane's orientation.
        this.gridHelper = new THREE.GridHelper(100, 100 / this.gridSize, 0x888888, 0x444444);
        this.gridHelper.position.copy(position);
        // The default GridHelper's normal is Y+.
        // So we need to align GridHelper's Y+ with the target 'normal'.
        // This is where the old `rotation.x = -Math.PI / 2` came from (to align Y+ with Z+).
        // Now, we align its Y+ with the 'normal'.
        this.gridHelper.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

        const gridMaterial = this.gridHelper.material as THREE.LineBasicMaterial;
        gridMaterial.transparent = true;
        gridMaterial.opacity = 0.3;

        this.scene.add(this.gridHelper);

        this.setWorkplaneVisible(this.workplaneVisible); // Apply visibility setting
        console.log('Dynamic workplane created at', position, 'with normal', normal);
    }

    private getWorkplaneIntersection(): THREE.Vector3 | null {
        if (!this.workplane) return null;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.workplane);
        if (intersects.length === 0) return null;

        let point = intersects[0].point.clone();

        if (this.snapToGrid) {
            point = this.snapVectorToGrid(point);
        }

        return point;
    }

    private snapVectorToGrid(vec: THREE.Vector3): THREE.Vector3 {
        if (!this.workplane) return vec.clone(); // Cannot snap without a workplane

        // Convert world position to local workplane coordinates
        const local = this.worldToWorkplane(vec);

        // Snap local X and Y (which correspond to the plane's surface)
        local.x = Math.round(local.x / this.gridSize) * this.gridSize;
        local.y = Math.round(local.y / this.gridSize) * this.gridSize;
        local.z = 0; // Ensure it stays on the plane (Z is the normal direction in local workplane space)

        // Convert back to world coordinates
        return this.workplaneToWorld(local);
    }

    private clearPreview(): void {
        if (this.previewLine) {
            this.scene.remove(this.previewLine);
            this.previewLine.geometry.dispose();
            (this.previewLine.material as THREE.Material).dispose();
            this.previewLine = null;
        }
        if (this.previewMesh) {
            this.scene.remove(this.previewMesh);
            this.previewMesh.geometry.dispose();
            (this.previewMesh.material as THREE.Material).dispose();
            this.previewMesh = null;
        }
    }

    // --- The 'updateMousePosition' method definition ---
    private updateMousePosition(event: MouseEvent): void {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    private worldToWorkplane(worldPos: THREE.Vector3): THREE.Vector3 {
        if (!this.workplane) return worldPos.clone();
        const local = worldPos.clone();
        local.applyMatrix4(this.workplane.matrixWorld.clone().invert()); // Use matrixWorld for correct transformation
        return local;
    }

    private workplaneToWorld(localPos: THREE.Vector3): THREE.Vector3 {
        if (!this.workplane) return localPos.clone();
        const world = localPos.clone();
        world.applyMatrix4(this.workplane.matrixWorld); // Use matrixWorld for correct transformation
        return world;
    }

    // Public methods
    setTool(tool: string): void {
        this.currentTool = tool;
        this.finishCurrentSketch();
        console.log('Set tool to:', tool);
    }

    setSketchMode(mode: 'surface' | 'plane' | 'free'): void {
        this.sketchMode = mode;
        this.clearWorkplane(); // Clear workplane when changing mode, forcing re-initialization
        console.log('Set sketch mode to:', mode);
    }

    setSnapToGrid(snap: boolean): void {
        this.snapToGrid = snap;
    }

    setGridSize(size: number): void {
        this.gridSize = size;
        // Recreate grid helper to reflect new size
        if (this.gridHelper && this.workplane) {
            this.scene.remove(this.gridHelper);
            (this.gridHelper.material as THREE.Material).dispose(); // Dispose old material
            this.gridHelper.geometry.dispose(); // Dispose old geometry

            this.gridHelper = new THREE.GridHelper(100, 100 / this.gridSize, 0x4ade80, 0x4ade80);
            this.gridHelper.position.copy(this.workplane.position);
            // Re-orient grid helper using the workplane's quaternion
            this.gridHelper.quaternion.copy(this.workplane.quaternion);

            const gridMaterial = this.gridHelper.material as THREE.LineBasicMaterial;
            gridMaterial.transparent = true;
            gridMaterial.opacity = 0.3;

            if (this.workplaneVisible) {
                this.scene.add(this.gridHelper);
            }
        }
    }

    setWorkplaneVisible(visible: boolean): void {
        this.workplaneVisible = visible;

        if (this.workplane) {
            const material = this.workplane.material as THREE.MeshBasicMaterial;
            material.opacity = visible ? 0.15 : 0;
        }

        if (this.gridHelper) {
            this.gridHelper.visible = visible;
        }
    }

    finishCurrentSketch(): void {
        if (this.currentShape && this.currentTool === 'polygon' && this.currentShape.points.length >= 3) {
            this.finishPolygon();
        }

        // Finish multi-line if in progress
        if (this.isMultiLineMode && this.multiLinePoints.length >= 2) {
            this.finishMultiLine();
        }

        this.clearPreview();
        this.isDrawing = false;
        this.isDragging = false;
        this.startPoint = null;
        this.currentShape = null;
        this.isMultiLineMode = false;
        this.multiLinePoints = [];
    }

    getShapes(): SketchShape3D[] {
        return [...this.shapes];
    }

    clear(): void {
        this.shapes = [];
        this.currentShape = null;
        this.isDrawing = false;
        this.isDragging = false;
        this.startPoint = null;
        this.isMultiLineMode = false;
        this.multiLinePoints = [];

        // Remove all sketch elements
        this.sketchLines.forEach(line => {
            this.scene.remove(line);
            line.geometry.dispose();
            (line.material as THREE.Material).dispose();
        });
        this.sketchLines = [];

        this.sketchMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            (mesh.material as THREE.Material).dispose();
        });
        this.sketchMeshes = [];

        this.sketchPoints.forEach(point => {
            this.scene.remove(point);
            point.geometry.dispose();
            (point.material as THREE.Material).dispose();
        });
        this.sketchPoints = [];

        this.clearPreview();
        this.clearWorkplane(); // Also clears initialClickPoint/Normal

        console.log('Cleared all sketches');
    }

    dispose(): void {
        this.clear();
    }
}