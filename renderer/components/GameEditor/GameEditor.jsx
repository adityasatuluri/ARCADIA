import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import './GameEditor.css';
import { useModalFocus } from '../../hooks/useModalFocus';

export default function GameEditor({ game, onClose, onSave }) {
  const modalRef = useRef(null);
  useModalFocus(modalRef);

  const [formData, setFormData] = useState({
    id: '',
    type: 'pc',
    name: '',
    display_name: '',
    platform: 'PC',
    executable: '',
    working_directory: '',
    arguments: '',
    game_path: '',
    emulator_id: '',
    save_path: '',
    icon_path: '',
    background_path: '',
    description: '',
    year: '',
    developer: '',
    publisher: '',
    genre: '',
    tags: '',
    favorite: false,
    notes: ''
  });

  const [emulators, setEmulators] = useState([]);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (window.arcadiaAPI) {
      window.arcadiaAPI.emulators.getAll().then(res => {
        if (res.success) setEmulators(res.data);
      });
    }

    if (game) {
      setFormData({
        ...game,
        tags: Array.isArray(game.tags) ? game.tags.join(', ') : '',
        genre: Array.isArray(game.genre) ? game.genre.join(', ') : '',
        favorite: !!game.favorite
      });
    } else {
      setFormData(prev => ({ ...prev, id: 'game-' + Date.now() }));
    }
  }, [game]);

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

    if (formData.type === 'pc') {
      if (!formData.executable.trim()) newErrors.executable = 'Executable path is required';
    } else {
      if (!formData.game_path.trim()) newErrors.game_path = 'Game path (ROM) is required';
      if (!formData.emulator_id) newErrors.emulator_id = 'Emulator must be selected';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const gameData = {
      ...formData,
      year: parseInt(formData.year) || null,
      tags: formData.tags.split(',').map(s => s.trim()).filter(Boolean),
      genre: formData.genre.split(',').map(s => s.trim()).filter(Boolean),
    };

    onSave(gameData);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleBrowse = async (field, filters = [], isDir = false) => {
    if (!window.arcadiaAPI) return;
    const properties = isDir ? ['openDirectory'] : ['openFile'];
    const path = await window.arcadiaAPI.system.showOpenDialog({ properties, filters });
    if (path) {
      setFormData(prev => {
        const next = { ...prev, [field]: path };
        if (field === 'executable' && prev.type === 'pc') {
          // Default working directory to exe's folder if empty or same directory
          const lastSlash = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
          if (lastSlash > -1) {
            const dir = path.substring(0, lastSlash);
            if (!prev.working_directory || prev.working_directory.trim() === '') {
              next.working_directory = dir;
            }
          }
        }
        return next;
      });
    }
  };

  return (
    <div className="game-editor-overlay" ref={modalRef}>
      <div className="game-editor-modal">
        <div className="game-editor-header">
          <h2>{game ? 'Edit Game' : 'Add New Game'}</h2>
          <button className="game-editor-close" onClick={onClose} tabIndex={0}><X size={20} /></button>
        </div>
        
        <form className="game-editor-form" onSubmit={handleSubmit}>
          <div className="game-editor-scroll">
            <div className="form-group">
              <label>Type</label>
              <select name="type" value={formData.type} onChange={handleChange} tabIndex={0}>
                <option value="emulator">Emulator Game</option>
                <option value="pc">PC Game</option>
              </select>
            </div>

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
                <input type="text" name="platform" value={formData.platform} onChange={handleChange} tabIndex={0}/>
                {errors.platform && <span className="error-text">{errors.platform}</span>}
              </div>
              <div className="form-group">
                <label>Favorite</label>
                <div style={{ paddingTop: '8px' }}>
                  <input type="checkbox" name="favorite" checked={formData.favorite} onChange={handleChange} tabIndex={0}/>
                </div>
              </div>
            </div>

            {formData.type === 'emulator' && (
              <>
                <div className="form-group">
                  <label>Game Path (ROM/ISO) *</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input style={{ flex: 1 }} type="text" name="game_path" value={formData.game_path} onChange={handleChange} tabIndex={0} placeholder="C:\Games\ROMs\game.iso"/>
                    <button type="button" onClick={() => handleBrowse('game_path')} className="btn-cancel" style={{ padding: '0 12px' }}>Browse</button>
                  </div>
                  {errors.game_path && <span className="error-text">{errors.game_path}</span>}
                </div>
                <div className="form-group">
                  <label>Emulator *</label>
                  <select name="emulator_id" value={formData.emulator_id} onChange={handleChange} tabIndex={0}>
                    <option value="">Select Emulator...</option>
                    {emulators.map(emu => (
                      <option key={emu.id} value={emu.id}>{emu.display_name} ({emu.platform})</option>
                    ))}
                  </select>
                  {errors.emulator_id && <span className="error-text">{errors.emulator_id}</span>}
                </div>
              </>
            )}

            {formData.type === 'pc' && (
              <>
                <div className="form-group">
                  <label>Executable Path *</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input style={{ flex: 1 }} type="text" name="executable" value={formData.executable} onChange={handleChange} tabIndex={0} placeholder="C:\Games\Game\game.exe"/>
                    <button type="button" onClick={() => handleBrowse('executable', [{ name: 'Executables', extensions: ['exe', 'bat', 'cmd'] }])} className="btn-cancel" style={{ padding: '0 12px' }}>Browse</button>
                  </div>
                  {errors.executable && <span className="error-text">{errors.executable}</span>}
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Arguments</label>
                    <input type="text" name="arguments" value={formData.arguments} onChange={handleChange} tabIndex={0} placeholder="-fullscreen"/>
                  </div>
                  <div className="form-group">
                    <label>Working Directory</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input style={{ flex: 1 }} type="text" name="working_directory" value={formData.working_directory} onChange={handleChange} tabIndex={0}/>
                      <button type="button" onClick={() => handleBrowse('working_directory', [], true)} className="btn-cancel" style={{ padding: '0 12px' }}>Browse</button>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="form-group">
              <label>Save Path</label>
              <input type="text" name="save_path" value={formData.save_path} onChange={handleChange} tabIndex={0} placeholder="Path to save directory or file"/>
            </div>

            <div className="form-group">
              <label>Artwork (Icon Path)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input style={{ flex: 1 }} type="text" name="icon_path" value={formData.icon_path} onChange={handleChange} tabIndex={0} placeholder="Path to cover image"/>
                <button type="button" onClick={() => handleBrowse('icon_path', [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'ico', 'webp'] }])} className="btn-cancel" style={{ padding: '0 12px' }}>Browse</button>
              </div>
            </div>

            <div className="form-group">
              <label>Background Artwork (Large Cover)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input style={{ flex: 1 }} type="text" name="background_path" value={formData.background_path || ''} onChange={handleChange} tabIndex={0} placeholder="Path to large background image"/>
                <button type="button" onClick={() => handleBrowse('background_path', [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }])} className="btn-cancel" style={{ padding: '0 12px' }}>Browse</button>
              </div>
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea name="description" value={formData.description} onChange={handleChange} tabIndex={0} rows="3"></textarea>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Year</label>
                <input type="number" name="year" value={formData.year} onChange={handleChange} tabIndex={0}/>
              </div>
              <div className="form-group">
                <label>Developer</label>
                <input type="text" name="developer" value={formData.developer} onChange={handleChange} tabIndex={0}/>
              </div>
              <div className="form-group">
                <label>Publisher</label>
                <input type="text" name="publisher" value={formData.publisher} onChange={handleChange} tabIndex={0}/>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Genre (comma separated)</label>
                <input type="text" name="genre" value={formData.genre} onChange={handleChange} tabIndex={0}/>
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
          </div>
          
          <div className="game-editor-actions">
            <button type="button" className="btn-cancel" onClick={onClose} tabIndex={0}>Cancel</button>
            <button type="submit" className="btn-save" tabIndex={0}>Save Game</button>
          </div>
        </form>
      </div>
    </div>
  );
}
