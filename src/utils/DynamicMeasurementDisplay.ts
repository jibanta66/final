import * as THREE from 'three';
import { Vec3 } from './math'; // Assuming Vec3 is correctly imported from './math'

export interface MeasurementLine {
    id: string;
    type: 'width' | 'height' | 'depth';
    startPoint: THREE.Vector3;
    endPoint: THREE.Vector3;
    value: number;
    label: string;
    line: THREE.Line;
    textSprite: THREE.Sprite;
    extensionLines: THREE.Line[];
    arrows: THREE.Mesh[];
}

export interface DynamicMeasurementOptions {
    lineColor: THREE.Color;
    textColor: string;
    backgroundColor: string;
    fontSize: number;
    lineWidth: number;
    arrowSize: number;
    offset: number;
    precision: number;
    unit: string;
    showExtensionLines: boolean;
    // New options for text padding and border radius (for modern look)
    textPadding: number; // Added for text background padding
    borderRadius: number; // Added for rounded corners on text background
}

export class DynamicMeasurementDisplay {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private measurementLines: Map<string, MeasurementLine[]> = new Map();
    private options: DynamicMeasurementOptions;
    
    // Materials
    private lineMaterial: THREE.LineBasicMaterial;
    private extensionLineMaterial: THREE.LineBasicMaterial;
    private arrowMaterial: THREE.MeshBasicMaterial;

    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
        this.scene = scene;
        this.camera = camera;
        console.log("DynamicMeasurementDisplay initialized.");
        
        this.options = {
            // MODERN COLOR: A professional, slightly muted blue
            lineColor: new THREE.Color(0x66B2FF), // A nice light blue
            textColor: '#FFFFFF', // White text for contrast
            backgroundColor: 'rgba(30, 30, 30, 0.9)', // Darker, slightly transparent background for text
            fontSize: 24, // **INCREASED FONT SIZE**
            lineWidth: 3, // **THICKER LINES**
            arrowSize: 0.2, // Slightly larger arrows for better visibility
            offset: 1.5,
            precision: 2,
            unit: 'mm',
            showExtensionLines: true,
            textPadding: 15, // **ADDED PADDING FOR TEXT BACKGROUND**
            borderRadius: 8 // **ADDED BORDER RADIUS FOR ROUNDED RECTANGLES**
        };

