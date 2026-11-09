import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiArrowRight, FiCheck, FiHome, FiInfo, FiPlus, FiTrash2 } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../api';
import CustomSelect from '../components/CustomSelect';

const initialForm = {
  block: '',
  room_number: '',
  room_type: '2-sharing',
  bed_type: 'Normal Bed',
  total_capacity: 2,
  additional_requirements: ''
};

const CreateRoom = () => {
  const [formData, setFormData] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [customOptions, setCustomOptions] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const updateField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setError('');
  };

  const handleRoomTypeChange = (value) => {
    const inferredCapacity = Number(value.split('-')[0]) || 2;
    setFormData((current) => ({
      ...current,
      room_type: value,
      total_capacity: inferredCapacity
    }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const block = formData.block.trim();
    const roomNumber = formData.room_number.trim();
    if (!block) {
      setError('Enter the hostel block so students can identify the room.');
      return;
    }
    if (!roomNumber || roomNumber.length > 20) {
      setError('Enter the room number shown on the hostel room.');
      return;
    }
    if (!Number.isInteger(Number(formData.total_capacity)) || Number(formData.total_capacity) < 1 || Number(formData.total_capacity) > 4) {
      setError('Room capacity must be between 1 and 4.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        block,
        room_number: roomNumber,
        total_capacity: Number(formData.total_capacity),
        additional_requirements: formData.additional_requirements.trim(),
        custom_options: customOptions.filter((option) => option.label.trim() && option.value.trim())
      };
      await api.post('/rooms', payload);
      toast.success('Your room has been listed.');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const message = err.response?.data?.message || 'We could not list your room. Please try again.';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="create-room-page">
      <div className="create-room-container">
        <button type="button" className="create-back-link" onClick={() => navigate('/dashboard')}>
          <FiArrowLeft /> Back to owner dashboard
        </button>

        <div className="create-room-heading">
          <span className="discover-eyebrow"><span /> ROOM LISTING</span>
          <h1>Make room for a good match.</h1>
          <p>Share the basic details of your room. Compatible students can discover it and send an application.</p>
        </div>

        <div className="create-room-layout">
          <form className="create-room-form surface-card" onSubmit={handleSubmit}>
            {error && <div className="create-form-error" role="alert">{error}</div>}

            <section className="create-form-section">
              <div className="create-section-heading">
                <span className="create-section-icon"><FiHome /></span>
                <div>
                  <h2>Room details</h2>
                  <p>Help students find the right space.</p>
                </div>
              </div>

              <div className="create-form-grid">
                <div className="create-form-field">
                  <label htmlFor="room-block">Hostel block <span>Required</span></label>
                  <input
                    id="room-block"
                    className="input-field"
                    type="text"
                    maxLength={50}
                    required
                    autoComplete="off"
                    value={formData.block}
                    onChange={(event) => updateField('block', event.target.value)}
                    placeholder="e.g. Men's Hostel · Block K"
                  />
                  <small>Use the block name students will recognize.</small>
                </div>
                <div className="create-form-field">
                  <label htmlFor="room-number">Room number <span>Required</span></label>
                  <input
                    id="room-number"
                    className="input-field"
                    type="text"
                    maxLength={20}
                    required
                    autoComplete="off"
                    value={formData.room_number}
                    onChange={(event) => updateField('room_number', event.target.value)}
                    placeholder="e.g. 204"
                  />
                  <small>Enter the individual room number within the block.</small>
                </div>
              </div>

              <div className="create-form-grid">
                <div className="create-form-field">
                  <label htmlFor="room-type">Sharing type</label>
                  <CustomSelect
                    id="room-type"
                    ariaLabel="Sharing type"
                    value={formData.room_type}
                    onChange={handleRoomTypeChange}
                    options={[
                      { value: '1-sharing', label: '1-sharing' },
                      { value: '2-sharing', label: '2-sharing' },
                      { value: '3-sharing', label: '3-sharing' },
                      { value: '4-sharing', label: '4-sharing' }
                    ]}
                  />
                </div>

                <div className="create-form-field">
                  <label htmlFor="bed-type">Bed type</label>
                  <CustomSelect
                    id="bed-type"
                    ariaLabel="Bed type"
                    value={formData.bed_type}
                    onChange={(value) => updateField('bed_type', value)}
                    options={[
                      { value: 'Normal Bed', label: 'Normal bed' },
                      { value: 'Bunk Bed', label: 'Bunk bed' }
                    ]}
                  />
                </div>
              </div>

              <div className="create-form-field capacity-field">
                <label htmlFor="room-capacity">Total room capacity</label>
                <div className="capacity-input-wrap">
                  <input
                    id="room-capacity"
                    className="input-field"
                    type="number"
                    min="1"
                    max="4"
                    step="1"
                    required
                    value={formData.total_capacity}
                    onChange={(event) => updateField('total_capacity', event.target.value)}
                  />
                  <span>people total</span>
                </div>
                <small>Set the total number of people the room can accommodate, including you.</small>
              </div>
            </section>

            <section className="create-form-section create-form-section-last">
              <div className="create-section-heading">
                <span className="create-section-icon"><FiInfo /></span>
                <div>
                  <h2>Roommate notes</h2>
                  <p>Anything else students should know?</p>
                </div>
              </div>
              <div className="create-form-field">
                <label htmlFor="room-notes">Additional requirements <span>Optional</span></label>
                <textarea
                  id="room-notes"
                  className="input-field create-room-textarea"
                  maxLength={1000}
                  value={formData.additional_requirements}
                  onChange={(event) => updateField('additional_requirements', event.target.value)}
                  placeholder="Share relevant preferences or details about the room…"
                />
                <small className="create-character-count">{formData.additional_requirements.length}/1000</small>
              </div>
            </section>

            <section className="create-form-section create-custom-options-section">
              <div className="create-section-heading">
                <span className="create-section-icon"><FiPlus /></span>
                <div><h2>Your room's match preferences</h2><p>Add optional criteria that should influence compatibility.</p></div>
              </div>
              <p className="create-custom-help">Examples: noise after 10 PM, guests, gaming, temperature or shared cooking. Students can add their own answers in their profile.</p>
              <div className="create-custom-option-list">
                {customOptions.map((option, index) => (
                  <div className="create-custom-option-row" key={index}>
                    <label><span>What matters?</span><input className="input-field" maxLength={40} value={option.label} placeholder="e.g. Quiet hours" onChange={(event) => setCustomOptions((items) => items.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} /></label>
                    <label><span>Your preference</span><input className="input-field" maxLength={100} value={option.value} placeholder="e.g. Quiet after 10 PM" onChange={(event) => setCustomOptions((items) => items.map((item, i) => i === index ? { ...item, value: event.target.value } : item))} /></label>
                    <button type="button" className="create-remove-option" aria-label="Remove custom preference" onClick={() => setCustomOptions((items) => items.filter((_, i) => i !== index))}><FiTrash2 /></button>
                  </div>
                ))}
              </div>
              {customOptions.length < 8 && <button type="button" className="create-add-option" onClick={() => setCustomOptions((items) => [...items, { label: '', value: '' }])}><FiPlus /> Add a custom preference</button>}
            </section>

            <div className="create-form-actions">
              <button type="button" className="btn-secondary" onClick={() => navigate('/dashboard')} disabled={submitting}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={submitting || !formData.block.trim()}>
                {submitting
                  ? <span>Listing room…</span>
                  : <><span>List your room</span><FiArrowRight /></>}
              </button>
            </div>
          </form>

          <aside className="create-room-aside">
            <div className="create-aside-card">
              <span className="create-aside-number">01</span>
              <h3>Good details make better matches.</h3>
              <p>Students compare the room information alongside lifestyle compatibility from their profiles.</p>
              <div className="create-aside-divider" />
              <div className="create-aside-check"><FiCheck /><span>Clear room information</span></div>
              <div className="create-aside-check"><FiCheck /><span>Sharing and bed details</span></div>
              <div className="create-aside-check"><FiCheck /><span>Roommate expectations</span></div>
            </div>
            <p className="create-aside-note">You can review incoming applications from your owner dashboard.</p>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default CreateRoom;
