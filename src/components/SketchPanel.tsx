import React, { useRef, useEffect, useState } from 'react';
import { SketchEngine, SketchShape } from '../utils/sketch';
import { X, Square, Circle, Minus, Hexagon as Polygon, Grid, Move, Download } from 'lucide-react';

interface SketchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onExtrude: (shapes: SketchShape[]) => void;
}

export const SketchPanel: React.FC<SketchPanelProps> = ({
  isOpen,
  onClose,
  onExtrude
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sketchEngineRef = useRef<SketchEngine | null>(null);
  const [activeTool, setActiveTool] = useState('line');
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(20);

  useEffect(() => {
    if (isOpen && canvasRef.current && !sketchEngineRef.current) {
      sketchEngineRef.current = new SketchEngine(canvasRef.current);
      sketchEngineRef.current.setSnapToGrid(snapToGrid);
      sketchEngineRef.current.setGridSize(gridSize);
    }
  }, [isOpen, snapToGrid, gridSize]);

  useEffect(() => {
    if (sketchEngineRef.current) {
      sketchEngineRef.current.setTool(activeTool);
    }
  }, [activeTool]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!sketchEngineRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      sketchEngineRef.current.startDrawing(x, y);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!sketchEngineRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      sketchEngineRef.current.updateDrawing(x, y);
    }
  };

  const handleMouseUp = () => {
    if (!sketchEngineRef.current) return;
    sketchEngineRef.current.finishDrawing();
  };

  const handleDoubleClick = () => {
    if (!sketchEngineRef.current) return;
    sketchEngineRef.current.finishPolygon();
  };

  const handleExtrude = () => {
    if (!sketchEngineRef.current) return;
    const shapes = sketchEngineRef.current.getShapes();
    if (shapes.length > 0) {
      onExtrude(shapes);
      onClose();
    }
  };

  const handleClear = () => {
    if (!sketchEngineRef.current) return;
    sketchEngineRef.current.clear();
  };

  const handleExportSketch = () => {
    if (!sketchEngineRef.current) return;
    const shapes = sketchEngineRef.current.getShapes();
    const sketchData = {
      shapes,
      settings: { snapToGrid, gridSize },
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(sketchData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sketch.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const tools = [
    { id: 'line', icon: Minus, label: 'Line', description: 'Draw straight lines' },
    { id: 'rectangle', icon: Square, label: 'Rectangle', description: 'Draw rectangles' },
    { id: 'circle', icon: Circle, label: 'Circle', description: 'Draw circles' },
    { id: 'polygon', icon: Polygon, label: 'Polygon', description: 'Draw custom polygons' }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg w-full h-full max-w-6xl max-h-5xl m-4 flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 p-4 rounded-t-lg flex items-center justify-between border-b border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-white">2D Sketch Mode</h2>
            <p className="text-sm text-gray-400">Create 2D shapes for 3D extrusion</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-lg"
          >
            <X size={24} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-300 font-medium">Drawing Tools:</span>
                {tools.map(tool => {
                  const IconComponent = tool.icon;
                  return (
                    <button
                      key={tool.id}
                      onClick={() => setActiveTool(tool.id)}
                      className={`
                        flex items-center gap-2 px-3 py-2 rounded-lg transition-all
                        ${activeTool === tool.id 
                          ? 'bg-blue-600 text-white shadow-lg' 
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }
                      `}
                      title={tool.description}
                    >
                      <IconComponent size={16} />
                      <span className="text-sm">{tool.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="h-6 w-px bg-gray-600"></div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={snapToGrid}
                    onChange={(e) => setSnapToGrid(e.target.checked)}
                    className="rounded"
                  />
                  <Grid size={16} />
                  Snap to Grid
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-300">Grid:</span>
                  <input
                    type="range"
                    min="10"
                    max="50"
                    value={gridSize}
                    onChange={(e) => setGridSize(parseInt(e.target.value))}
                    className="w-20"
                  />
                  <span className="text-xs text-gray-400 w-8">{gridSize}px</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportSketch}
                className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm"
              >
                <Download size={16} />
                Export
              </button>
              <button
                onClick={handleClear}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
              >
                Clear All
              </button>
              <button
                onClick={handleExtrude}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                Extrude to 3D
              </button>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 bg-gray-900 p-4">
          <div className="w-full h-full bg-gray-800 rounded-lg overflow-hidden relative">
            <canvas
              ref={canvasRef}
              className="w-full h-full cursor-crosshair"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onDoubleClick={handleDoubleClick}
            />
            
            {/* Canvas overlay info */}
            <div className="absolute top-4 right-4 bg-gray-900 bg-opacity-90 rounded-lg p-3 text-white text-sm">
              <div className="font-medium mb-2">Active Tool: {tools.find(t => t.id === activeTool)?.label}</div>
              <div className="text-xs text-gray-300 space-y-1">
                <div>Grid: {snapToGrid ? 'On' : 'Off'} ({gridSize}px)</div>
                <div>Shapes: {sketchEngineRef.current?.getShapes().length || 0}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-gray-800 border-t border-gray-700 p-4 text-sm text-gray-400">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div>
                <strong className="text-gray-300">Current Tool:</strong> {tools.find(t => t.id === activeTool)?.description}
              </div>
              {activeTool === 'polygon' && (
                <div className="text-blue-400">
                  <strong>Polygon Mode:</strong> Click to add points, double-click to finish
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500">
              Tip: Enable snap to grid for precise drawing • Use extrude to convert to 3D
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};