        this.initializeMaterials();
    }

    /**
     * Initializes or re-initializes the Three.js materials used for measurements.
     */
    private initializeMaterials(): void {
        // Dispose of old materials if they exist to prevent memory leaks
        if (this.lineMaterial) this.lineMaterial.dispose();
        if (this.extensionLineMaterial) this.extensionLineMaterial.dispose();
        if (this.arrowMaterial) this.arrowMaterial.dispose();

        this.lineMaterial = new THREE.LineBasicMaterial({
            color: this.options.lineColor,
            linewidth: this.options.lineWidth,
            transparent: true,
            opacity: 0.9,
            depthTest: false, // Render on top of other objects
            depthWrite: false
        });

        this.extensionLineMaterial = new THREE.LineBasicMaterial({
            color: this.options.lineColor,
            linewidth: 1.5, // Slightly thicker than before, but still thinner than main line
            transparent: true,
            opacity: 0.6,
            depthTest: false, // Render on top
            depthWrite: false
        });

        this.arrowMaterial = new THREE.MeshBasicMaterial({
            color: this.options.lineColor,
            transparent: true,
            opacity: 0.9,
            depthTest: false, // Render on top
            depthWrite: false
        });
    }

    /**
     * Shows dynamic measurements (width, height, depth) for a given Three.js Mesh.
     * It calculates the bounding box of the mesh and creates corresponding dimension lines,
     * text labels, arrows, and extension lines.
     * @param objectId The unique ID of the object.
     * @param mesh The THREE.Mesh object for which to display measurements.
     */
    showMeasurementsForObject(objectId: string, mesh: THREE.Mesh): void {
        console.log('Showing measurements for object:', objectId);
        
        // Remove existing measurements for this object before creating new ones
        this.hideDynamicMeasurementsForObject(objectId);

        // Calculate bounding box in world coordinates
        mesh.geometry.computeBoundingBox();
        if (!mesh.geometry.boundingBox) {
            console.warn(`Object ${objectId} has no bounding box. Cannot show measurements.`);
            return;
        }

        const boundingBox = mesh.geometry.boundingBox.clone();
        boundingBox.applyMatrix4(mesh.matrixWorld); // Transform to world space

        const size = new THREE.Vector3();
        boundingBox.getSize(size);
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);

        const measurements: MeasurementLine[] = [];

        // Create width measurement (along X-axis)
        const widthMeasurement = this.createMeasurementLine(
            'width',
            new THREE.Vector3(boundingBox.min.x, boundingBox.max.y + this.options.offset, center.z),
            new THREE.Vector3(boundingBox.max.x, boundingBox.max.y + this.options.offset, center.z),
            size.x,
            `${(size.x * 10).toFixed(this.options.precision)} ${this.options.unit}` // Convert meters to millimeters
        );
        measurements.push(widthMeasurement);

        // Create height measurement (along Y-axis)
        const heightMeasurement = this.createMeasurementLine(
            'height',
            new THREE.Vector3(boundingBox.max.x + this.options.offset, boundingBox.min.y, center.z),
            new THREE.Vector3(boundingBox.max.x + this.options.offset, boundingBox.max.y, center.z),
            size.y,
            `${(size.y * 10).toFixed(this.options.precision)} ${this.options.unit}` // Convert meters to millimeters
        );
        measurements.push(heightMeasurement);

        // Create depth measurement (along Z-axis)
        // Adjust position for depth measurement to avoid overlap with width/height
        const depthMeasurement = this.createMeasurementLine(
            'depth',
            new THREE.Vector3(center.x, boundingBox.max.y + this.options.offset, boundingBox.min.z),
            new THREE.Vector3(center.x, boundingBox.max.y + this.options.offset, boundingBox.max.z),
            size.z,
            `${(size.z * 10).toFixed(this.options.precision)} ${this.options.unit}` // Convert meters to millimeters
        );
        measurements.push(depthMeasurement);

        // Add extension lines if enabled
        if (this.options.showExtensionLines) {
            this.addExtensionLines(measurements, boundingBox);
        }

        // Store measurements associated with the object ID
        this.measurementLines.set(objectId, measurements);

        // Add all measurement elements to the scene
        measurements.forEach(measurement => {
            this.scene.add(measurement.line);
            this.scene.add(measurement.textSprite);
            measurement.arrows.forEach(arrow => this.scene.add(arrow));
            measurement.extensionLines.forEach(extLine => this.scene.add(extLine));
        });

        console.log('Created', measurements.length, 'measurement lines for object:', objectId);
    }

    /**
     * Creates a single dimension line with arrows and a text label.
     * @param type The type of measurement ('width', 'height', 'depth').
     * @param startPoint The starting point of the dimension line in world coordinates.
     * @param endPoint The ending point of the dimension line in world coordinates.
     * @param value The numerical value of the measurement.
     * @param label The text label to display (e.g., "100 mm").
     * @returns A MeasurementLine object containing all Three.js elements for the measurement.
     */
    private createMeasurementLine(
        type: 'width' | 'height' | 'depth',
        startPoint: THREE.Vector3,
        endPoint: THREE.Vector3,
        value: number,
        label: string
    ): MeasurementLine {
        const id = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`; // Unique ID

        // Create main dimension line geometry
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([startPoint, endPoint]);
        const line = new THREE.Line(lineGeometry, this.lineMaterial);
        line.renderOrder = 1000; // Ensure lines are rendered on top

        // Create arrows at the ends of the line
        const direction = endPoint.clone().sub(startPoint).normalize();
        const arrows = this.createArrows(startPoint, endPoint, direction);

        // Create text sprite at the midpoint of the line
        const midPoint = startPoint.clone().add(endPoint).divideScalar(2);
        const textSprite = this.createTextSprite(label, midPoint);

        return {
            id,
            type,
            startPoint: startPoint.clone(),
            endPoint: endPoint.clone(),
            value,
            label,
            line,
            textSprite,
            extensionLines: [], // Populated by addExtensionLines
            arrows
        };
    }

    /**
     * Creates two arrow meshes pointing inwards for a dimension line.
     * @param start The start point of the dimension line.
     * @param end The end point of the dimension line.
     * @param direction The normalized direction vector of the line.
     * @returns An array containing the two arrow meshes.
     */
    private createArrows(start: THREE.Vector3, end: THREE.Vector3, direction: THREE.Vector3): THREE.Mesh[] {
        const arrows: THREE.Mesh[] = [];
        // Cone geometry for arrowheads
        const arrowGeometry = new THREE.ConeGeometry(this.options.arrowSize * 0.5, this.options.arrowSize, 8);
        
        // Arrow at the start point, rotated to point towards the end
        const startArrow = new THREE.Mesh(arrowGeometry, this.arrowMaterial);
        startArrow.position.copy(start);
        startArrow.lookAt(start.clone().add(direction)); // Point along the line
        startArrow.rotateX(Math.PI / 2); // Rotate to align cone with line
        startArrow.renderOrder = 1001; // Render on top of lines
        arrows.push(startArrow);
        
        // Arrow at the end point, rotated to point towards the start
        const endArrow = new THREE.Mesh(arrowGeometry, this.arrowMaterial);
        endArrow.position.copy(end);
        endArrow.lookAt(end.clone().sub(direction)); // Point opposite to line direction
        endArrow.rotateX(Math.PI / 2); // Rotate to align cone with line
        endArrow.renderOrder = 1001; // Render on top of lines
        arrows.push(endArrow);
        
        return arrows;
    }

    /**
     * Creates a Three.js Sprite containing the measurement text.
     * The text is rendered onto a canvas, which is then used as a texture for the sprite.
     * @param text The text to display (e.g., "100 mm").
     * @param position The world position for the center of the text sprite.
     * @returns A THREE.Sprite object.
     */
    private createTextSprite(text: string, position: THREE.Vector3): THREE.Sprite {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        
        // Use a temporary size to measure text accurately
        context.font = `bold ${this.options.fontSize}px Arial`;
        
        const textMetrics = context.measureText(text);
        const textWidth = textMetrics.width;
        
        // Calculate canvas dimensions with padding
        const canvasWidth = textWidth + this.options.textPadding * 2;
        const canvasHeight = this.options.fontSize + this.options.textPadding * 2;
        
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        // Clear and redraw with correct size
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.font = `bold ${this.options.fontSize}px Arial`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Draw background with rounded corners
        context.fillStyle = this.options.backgroundColor;
        this.roundRect(context, 0, 0, canvas.width, canvas.height, this.options.borderRadius);
        context.fill();
        
        // Draw border
        context.strokeStyle = this.options.lineColor.getHexString();
        context.lineWidth = 2; // Fixed border width for crispness
        this.roundRect(context, 0, 0, canvas.width, canvas.height, this.options.borderRadius);
        context.stroke();
        
        // Draw text
        context.fillStyle = this.options.textColor;
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        // Create texture from canvas and then a sprite
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
        
        // Initial scale. The `update()` method will further adjust this for consistent visual size.
        // We now use `canvas.width / 20` and `canvas.height / 20` as a base scale.
        // The factor (e.g., 20) determines how big the text appears initially in world units.
        sprite.scale.set(canvas.width / 20, canvas.height / 20, 1);
        sprite.renderOrder = 1002;
        
        return sprite;
    }

    /**
     * Helper function to draw a rounded rectangle on a 2D canvas context.
     * @param ctx The CanvasRenderingContext2D.
     * @param x The x-coordinate of the top-left corner.
     * @param y The y-coordinate of the top-left corner.
     * @param width The width of the rectangle.
     * @param height The height of the rectangle.
     * @param radius The corner radius.
     */
    private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius); // Corrected this line
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height); // Corrected this line
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    /**
     * Adds extension lines from the object's bounding box to the measurement lines.
     * @param measurements An array of MeasurementLine objects.
     * @param boundingBox The world-space bounding box of the object.
     */
    private addExtensionLines(measurements: MeasurementLine[], boundingBox: THREE.Box3): void {
        const extensionOffset = 0.1; // Small offset for extension lines from bounding box
        measurements.forEach(measurement => {
            const extensionLines: THREE.Line[] = [];
            
            if (measurement.type === 'width') {
                // Extension lines for width measurement (from min.x and max.x of bounding box)
                const ext1Start = new THREE.Vector3(boundingBox.min.x, boundingBox.max.y, measurement.startPoint.z);
                const ext1End = measurement.startPoint.clone();
                const ext1Geometry = new THREE.BufferGeometry().setFromPoints([ext1Start, ext1End]);
                const ext1 = new THREE.Line(ext1Geometry, this.extensionLineMaterial);
                ext1.renderOrder = 999;
                extensionLines.push(ext1);
                
                const ext2Start = new THREE.Vector3(boundingBox.max.x, boundingBox.max.y, measurement.endPoint.z);
                const ext2End = measurement.endPoint.clone();
                const ext2Geometry = new THREE.BufferGeometry().setFromPoints([ext2Start, ext2End]);
                const ext2 = new THREE.Line(ext2Geometry, this.extensionLineMaterial);
                ext2.renderOrder = 999;
                extensionLines.push(ext2);
            } else if (measurement.type === 'height') {
                // Extension lines for height measurement (from min.y and max.y of bounding box)
                const ext1Start = new THREE.Vector3(boundingBox.max.x, boundingBox.min.y, measurement.startPoint.z);
                const ext1End = measurement.startPoint.clone();
                const ext1Geometry = new THREE.BufferGeometry().setFromPoints([ext1Start, ext1End]);
                const ext1 = new THREE.Line(ext1Geometry, this.extensionLineMaterial);
                ext1.renderOrder = 999;
                extensionLines.push(ext1);
                
                const ext2Start = new THREE.Vector3(boundingBox.max.x, boundingBox.max.y, measurement.endPoint.z);
                const ext2End = measurement.endPoint.clone();
                const ext2Geometry = new THREE.BufferGeometry().setFromPoints([ext2Start, ext2End]);
                const ext2 = new THREE.Line(ext2Geometry, this.extensionLineMaterial);
                ext2.renderOrder = 999;
                extensionLines.push(ext2);
            } else if (measurement.type === 'depth') {
                // Extension lines for depth measurement (from min.z and max.z of bounding box)
                // Note: These might need careful positioning to not overlap with other measurements
                const ext1Start = new THREE.Vector3(measurement.startPoint.x, boundingBox.max.y, boundingBox.min.z);
                const ext1End = measurement.startPoint.clone();
                const ext1Geometry = new THREE.BufferGeometry().setFromPoints([ext1Start, ext1End]);
                const ext1 = new THREE.Line(ext1Geometry, this.extensionLineMaterial);
                ext1.renderOrder = 999;
                extensionLines.push(ext1);
                
                const ext2Start = new THREE.Vector3(measurement.endPoint.x, boundingBox.max.y, boundingBox.max.z);
                const ext2End = measurement.endPoint.clone();
                const ext2Geometry = new THREE.BufferGeometry().setFromPoints([ext2Start, ext2End]);
                const ext2 = new THREE.Line(ext2Geometry, this.extensionLineMaterial);
                ext2.renderOrder = 999;
                extensionLines.push(ext2);
            }
            
            measurement.extensionLines = extensionLines;
        });
    }

    /**
     * Updates the dynamic measurements for a specific object, typically called when the object's
     * position, rotation, or scale changes. It removes old measurements and recreates them.
     * @param objectId The ID of the object to update.
     * @param mesh The THREE.Mesh object.
     */
    updateMeasurementsForObject(objectId: string, mesh: THREE.Mesh): void {
        const measurements = this.measurementLines.get(objectId);
        if (!measurements) return;

        // Remove old measurements from scene and dispose resources
        measurements.forEach(measurement => {
            this.scene.remove(measurement.line);
            this.scene.remove(measurement.textSprite);
            measurement.arrows.forEach(arrow => this.scene.remove(arrow));
            measurement.extensionLines.forEach(extLine => this.scene.remove(extLine));
            
            // Dispose geometries and materials to prevent memory leaks
            measurement.line.geometry.dispose();
            if (measurement.textSprite.material.map) {
                measurement.textSprite.material.map.dispose();
            }
            measurement.textSprite.material.dispose();
            measurement.arrows.forEach(arrow => {
                arrow.geometry.dispose();
            });
            measurement.extensionLines.forEach(extLine => {
                extLine.geometry.dispose();
            });
        });

        // Clear the map entry for this object
        this.measurementLines.delete(objectId);

        // Create new measurements with updated values/positions
        this.showMeasurementsForObject(objectId, mesh);
    }

    /**
     * Hides dynamic measurements for a specific object and disposes their resources.
     * This method was renamed to match the call in ThreeRenderer.
     * @param objectId The ID of the object whose measurements should be hidden.
     */
    hideDynamicMeasurementsForObject(objectId: string): void {
        const measurements = this.measurementLines.get(objectId);
        if (!measurements) return;

        console.log('Hiding dynamic measurements for object:', objectId);

        measurements.forEach(measurement => {
            // Remove from scene
            this.scene.remove(measurement.line);
            this.scene.remove(measurement.textSprite);
            measurement.arrows.forEach(arrow => this.scene.remove(arrow));
            measurement.extensionLines.forEach(extLine => this.scene.remove(extLine));
            
            // Dispose geometries and materials
            measurement.line.geometry.dispose();
            if (measurement.textSprite.material.map) {
                measurement.textSprite.material.map.dispose();
            }
            measurement.textSprite.material.dispose();
            measurement.arrows.forEach(arrow => {
                arrow.geometry.dispose();
            });
            measurement.extensionLines.forEach(extLine => {
                extLine.geometry.dispose();
            });
        });

        this.measurementLines.delete(objectId);
    }

    /**
     * Hides all currently displayed dynamic measurements across all objects.
     */
    hideAllMeasurements(): void {
        // Iterate over a copy of keys to avoid issues while modifying the map during iteration
        const objectIds = Array.from(this.measurementLines.keys());
        objectIds.forEach(objectId => this.hideDynamicMeasurementsForObject(objectId));
    }

    /**
     * Performs per-frame updates for dynamic measurements, such as making text sprites
     * always face the camera and adjusting their scale for consistent visual size.
     */
    update(): void {
        this.measurementLines.forEach(measurements => {
            measurements.forEach(measurement => {
                if (measurement.textSprite) {
                    // Make text sprite always face the camera
                    measurement.textSprite.lookAt(this.camera.position);
                    
                    // Adjust sprite scale based on camera distance for consistent visual size
                    // Tuned constants for a more stable and visible text size.
                    const distance = this.camera.position.distanceTo(measurement.textSprite.position);
                    const scaleFactor = distance * 0.08; // Slightly increased base scale for larger text
                    const finalScale = Math.max(0.7, Math.min(2.5, scaleFactor)); // Wider min/max for flexibility
                    
                    // Apply the scale to the sprite's original dimensions
                    const originalWidthScale = measurement.textSprite.material.map ? measurement.textSprite.material.map.image.width / 20 : 1; // Base scale changed to 20
                    const originalHeightScale = measurement.textSprite.material.map ? measurement.textSprite.material.map.image.height / 20 : 1; // Base scale changed to 20

                    measurement.textSprite.scale.set(
                        originalWidthScale * finalScale,
                        originalHeightScale * finalScale,
                        1
                    );
                }

                // Update arrow sizes based on camera distance for consistent visual size
                measurement.arrows.forEach(arrow => {
                    const distance = this.camera.position.distanceTo(arrow.position);
                    const scale = Math.max(0.08, Math.min(0.3, distance * 0.015)); // Tuned constants for arrow scaling
                    arrow.scale.set(scale, scale, scale); // Apply uniform scale
                });
            });
        });
    }

    /**
     * Sets new options for the dynamic measurement display and re-initializes materials.
     * @param options A partial object containing the new options to apply.
     */
    setOptions(options: Partial<DynamicMeasurementOptions>): void {
        this.options = { ...this.options, ...options };
        this.initializeMaterials(); // Re-initialize materials with new colors/linewidths
        // Re-render all existing measurements with new options (optional, but good for consistency)
        // This part might need the actual mesh reference, which ThreeRenderer can provide
        // For simplicity, this will re-show all currently displayed measurements.
        const currentlyDisplayedObjectIds = Array.from(this.measurementLines.keys());
        if (currentlyDisplayedObjectIds.length > 0) {
            console.warn("setOptions called. To fully apply new options, objects whose measurements are displayed might need to be re-selected/re-displayed by ThreeRenderer.");
            // A more robust solution would involve passing the mesh from ThreeRenderer to here
            // or making DynamicMeasurementDisplay aware of the meshes it's displaying measurements for.
            // For now, we just rely on hide/show to refresh, which requires the mesh.
        }
    }

    /**
     * Disposes of all Three.js resources (geometries, materials, textures)
     * used by the dynamic measurement display to prevent memory leaks.
     */
    dispose(): void {
        console.log('Disposing DynamicMeasurementDisplay');
        this.hideAllMeasurements(); // Hide and dispose all current measurements
        this.lineMaterial.dispose();
        this.extensionLineMaterial.dispose();
        this.arrowMaterial.dispose();
    }
}