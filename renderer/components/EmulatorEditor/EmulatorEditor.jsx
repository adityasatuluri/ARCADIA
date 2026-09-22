import React, { useState, useEffect } from 'react';
import '../GameEditor/GameEditor.css'; // Reuse form styles

export default function EmulatorEditor({ emulator, onClose, onSave }) {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    display_name: '',
    platform: '',
    executable: '',
    working_directory: '',
    arguments: '',
    icon_path: '',
    description: '',
    version: '',
    developer: '',
    tags: '',
    is_default: false,
    notes: ''
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (emulator) {
      setFormData({
        ...emulator,
        tags: Array.isArray(emulator.tags) ? emulator.tags.join(', ') : ''
      });
    } else {
      setFormData(prev => ({ ...prev, id: 'emu-' + Date.now() }));
    }
  }, [emulator]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.display_name.trim()) newErrors.display_name = 'Display Name is required';
    if (!formData.platform.trim()) newErrors.platform = 'Platform is required';
    if (!formData.executable.trim()) newErrors.executable = 'Executable path is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const emuData = {
      ...formData,
      tags: formData.tags.split(',').map(s => s.trim()).filter(Boolean)
    };

    onSave(emuData);
  };

  const handleBrowse = async (field, filters = [], isDir = false) => {
    if (!window.arcadiaAPI) return;
    const properties = isDir ? ['openDirectory'] : ['openFile'];
    const path = await window.arcadiaAPI.system.showOpenDialog({ properties, filters });
    if (path) {
      setFormData(prev => ({ ...prev, [field]: path }));
    }
  };

  return (
    <div className="game-editor-overlay">
      <div className="game-editor-modal">
        <div className="game-editor-header">
          <h2>{emulator ? 'Edit Emulator' : 'Add Emulator'}</h2>
          <button className="game-editor-close" onClick={onClose} tabIndex={0}>✕</button>
        </div>
        
        <form className="game-editor-form" onSubmit={handleSubmit}>
          <div className="game-editor-scroll">
            
            <div className="form-row">
              <div className="form-group">
                <label>Name (Internal ID) *</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} tabIndex={0}/>
                {errors.name && <span className="error-text">{errors.name}</span>}
              </div>
              <div className="form-group">
                <label>Display Name *</label>
                <input type="text" name="display_name" value={formData.display_name} onChange={handleChange} tabIndex={0}/>
                {errors.display_name && <span className="error-text">{errors.display_name}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Platform *</label>
                <input type="text" name="platform" value={formData.platform} onChange={handleChange} tabIndex={0} placeholder="e.g. Xbox 360"/>
                {errors.platform && <span className="error-text">{errors.platform}</span>}
              </div>
              <div className="form-group">
                <label>Version</label>
                <input type="text" name="version" value={formData.version} onChange={handleChange} tabIndex={0}/>
              </div>
            </div>

            <div className="form-group">
              <label>Executable Path *</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input style={{ flex: 1 }} type="text" name="executable" value={formData.executable} onChange={handleChange} tabIndex={0} placeholder="C:\Emulators\xemu\xemu.exe"/>
                <button type="button" onClick={() => handleBrowse('executable', [{ name: 'Executables', extensions: ['exe', 'bat', 'cmd'] }])} className="btn-cancel" style={{ padding: '0 12px' }}>Browse</button>
              </div>
              {errors.executable && <span className="error-text">{errors.executable}</span>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Arguments</label>
                <input type="text" name="arguments" value={formData.arguments} onChange={handleChange} tabIndex={0} placeholder="-dvd_path {game_path}"/>
              </div>
              <div className="form-group">
                <label>Working Directory</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input style={{ flex: 1 }} type="text" name="working_directory" value={formData.working_directory} onChange={handleChange} tabIndex={0}/>
                  <button type="button" onClick={() => handleBrowse('working_directory', [], true)} className="btn-cancel" style={{ padding: '0 12px' }}>Browse</button>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Artwork (Icon Path)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input style={{ flex: 1 }} type="text" name="icon_path" value={formData.icon_path} onChange={handleChange} tabIndex={0} placeholder="Path to icon image"/>
                <button type="button" onClick={() => handleBrowse('icon_path', [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'ico'] }])} className="btn-cancel" style={{ padding: '0 12px' }}>Browse</button>
              </div>
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea name="description" value={formData.description} onChange={handleChange} tabIndex={0} rows="2"></textarea>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Developer</label>
                <input type="text" name="developer" value={formData.developer} onChange={handleChange} tabIndex={0}/>
              </div>
              <div className="form-group">
                <label>Tags (comma separated)</label>
                <input type="text" name="tags" value={formData.tags} onChange={handleChange} tabIndex={0}/>
              </div>
            </div>
            
            <div className="form-group">
              <label>Notes</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} tabIndex={0} rows="2"></textarea>
            </div>

            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <input type="checkbox" name="is_default" id="is_default" checked={formData.is_default} onChange={handleChange} tabIndex={0}/>
              <label htmlFor="is_default" style={{ cursor: 'pointer' }}>Set as default emulator for {formData.platform || 'this platform'}</label>
            </div>
          </div>
          
          <div className="game-editor-actions">
            <button type="button" className="btn-cancel" onClick={onClose} tabIndex={0}>Cancel</button>
            <button type="submit" className="btn-save" tabIndex={0}>Save Emulator</button>
          </div>
        </form>
      </div>
    </div>
  );
}
