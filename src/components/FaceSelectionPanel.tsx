import React from 'react';
import { Target, Ruler, Layers, Trash2, ArrowUp, RotateCcw } from 'lucide-react';
import { SelectedFace } from '../utils/FaceEdgeSelector';

interface FaceSelectionPanelProps {
  selectedFaces: SelectedFace[];
  onExtrudeFace: (faceId: string, distance: number) => void;
  onClearSelection: () => void;
  onDeselectFace: (faceId: string) => void;
  measurementDistance: number | null;
}

export const FaceSelectionPanel: React.FC<FaceSelectionPanelProps> = ({
  selectedFaces,
  onExtrudeFace,
  onClearSelection,
  onDeselectFace,
  measurementDistance
}) => {
  const [extrudeDistance, setExtrudeDistance] = React.useState(1.0);

  const formatArea = (area: number): string => {
    return `${area.toFixed(2)} mm²`;
  };

  const formatDistance = (distance: number): string => {
    return `${distance.toFixed(2)} mm`;
  };

  const formatNormal = (normal: THREE.Vector3): string => {
    return `(${normal.x.toFixed(2)}, ${normal.y.toFixed(2)}, ${normal.z.toFixed(2)})`;
  };

  return (
    <div className="bg-gray-800 text-white p-4 overflow-y-auto">
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target size={20} />
          Face Selection
        </h2>

        {/* Selection Info */}
        <div className="mb-4 p-3 bg-blue-900 bg-opacity-50 rounded-lg border border-blue-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-300">
              {selectedFaces.length} Face{selectedFaces.length !== 1 ? 's' : ''} Selected
            </span>
            {selectedFaces.length > 0 && (
              <button
                onClick={onClearSelection}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Clear All
              </button>
            )}
          </div>
          
          {selectedFaces.length === 0 && (
            <p className="text-xs text-blue-200">
              Click on faces to select them for measurement and extrusion
            </p>
          )}
        </div>

        {/* Measurement Display */}
        {selectedFaces.length === 2 && measurementDistance !== null && (
          <div className="mb-4 p-3 bg-green-900 bg-opacity-50 rounded-lg border border-green-700">
            <div className="flex items-center gap-2 mb-1">
              <Ruler size={16} className="text-green-400" />
              <span className="text-sm font-medium text-green-300">Distance Between Faces</span>
            </div>
            <div className="text-lg font-mono text-green-200">
              {formatDistance(measurementDistance)}
            </div>
          </div>
        )}

        {/* Selected Faces List */}
        {selectedFaces.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3 text-gray-300 flex items-center gap-2">
              <Layers size={16} />
              Selected Faces
            </h3>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {selectedFaces.map((face, index) => (
                <div
                  key={face.id}
                  className="p-3 bg-gray-700 rounded-lg border border-gray-600"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">
                      Face {index + 1}
                    </span>
                    <button
                      onClick={() => onDeselectFace(face.id)}
                      className="text-red-400 hover:text-red-300 transition-colors"
                      title="Deselect face"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  
                  <div className="space-y-1 text-xs text-gray-300">
                    <div>
                      <span className="text-gray-400">Object:</span> {face.objectId}
                    </div>
                    <div>
                      <span className="text-gray-400">Area:</span> {formatArea(face.area)}
                    </div>
                    <div>
                      <span className="text-gray-400">Normal:</span> {formatNormal(face.normal)}
                    </div>
                    <div>
                      <span className="text-gray-400">Center:</span> ({face.center.x.toFixed(2)}, {face.center.y.toFixed(2)}, {face.center.z.toFixed(2)})
                    </div>
                  </div>

                  {/* Extrude Controls for Individual Face */}
                  <div className="mt-3 pt-3 border-t border-gray-600">
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowUp size={14} className="text-purple-400" />
                      <span className="text-xs font-medium text-purple-300">Extrude Face</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={extrudeDistance}
                        onChange={(e) => setExtrudeDistance(parseFloat(e.target.value) || 0)}
                        step="0.1"
                        min="-10"
                        max="10"
                        className="flex-1 bg-gray-600 border border-gray-500 rounded px-2 py-1 text-xs text-white focus:border-purple-500 focus:outline-none"
                        placeholder="Distance"
                      />
                      <span className="text-xs text-gray-400">mm</span>
                      <button
                        onClick={() => onExtrudeFace(face.id, extrudeDistance)}
                        className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs transition-colors"
                      >
                        Extrude
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Batch Operations */}
        {selectedFaces.length > 1 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3 text-gray-300">Batch Operations</h3>
            
            <div className="space-y-3">
              <div className="p-3 bg-gray-700 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUp size={14} className="text-purple-400" />
                  <span className="text-xs font-medium text-purple-300">Extrude All Faces</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={extrudeDistance}
                    onChange={(e) => setExtrudeDistance(parseFloat(e.target.value) || 0)}
                    step="0.1"
                    min="-10"
                    max="10"
                    className="flex-1 bg-gray-600 border border-gray-500 rounded px-2 py-1 text-xs text-white focus:border-purple-500 focus:outline-none"
                    placeholder="Distance"
                  />
                  <span className="text-xs text-gray-400">mm</span>
                  <button
                    onClick={() => {
                      selectedFaces.forEach(face => {
                        onExtrudeFace(face.id, extrudeDistance);
                      });
                    }}
                    className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs transition-colors"
                  >
                    Extrude All
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-gray-400 space-y-2">
          <div className="font-semibold text-gray-300">Face Selection Mode:</div>
          <div>• Click faces to select/deselect them</div>
          <div>• Selected faces are highlighted in green</div>
          <div>• Edges are outlined for clarity</div>
          <div>• Select 2 faces to measure distance</div>
          <div>• Use extrude to create 3D geometry from faces</div>
          <div>• Positive values extrude outward, negative inward</div>
        </div>

        {/* Statistics */}
        {selectedFaces.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-700">
            <div className="text-xs text-gray-400">
              <div>Total Selected: {selectedFaces.length}</div>
              <div>Total Area: {formatArea(selectedFaces.reduce((sum, face) => sum + face.area, 0))}</div>
              {selectedFaces.length === 2 && measurementDistance && (
                <div>Face Distance: {formatDistance(measurementDistance)}</div>
              )}
            </div>
          </div>
        )}

        {/* Reset Button */}
        <button
          onClick={() => {
            onClearSelection();
            setExtrudeDistance(1.0);
          }}
          className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-sm"
        >
          <RotateCcw size={16} />
          Reset Selection
        </button>
      </div>
    </div>
  );
};