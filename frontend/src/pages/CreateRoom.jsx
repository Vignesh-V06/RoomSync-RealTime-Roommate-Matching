import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiArrowRight, FiCheck, FiHome, FiInfo } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../api';

const initialForm = {
  block: '',
  room_type: '2-sharing',
  bed_type: 'Normal Bed',
  total_capacity: 2,
  additional_requirements: ''
};

const CreateRoom = () => {
  const [formData, setFormData] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
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
    if (!block) {
      setError('Enter the hostel block so students can identify the room.');
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
        total_capacity: Number(formData.total_capacity),
        additional_requirements: [
          'Bed Type: ' + formData.bed_type + '.',
          formData.additional_requirements.trim()
        ].filter(Boolean).join(' ')
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
                  placeholder="e.g. Men's Hostel · Block A"
                />
                <small>Use the block name students will recognize.</small>
              </div>

              <div className="create-form-grid">
                <div className="create-form-field">
                  <label htmlFor="room-type">Sharing type</label>
                  <select id="room-type" className="input-field" value={formData.room_type} onChange={(event) => handleRoomTypeChange(event.target.value)}>
                    <option value="1-sharing">1-sharing</option>
                    <option value="2-sharing">2-sharing</option>
                    <option value="3-sharing">3-sharing</option>
                    <option value="4-sharing">4-sharing</option>
                  </select>
                </div>

                <div className="create-form-field">
                  <label htmlFor="bed-type">Bed type</label>
                  <select id="bed-type" className="input-field" value={formData.bed_type} onChange={(event) => updateField('bed_type', event.target.value)}>
                    <option value="Normal Bed">Normal bed</option>
                    <option value="Bunk Bed">Bunk bed</option>
                  </select>
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

            <div className="create-form-actions">
              <button type="button" className="btn-secondary" onClick={() => navigate('/dashboard')} disabled={submitting}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={submitting || !formData.block.trim()}>
                {submitting ? 'Listing room…' : 'List your room'}
                {!submitting && <FiArrowRight />}
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
