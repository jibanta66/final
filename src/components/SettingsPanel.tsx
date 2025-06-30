import React, { useState, useEffect } from 'react';
import { X, Keyboard, Mouse, RotateCcw, Save, Settings as SettingsIcon, Gamepad2, Palette } from 'lucide-react';

export interface KeyBinding {
  id: string;
  name: string;
  description: string;
  category: 'camera' | 'transform' | 'tools' | 'actions';
  defaultKey: string;
  currentKey: string;
  type: 'keyboard' | 'mouse';
}

export interface ColorSettings {
  gridColor: string;
  backgroundColor: string;
  selectionColor: string;
  hoverColor: string;
}

export interface SettingsData {
  keyBindings: KeyBinding[];
  mouseSettings: {
    sensitivity: number;
    invertY: boolean;
    swapButtons: boolean;
  };
  colorSettings: ColorSettings;
}

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange: (settings: SettingsData) => void;
}

const defaultKeyBindings: KeyBinding[] = [
  // Camera Controls
  { id: 'camera-forward', name: 'Move Forward', description: 'Move camera forward', category: 'camera', defaultKey: 'w', currentKey: 'w', type: 'keyboard' },
  { id: 'camera-backward', name: 'Move Backward', description: 'Move camera backward', category: 'camera', defaultKey: 's', currentKey: 's', type: 'keyboard' },
  { id: 'camera-left', name: 'Move Left', description: 'Move camera left', category: 'camera', defaultKey: 'a', currentKey: 'a', type: 'keyboard' },
  { id: 'camera-right', name: 'Move Right', description: 'Move camera right', category: 'camera', defaultKey: 'd', currentKey: 'd', type: 'keyboard' },
  { id: 'camera-up', name: 'Move Up', description: 'Move camera up', category: 'camera', defaultKey: 'q', currentKey: 'q', type: 'keyboard' },
  { id: 'camera-down', name: 'Move Down', description: 'Move camera down', category: 'camera', defaultKey: 'e', currentKey: 'e', type: 'keyboard' },
  { id: 'camera-speed', name: 'Speed Boost', description: 'Hold for faster movement', category: 'camera', defaultKey: 'shift', currentKey: 'shift', type: 'keyboard' },
  
  // Transform Controls
  { id: 'transform-move', name: 'Move Tool', description: 'Switch to move/translate tool', category: 'transform', defaultKey: 'g', currentKey: 'g', type: 'keyboard' },
  { id: 'transform-rotate', name: 'Rotate Tool', description: 'Switch to rotate tool', category: 'transform', defaultKey: 'r', currentKey: 'r', type: 'keyboard' },
  { id: 'transform-scale', name: 'Scale Tool', description: 'Switch to scale tool', category: 'transform', defaultKey: 's', currentKey: 's', type: 'keyboard' },
  
  // Tools
  { id: 'tool-select', name: 'Select Tool', description: 'Switch to selection tool', category: 'tools', defaultKey: 'v', currentKey: 'v', type: 'keyboard' },
  { id: 'tool-face-select', name: 'Face Select', description: 'Switch to face selection tool', category: 'tools', defaultKey: 'f', currentKey: 'f', type: 'keyboard' },
  { id: 'tool-sketch', name: 'Sketch Mode', description: 'Enter 3D sketch mode', category: 'tools', defaultKey: 'k', currentKey: 'k', type: 'keyboard' },
  { id: 'tool-measure', name: 'Measurement', description: 'Toggle measurement tools', category: 'tools', defaultKey: 'm', currentKey: 'm', type: 'keyboard' },
  
  // Actions
  { id: 'action-duplicate', name: 'Duplicate', description: 'Duplicate selected object', category: 'actions', defaultKey: 'ctrl+d', currentKey: 'ctrl+d', type: 'keyboard' },
  { id: 'action-delete', name: 'Delete', description: 'Delete selected object', category: 'actions', defaultKey: 'delete', currentKey: 'delete', type: 'keyboard' },
  { id: 'action-select-all', name: 'Select All', description: 'Select all objects', category: 'actions', defaultKey: 'ctrl+a', currentKey: 'ctrl+a', type: 'keyboard' },
  { id: 'action-deselect', name: 'Deselect', description: 'Deselect all objects', category: 'actions', defaultKey: 'escape', currentKey: 'escape', type: 'keyboard' },
  { id: 'action-undo', name: 'Undo', description: 'Undo last action', category: 'actions', defaultKey: 'ctrl+z', currentKey: 'ctrl+z', type: 'keyboard' },
  { id: 'action-redo', name: 'Redo', description: 'Redo last action', category: 'actions', defaultKey: 'ctrl+y', currentKey: 'ctrl+y', type: 'keyboard' },
  
  // Mouse Controls
  { id: 'mouse-orbit', name: 'Orbit Camera', description: 'Orbit around target', category: 'camera', defaultKey: 'left-click', currentKey: 'left-click', type: 'mouse' },
  { id: 'mouse-pan', name: 'Pan Camera', description: 'Pan camera view', category: 'camera', defaultKey: 'right-click', currentKey: 'right-click', type: 'mouse' },
  { id: 'mouse-zoom', name: 'Zoom', description: 'Zoom in/out', category: 'camera', defaultKey: 'scroll', currentKey: 'scroll', type: 'mouse' },
  { id: 'mouse-select', name: 'Select Object', description: 'Select objects in scene', category: 'tools', defaultKey: 'left-click', currentKey: 'left-click', type: 'mouse' },
];

