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
    backgroundColor: string; // This will become less relevant for text background but kept for consistency if needed elsewhere
    fontSize: number;
    lineWidth: number;
    arrowSize: number;
    offset: number;
    precision: number;
    unit: string;
    showExtensionLines: boolean;
    // New options for text padding and border radius (for modern look) - will be ignored for text background
    textPadding: number;
    borderRadius: number;
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
            textColor: '#FFFFFF', // White text for contrast (now more important as there's no background)
            backgroundColor: 'rgba(30, 30, 30, 0.0)', // Make background fully transparent
            fontSize: 20, // **DECREASED FONT SIZE**
            lineWidth: 4,
            arrowSize: 0.2,
            offset: 1.5, // Main offset for measurement lines from the object
            precision: 2,
            unit: 'mm',
            showExtensionLines: true,
            textPadding: 0,
            borderRadius: 0
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
            linewidth: 1.5,
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

        const mainOffset = this.options.offset;
        const extensionLineInitialOffset = 0.2; // Small gap from the object boundary for extension lines

        // --- Width Measurement (along X-axis) ---
        // Positioned above the object (positive Y) and slightly forward (positive Z)
        const widthLineStart = new THREE.Vector3(boundingBox.min.x, boundingBox.max.y + mainOffset, boundingBox.max.z + mainOffset);
        const widthLineEnd = new THREE.Vector3(boundingBox.max.x, boundingBox.max.y + mainOffset, boundingBox.max.z + mainOffset);
        const widthMeasurement = this.createMeasurementLine(
            'width',
            widthLineStart,
            widthLineEnd,
            size.x,
            `${(size.x * 10).toFixed(this.options.precision)} ${this.options.unit}` // Convert meters to millimeters
        );
        measurements.push(widthMeasurement);

        // --- Height Measurement (along Y-axis) ---
        // Positioned to the right of the object (positive X) and slightly forward (positive Z)
        const heightLineStart = new THREE.Vector3(boundingBox.max.x + mainOffset, boundingBox.min.y, boundingBox.max.z + mainOffset);
        const heightLineEnd = new THREE.Vector3(boundingBox.max.x + mainOffset, boundingBox.max.y, boundingBox.max.z + mainOffset);
        const heightMeasurement = this.createMeasurementLine(
            'height',
            heightLineStart,
            heightLineEnd,
            size.y,
            `${(size.y * 10).toFixed(this.options.precision)} ${this.options.unit}` // Convert meters to millimeters
        );
        measurements.push(heightMeasurement);

        // --- Depth Measurement (along Z-axis) ---
        // Positioned to the left of the object (negative X) and slightly above (positive Y)
        const depthLineStart = new THREE.Vector3(boundingBox.min.x - mainOffset, boundingBox.max.y + mainOffset, boundingBox.min.z);
        const depthLineEnd = new THREE.Vector3(boundingBox.min.x - mainOffset, boundingBox.max.y + mainOffset, boundingBox.max.z);
        const depthMeasurement = this.createMeasurementLine(
            'depth',
            depthLineStart,
            depthLineEnd,
            size.z,
            `${(size.z * 10).toFixed(this.options.precision)} ${this.options.unit}` // Convert meters to millimeters
        );
        measurements.push(depthMeasurement);


        // Add extension lines if enabled
        if (this.options.showExtensionLines) {
            this.addExtensionLines(measurements, boundingBox, extensionLineInitialOffset);
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
        const midPoint = startPoint.clone().add(endPoint).multiplyScalar(0.5);

        const textOffsetFromLine = 0.5; // Offset to push text away from the line

        // Calculate perpendicular offset for text position based on line orientation
        let textSpritePosition = midPoint.clone();
        if (type === 'width') {
            // Width line is X-oriented, text should be slightly above it (positive Y)
            textSpritePosition.y += textOffsetFromLine;
        } else if (type === 'height') {
            // Height line is Y-oriented, text should be slightly to its right (positive X)
            textSpritePosition.x += textOffsetFromLine;
        } else if (type === 'depth') {
            // Depth line is Z-oriented, text should be slightly to its left (negative X)
            textSpritePosition.x -= textOffsetFromLine;
        }

        const textSprite = this.createTextSprite(label, textSpritePosition);

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
        startArrow.rotateX(Math.PI / 2); // Rotate to align cone with line (assuming cone points along Y by default)
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

        // Calculate canvas dimensions with minimal padding, as no background
        const canvasWidth = textWidth + 4; // A little padding for crispness
        const canvasHeight = this.options.fontSize + 4; // A little padding for crispness

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // Clear and redraw with correct size
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.font = `bold ${this.options.fontSize}px Arial`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        // Draw text directly
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
     * This function is now effectively unused for the text background but kept for completeness.
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
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
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
     * @param initialOffset A small offset to create a gap between the object and the extension line start.
     */
    private addExtensionLines(measurements: MeasurementLine[], boundingBox: THREE.Box3, initialOffset: number): void {
        measurements.forEach(measurement => {
            const extensionLines: THREE.Line[] = [];

            if (measurement.type === 'width') {
                // Extension lines for width measurement
                // From object's corners (min.x, max.y, max.z) and (max.x, max.y, max.z)
                // to the width measurement line (which is above and forward)
                const ext1Start = new THREE.Vector3(boundingBox.min.x, boundingBox.max.y + initialOffset, boundingBox.max.z + initialOffset);
                const ext1End = new THREE.Vector3(boundingBox.min.x, measurement.startPoint.y, measurement.startPoint.z);
                const ext1Geometry = new THREE.BufferGeometry().setFromPoints([ext1Start, ext1End]);
                const ext1 = new THREE.Line(ext1Geometry, this.extensionLineMaterial);
                ext1.renderOrder = 999;
                extensionLines.push(ext1);

                const ext2Start = new THREE.Vector3(boundingBox.max.x, boundingBox.max.y + initialOffset, boundingBox.max.z + initialOffset);
                const ext2End = new THREE.Vector3(boundingBox.max.x, measurement.endPoint.y, measurement.endPoint.z);
                const ext2Geometry = new THREE.BufferGeometry().setFromPoints([ext2Start, ext2End]);
                const ext2 = new THREE.Line(ext2Geometry, this.extensionLineMaterial);
                ext2.renderOrder = 999;
                extensionLines.push(ext2);

            } else if (measurement.type === 'height') {
                // Extension lines for height measurement
                // From object's corners (max.x, min.y, max.z) and (max.x, max.y, max.z)
                // to the height measurement line (which is to the right and forward)
                const ext1Start = new THREE.Vector3(boundingBox.max.x + initialOffset, boundingBox.min.y, boundingBox.max.z + initialOffset);
                const ext1End = new THREE.Vector3(measurement.startPoint.x, boundingBox.min.y, measurement.startPoint.z);
                const ext1Geometry = new THREE.BufferGeometry().setFromPoints([ext1Start, ext1End]);
                const ext1 = new THREE.Line(ext1Geometry, this.extensionLineMaterial);
                ext1.renderOrder = 999;
                extensionLines.push(ext1);

                const ext2Start = new THREE.Vector3(boundingBox.max.x + initialOffset, boundingBox.max.y, boundingBox.max.z + initialOffset);
                const ext2End = new THREE.Vector3(measurement.endPoint.x, boundingBox.max.y, measurement.endPoint.z);
                const ext2Geometry = new THREE.BufferGeometry().setFromPoints([ext2Start, ext2End]);
                const ext2 = new THREE.Line(ext2Geometry, this.extensionLineMaterial);
                ext2.renderOrder = 999;
                extensionLines.push(ext2);

            } else if (measurement.type === 'depth') {
                // Extension lines for depth measurement
                // From object's corners (min.x, max.y, min.z) and (min.x, max.y, max.z)
                // to the depth measurement line (which is to the left and above)
                const ext1Start = new THREE.Vector3(boundingBox.min.x - initialOffset, boundingBox.max.y + initialOffset, boundingBox.min.z);
                const ext1End = new THREE.Vector3(measurement.startPoint.x, measurement.startPoint.y, boundingBox.min.z);
                const ext1Geometry = new THREE.BufferGeometry().setFromPoints([ext1Start, ext1End]);
                const ext1 = new THREE.Line(ext1Geometry, this.extensionLineMaterial);
                ext1.renderOrder = 999;
                extensionLines.push(ext1);

                const ext2Start = new THREE.Vector3(boundingBox.min.x - initialOffset, boundingBox.max.y + initialOffset, boundingBox.max.z);
                const ext2End = new THREE.Vector3(measurement.endPoint.x, measurement.endPoint.y, boundingBox.max.z);
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
                    const distance = this.camera.position.distanceTo(measurement.textSprite.position);
                    // Tuned these values for a smaller, more TinkerCAD-like appearance
                    const scaleFactor = distance * 0.05; // Reduced base scale
                    const finalScale = Math.max(0.5, Math.min(2.0, scaleFactor)); // Adjusted min/max for smaller range

                    // Apply the scale to the sprite's original dimensions
                    const canvasBaseScale = 25; // Slightly increased this to make the initial text texture seem smaller in world units
                    const originalWidthScale = measurement.textSprite.material.map ? measurement.textSprite.material.map.image.width / canvasBaseScale : 1;
                    const originalHeightScale = measurement.textSprite.material.map ? measurement.textSprite.material.map.image.height / canvasBaseScale : 1;

                    measurement.textSprite.scale.set(
                        originalWidthScale * finalScale,
                        originalHeightScale * finalScale,
                        1
                    );
                }

                // Update arrow sizes based on camera distance for consistent visual size
                measurement.arrows.forEach(arrow => {
                    const distance = this.camera.position.distanceTo(arrow.position);
                    const scale = Math.max(0.08, Math.min(0.3, distance * 0.015));
                    arrow.scale.set(scale, scale, scale);
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
        // For simplicity, this will re-show all currently displayed measurements.
        const currentlyDisplayedObjectIds = Array.from(this.measurementLines.keys());
        if (currentlyDisplayedObjectIds.length > 0) {
            console.warn("setOptions called. To fully apply new options, objects whose measurements are displayed might need to be re-selected/re-displayed by ThreeRenderer.");
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