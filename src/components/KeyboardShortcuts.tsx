import React, { useEffect } from 'react';
import { SettingsData } from './SettingsPanel';

interface KeyboardShortcutsProps {
  onTransformModeChange: (mode: 'translate' | 'rotate' | 'scale') => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSelectAll: () => void;
  onDeselect: () => void;
  onToolChange: (tool: string) => void;
  selectedObjectId: string | null;
  settings?: SettingsData;
}

export const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({
  onTransformModeChange,
  onDuplicate,
  onDelete,
  onSelectAll,
  onDeselect,
  onToolChange,
  selectedObjectId,
  settings
}) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in input fields
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = event.key.toLowerCase();
      const ctrlOrCmd = event.ctrlKey || event.metaKey;
      const shift = event.shiftKey;
      const alt = event.altKey;

      // Build key combination string
      const keys: string[] = [];
      if (ctrlOrCmd) keys.push('ctrl');
      if (shift) keys.push('shift');
      if (alt) keys.push('alt');
      keys.push(key);
      const keyCombo = keys.join('+');

      // Get current key bindings or use defaults
      const keyBindings = settings?.keyBindings || [];
      
      // Helper function to find binding by current key
      const findBinding = (targetKey: string) => 
        keyBindings.find(binding => binding.currentKey === targetKey);

      // Check for matches - try both full combo and single key
      const binding = findBinding(keyCombo) || findBinding(key);
      
      if (binding) {
        event.preventDefault();
        
        switch (binding.id) {
          // Transform controls (only when object is selected)
          case 'transform-move':
            if (selectedObjectId) onTransformModeChange('translate');
            break;
          case 'transform-rotate':
            if (selectedObjectId) onTransformModeChange('rotate');
            break;
          case 'transform-scale':
            if (selectedObjectId && !ctrlOrCmd) onTransformModeChange('scale');
            break;
            
          // Tool switching
          case 'tool-select':
            onToolChange('select');
            break;
          case 'tool-face-select':
            onToolChange('face-select');
            break;
          case 'tool-sketch':
            // This would be handled by the parent component
            break;
          case 'tool-measure':
            // This would be handled by the parent component
            break;
            
          // Actions
          case 'action-duplicate':
            onDuplicate();
            break;
          case 'action-delete':
            onDelete();
            break;
          case 'action-select-all':
            onSelectAll();
            break;
          case 'action-deselect':
            onDeselect();
            break;
          case 'action-undo':
            // This would be handled by the parent component
            console.log('Undo action triggered');
            break;
          case 'action-redo':
            // This would be handled by the parent component
            console.log('Redo action triggered');
            break;
        }
      } else {
        // Fallback to default behavior if no custom binding found
        if (selectedObjectId) {
          switch (key) {
            case 't':
              event.preventDefault();
              onTransformModeChange('translate');
              break;
            case 'y':
              event.preventDefault();
              onTransformModeChange('rotate');
              break;
            case 'u':
              if (!ctrlOrCmd) {
                event.preventDefault();
                onTransformModeChange('scale');
              }
              break;
            case 'delete':
            case 'backspace':
              event.preventDefault();
              onDelete();
              break;
          }
        }

        // Global shortcuts
        if (ctrlOrCmd) {
          switch (key) {
            case 'd':
              event.preventDefault();
              onDuplicate();
              break;
            case 'a':
              event.preventDefault();
              onSelectAll();
              break;
          }
        }

        // Escape to deselect
        if (key === 'escape') {
          event.preventDefault();
          onDeselect();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObjectId, onTransformModeChange, onDuplicate, onDelete, onSelectAll, onDeselect, onToolChange, settings]);

  return null; // This component doesn't render anything
};