const defaultColorSettings: ColorSettings = {
  gridColor: '#808080',
  backgroundColor: '#1a1a1a',
  selectionColor: '#3b82f6',
  hoverColor: '#60a5fa'
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  onSettingsChange
}) => {
  const [keyBindings, setKeyBindings] = useState<KeyBinding[]>(defaultKeyBindings);
  const [mouseSettings, setMouseSettings] = useState({
    sensitivity: 1.0,
    invertY: false,
    swapButtons: false
  });
  const [colorSettings, setColorSettings] = useState<ColorSettings>(defaultColorSettings);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<'camera' | 'transform' | 'tools' | 'actions' | 'colors'>('camera');
  const [searchTerm, setSearchTerm] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('cad-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (parsed.keyBindings) setKeyBindings(parsed.keyBindings);
        if (parsed.mouseSettings) setMouseSettings(parsed.mouseSettings);
        if (parsed.colorSettings) setColorSettings(parsed.colorSettings);
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    }
  }, []);

  // Track changes to mark as unsaved
  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [keyBindings, mouseSettings, colorSettings]);

  // Handle key binding change
  const handleKeyChange = (bindingId: string, newKey: string) => {
    setKeyBindings(prev => prev.map(binding => 
      binding.id === bindingId 
        ? { ...binding, currentKey: newKey }
        : binding
    ));
    setEditingKey(null);
  };

  // Handle key capture
  const handleKeyCapture = (e: React.KeyboardEvent, bindingId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const keys: string[] = [];
    if (e.ctrlKey) keys.push('ctrl');
    if (e.shiftKey) keys.push('shift');
    if (e.altKey) keys.push('alt');
    
    const key = e.key.toLowerCase();
    if (!['control', 'shift', 'alt'].includes(key)) {
      keys.push(key);
    }
    
    const keyString = keys.join('+');
    if (keyString && keyString !== 'ctrl' && keyString !== 'shift' && keyString !== 'alt') {
      handleKeyChange(bindingId, keyString);
    }
  };

  // Handle color changes
  const handleColorChange = (colorType: keyof ColorSettings, color: string) => {
    setColorSettings(prev => ({
      ...prev,
      [colorType]: color
    }));
  };

  // Save settings and apply changes
  const saveSettings = () => {
    const settings: SettingsData = { keyBindings, mouseSettings, colorSettings };
    localStorage.setItem('cad-settings', JSON.stringify(settings));
    onSettingsChange(settings);
    setHasUnsavedChanges(false);
    console.log('Settings saved and applied!');
  };

  // Reset to defaults
  const resetToDefaults = () => {
    setKeyBindings(defaultKeyBindings.map(binding => ({ ...binding })));
    setMouseSettings({ sensitivity: 1.0, invertY: false, swapButtons: false });
    setColorSettings({ ...defaultColorSettings });
    setHasUnsavedChanges(true);
  };

  // Filter bindings based on category and search
  const filteredBindings = keyBindings.filter(binding => {
    if (activeCategory === 'colors') return false;
    const matchesCategory = binding.category === activeCategory;
    const matchesSearch = searchTerm === '' || 
      binding.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      binding.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      binding.currentKey.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = [
    { id: 'camera', name: 'Camera', icon: Gamepad2, description: 'Camera movement and navigation' },
    { id: 'transform', name: 'Transform', icon: RotateCcw, description: 'Object transformation tools' },
    { id: 'tools', name: 'Tools', icon: SettingsIcon, description: 'Selection and modeling tools' },
    { id: 'actions', name: 'Actions', icon: Keyboard, description: 'General actions and shortcuts' },
    { id: 'colors', name: 'Colors', icon: Palette, description: 'Visual appearance settings' }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-900 p-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <SettingsIcon size={24} />
                Settings & Customization
                {hasUnsavedChanges && (
                  <span className="text-xs bg-orange-600 text-white px-2 py-1 rounded-full">
                    Unsaved Changes
                  </span>
                )}
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Customize keyboard shortcuts, mouse controls, and visual appearance
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={saveSettings}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  hasUnsavedChanges 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-gray-600 text-gray-300 cursor-not-allowed'
                }`}
                disabled={!hasUnsavedChanges}
              >
                <Save size={16} />
                Save & Apply
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-lg"
              >
                <X size={24} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-y-auto">
          {/* Sidebar - Fixed scrollbar issue */}
          <div className="w-64 bg-gray-900 border-r border-gray-700 flex-shrink-0 flex flex-col h-full">
            {/* Categories - Scrollable section */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                <div className="space-y-2 max-h-full">
                  {categories.map(category => {
                    const IconComponent = category.icon;
                    const bindingCount = keyBindings.filter(b => b.category === category.id).length;
                    return (
                      <button
                        key={category.id}
                        onClick={() => setActiveCategory(category.id as any)}
                        className={`
                          w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all text-left
                          ${activeCategory === category.id 
                            ? 'bg-blue-600 text-white' 
                            : 'text-gray-300 hover:bg-gray-700'
                          }
                        `}
                      >
                        <IconComponent size={18} />
                        <div className="flex-1">
                          <div className="font-medium">{category.name}</div>
                          {category.id !== 'colors' && (
                            <div className="text-xs opacity-75">{bindingCount} bindings</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Mouse Settings - Fixed at bottom */}
            <div className="border-t border-gray-700 p-4 flex-shrink-0">
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <Mouse size={16} />
                Mouse Settings
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Sensitivity</label>
                  <input
                    type="range"
                    min="0.1"
                    max="3"
                    step="0.1"
                    value={mouseSettings.sensitivity}
                    onChange={(e) => setMouseSettings(prev => ({ ...prev, sensitivity: parseFloat(e.target.value) }))}
                    className="w-full"
                  />
                  <div className="text-xs text-gray-500 text-center">{mouseSettings.sensitivity.toFixed(1)}x</div>
                </div>
                
                <label className="flex items-center gap-2 text-xs text-gray-300">
                  <input
                    type="checkbox"
                    checked={mouseSettings.invertY}
                    onChange={(e) => setMouseSettings(prev => ({ ...prev, invertY: e.target.checked }))}
                    className="rounded"
                  />
                  Invert Y-axis
                </label>
                
                <label className="flex items-center gap-2 text-xs text-gray-300">
                  <input
                    type="checkbox"
                    checked={mouseSettings.swapButtons}
                    onChange={(e) => setMouseSettings(prev => ({ ...prev, swapButtons: e.target.checked }))}
                    className="rounded"
                  />
                  Swap mouse buttons
                </label>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search and Actions */}
            {activeCategory !== 'colors' && (
              <div className="p-4 border-b border-gray-700 flex-shrink-0">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Search key bindings..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={resetToDefaults}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    <RotateCcw size={16} />
                    Reset All
                  </button>
                </div>
              </div>
            )}

            {/* Content Area - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeCategory === 'colors' ? (
                /* Color Settings */
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Visual Appearance</h3>
                    <p className="text-sm text-gray-400 mb-6">
                      Customize the colors of the grid, background, and interface elements
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Grid Color */}
                    <div className="bg-gray-700 rounded-lg p-4">
                      <label className="block text-sm font-medium text-white mb-3">
                        Grid Color
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={colorSettings.gridColor}
                          onChange={(e) => handleColorChange('gridColor', e.target.value)}
                          className="w-12 h-12 rounded-lg border-2 border-gray-600 cursor-pointer"
                        />
                        <div className="flex-1">
                          <input
                            type="text"
                            value={colorSettings.gridColor}
                            onChange={(e) => handleColorChange('gridColor', e.target.value)}
                            className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white font-mono text-sm"
                            placeholder="#808080"
                          />
                          <p className="text-xs text-gray-400 mt-1">Color of the 3D grid lines</p>
                        </div>
                      </div>
                    </div>

                    {/* Background Color */}
                    <div className="bg-gray-700 rounded-lg p-4">
                      <label className="block text-sm font-medium text-white mb-3">
                        Background Color
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={colorSettings.backgroundColor}
                          onChange={(e) => handleColorChange('backgroundColor', e.target.value)}
                          className="w-12 h-12 rounded-lg border-2 border-gray-600 cursor-pointer"
                        />
                        <div className="flex-1">
                          <input
                            type="text"
                            value={colorSettings.backgroundColor}
                            onChange={(e) => handleColorChange('backgroundColor', e.target.value)}
                            className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white font-mono text-sm"
                            placeholder="#1a1a1a"
                          />
                          <p className="text-xs text-gray-400 mt-1">3D viewport background color</p>
                        </div>
                      </div>
                    </div>

                    {/* Selection Color */}
                    <div className="bg-gray-700 rounded-lg p-4">
                      <label className="block text-sm font-medium text-white mb-3">
                        Selection Color
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={colorSettings.selectionColor}
                          onChange={(e) => handleColorChange('selectionColor', e.target.value)}
                          className="w-12 h-12 rounded-lg border-2 border-gray-600 cursor-pointer"
                        />
                        <div className="flex-1">
                          <input
                            type="text"
                            value={colorSettings.selectionColor}
                            onChange={(e) => handleColorChange('selectionColor', e.target.value)}
                            className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white font-mono text-sm"
                            placeholder="#3b82f6"
                          />
                          <p className="text-xs text-gray-400 mt-1">Color for selected objects</p>
                        </div>
                      </div>
                    </div>

                    {/* Hover Color */}
                    <div className="bg-gray-700 rounded-lg p-4">
                      <label className="block text-sm font-medium text-white mb-3">
                        Hover Color
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={colorSettings.hoverColor}
                          onChange={(e) => handleColorChange('hoverColor', e.target.value)}
                          className="w-12 h-12 rounded-lg border-2 border-gray-600 cursor-pointer"
                        />
                        <div className="flex-1">
                          <input
                            type="text"
                            value={colorSettings.hoverColor}
                            onChange={(e) => handleColorChange('hoverColor', e.target.value)}
                            className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white font-mono text-sm"
                            placeholder="#60a5fa"
                          />
                          <p className="text-xs text-gray-400 mt-1">Color for hovered elements</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Color Presets */}
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-white mb-3">Color Presets</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { name: 'Default', grid: '#808080', bg: '#1a1a1a', selection: '#3b82f6', hover: '#60a5fa' },
                        { name: 'Dark Blue', grid: '#4a90e2', bg: '#0f1419', selection: '#00d4ff', hover: '#4fc3f7' },
                        { name: 'Green', grid: '#4ade80', bg: '#0f1b0f', selection: '#10b981', hover: '#34d399' },
                        { name: 'Purple', grid: '#a855f7', bg: '#1a0f1a', selection: '#8b5cf6', hover: '#a78bfa' }
                      ].map(preset => (
                        <button
                          key={preset.name}
                          onClick={() => setColorSettings({
                            gridColor: preset.grid,
                            backgroundColor: preset.bg,
                            selectionColor: preset.selection,
                            hoverColor: preset.hover
                          })}
                          className="p-3 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors text-left"
                        >
                          <div className="text-xs font-medium text-white mb-2">{preset.name}</div>
                          <div className="flex gap-1">
                            <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.grid }}></div>
                            <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.bg }}></div>
                            <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.selection }}></div>
                            <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.hover }}></div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Key Bindings List */
                <div>
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {categories.find(c => c.id === activeCategory)?.name} Controls
                    </h3>
                    <p className="text-sm text-gray-400">
                      {categories.find(c => c.id === activeCategory)?.description}
                    </p>
                  </div>

                  <div className="space-y-2">
                    {filteredBindings.map(binding => (
                      <div
                        key={binding.id}
                        className="flex items-center justify-between p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{binding.name}</span>
                            {binding.type === 'mouse' && (
                              <Mouse size={14} className="text-gray-400" />
                            )}
                            {binding.type === 'keyboard' && (
                              <Keyboard size={14} className="text-gray-400" />
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{binding.description}</p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {binding.currentKey !== binding.defaultKey && (
                            <button
                              onClick={() => handleKeyChange(binding.id, binding.defaultKey)}
                              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              Reset
                            </button>
                          )}
                          
                          {binding.type === 'keyboard' ? (
                            <div
                              className={`
                                px-3 py-1 rounded border cursor-pointer transition-all min-w-[80px] text-center
                                ${editingKey === binding.id 
                                  ? 'border-blue-500 bg-blue-900 text-blue-200' 
                                  : 'border-gray-500 bg-gray-800 text-gray-200 hover:border-gray-400'
                                }
                              `}
                              onClick={() => setEditingKey(binding.id)}
                              onKeyDown={(e) => editingKey === binding.id && handleKeyCapture(e, binding.id)}
                              tabIndex={0}
                            >
                              {editingKey === binding.id ? (
                                <span className="text-xs">Press key...</span>
                              ) : (
                                <span className="text-xs font-mono uppercase">
                                  {binding.currentKey.replace('ctrl+', '⌘').replace('shift+', '⇧').replace('alt+', '⌥')}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="px-3 py-1 rounded border border-gray-500 bg-gray-800 text-gray-200 min-w-[80px] text-center">
                              <span className="text-xs font-mono uppercase">{binding.currentKey}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {filteredBindings.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <Keyboard size={48} className="mx-auto mb-4 opacity-50" />
                      <p>No key bindings found matching your search.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-900 p-4 border-t border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <div>
              {hasUnsavedChanges ? (
                <span className="text-orange-400">You have unsaved changes. Click "Save & Apply" to apply them.</span>
              ) : (
                <span>Settings are saved and applied.</span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span>Total bindings: {keyBindings.length}</span>
              <span>Modified: {keyBindings.filter(b => b.currentKey !== b.defaultKey).length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};