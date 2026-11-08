import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiEdit2, FiMapPin, FiBook, FiBriefcase, FiHeart, FiSettings, FiCheck } from 'react-icons/fi';
import api from '../api';
import CustomSelect from '../components/CustomSelect';
import toast from 'react-hot-toast';

const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [applications, setApplications] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const navigate = useNavigate();

  const defaultFormData = {
    bio: '', skills: '', interests: '', academic_details: '',
    language: 'English', branch: 'Computer Science', cgpa_range: '8-9',
    bed_pref: 'lower', expected_members: 2, sleep_pref: 'Night Owl',
    study_pref: 'Total Silence', food_pref: 'Vegetarian', cleanliness: 'Moderate'
  };

  const [formData, setFormData] = useState(defaultFormData);
  const [customPrefRows, setCustomPrefRows] = useState([{ key: '', value: '' }]);
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const [profileRes, appsRes] = await Promise.all([
          api.get(`/profiles/${user.id}`),
          api.get('/rooms/my-applications')
        ]);
        setProfile(profileRes.data);
        setFormData(prev => ({ ...prev, ...profileRes.data }));
        if (!profileRes.data.user_id) {
          setIsEditing(true);
          toast('Complete your matching profile to get more accurate room scores.');
        }
        const customPrefs = profileRes.data.custom_preferences || {};
        setCustomPrefRows([...Object.entries(customPrefs).map(([key, value]) => ({ key, value })), { key: '', value: '' }]);
        setApplications(appsRes.data);
      } catch (err) {
        if (err?.response?.status === 404) {
          toast.error('Complete your profile to unlock all features!');
          setIsEditing(true);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProfileData();
  }, [user.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const customPreferences = Object.fromEntries(customPrefRows
        .filter((item) => item.key.trim() && item.value.trim())
        .slice(0, 12)
        .map((item) => [item.key.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''), item.value.trim()]));
      await api.post('/profiles', { ...formData, custom_preferences: customPreferences });
      toast.success('Profile updated successfully!');
      setProfile({...profile, ...formData, custom_preferences: customPreferences, user_name: user?.name || profile?.user_name});
      setIsEditing(false);
    } catch {
      toast.error('Failed to update profile');
    }
  };

  if (loading) return <div className="p-12 text-center text-slate-500 animate-pulse">Loading amazing profile...</div>;

  const avatarUrl = `https://api.dicebear.com/7.x/notionists/svg?seed=${user?.name || user?.id}&backgroundColor=e2e8f0`;
  const name = profile?.user_name || user?.name || 'New User';

  return (
    <div className="profile-page max-w-6xl mx-auto p-4 md:p-6 mt-4">
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* LEFT SIDEBAR (GitHub Style) */}
        <div className="w-full md:w-1/3 lg:w-1/4">
          <div className="glass-panel p-6 sticky top-24">
            <div className="relative">
              <img src={avatarUrl} alt="Avatar" className="w-48 h-48 mx-auto rounded-full border-4 border-white dark:border-slate-700 shadow-xl object-cover bg-white" />
              <div className="absolute bottom-2 right-10 bg-green-500 w-5 h-5 rounded-full border-2 border-white dark:border-slate-800"></div>
            </div>
            
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-6 text-center md:text-left">{name}</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm text-center md:text-left mb-2">@{profile?.username || user?.username || name.toLowerCase().replace(/\s/g, '')}</p>
            <div className="profile-contact-summary"><span>{profile?.user_email || user?.email || 'Email not added'}</span><span>{profile?.phone || user?.phone || 'Phone not added'}</span></div>
            
            {profile?.bio && <p className="text-slate-700 dark:text-slate-300 mb-6 text-sm">{profile.bio}</p>}

            <button 
              onClick={() => setIsEditing(!isEditing)}
              className="w-full btn-secondary flex items-center justify-center gap-2 mb-6 shadow-sm"
            >
              {isEditing ? <><FiCheck /> View Profile</> : <><FiEdit2 /> Edit Profile</>}
            </button>

            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
              {profile?.branch && (
                <div className="flex items-center gap-3">
                  <FiBook className="text-primary dark:text-indigo-400" />
                  <span>{profile.branch}</span>
                </div>
              )}
              {profile?.academic_details && (
                <div className="flex items-center gap-3">
                  <FiBriefcase className="text-primary dark:text-indigo-400" />
                  <span>{profile.academic_details}</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <FiMapPin className="text-primary dark:text-indigo-400" />
                <span>VIT Vellore campus</span>
              </div>
            </div>

            <hr className="my-6 border-slate-200 dark:border-slate-700" />

            {/* Tags / Badges */}
            <div className="mb-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Skills & Hobbies</h3>
              <div className="flex flex-wrap gap-2">
                {profile?.skills?.split(',').map((s, i) => (
                  <span key={i} className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-md text-xs font-medium border border-indigo-100 dark:border-indigo-800/50">
                    {s.trim()}
                  </span>
                ))}
                {profile?.interests?.split(',').map((s, i) => (
                  <span key={`int_${i}`} className="px-2 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-md text-xs font-medium border border-emerald-100 dark:border-emerald-800/50">
                    {s.trim()}
                  </span>
                ))}
              </div>
            </div>
            
          </div>
        </div>

        {/* RIGHT MAIN CONTENT */}
        <div className="w-full md:w-2/3 lg:w-3/4">
          
          {/* TABS Navigation */}
          {!isEditing && (
            <div className="flex border-b border-slate-200 dark:border-slate-700 mb-6 overflow-x-auto hide-scrollbar">
              <button onClick={() => setActiveTab('overview')} className={`pb-4 px-4 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'overview' ? 'border-b-2 border-primary text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                Overview
              </button>
              <button onClick={() => setActiveTab('rooms')} className={`pb-4 px-4 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'rooms' ? 'border-b-2 border-primary text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                My Rooms
              </button>
              <button onClick={() => setActiveTab('preferences')} className={`pb-4 px-4 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'preferences' ? 'border-b-2 border-primary text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                Living Preferences
              </button>
            </div>
          )}

          {isEditing ? (
            <div className="glass-panel p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Edit Profile</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b border-slate-100 dark:border-slate-700 pb-2">Basic Info</h3>
                  <div>
                    <label className="block text-sm font-medium mb-1">Bio</label>
                    <textarea className="input-field min-h-[100px]" value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} placeholder="Write a short summary about yourself..."></textarea>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Skills (comma separated)</label>
                      <input type="text" className="input-field" value={formData.skills} onChange={e => setFormData({...formData, skills: e.target.value})} placeholder="React, Python, Design..."/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Interests (comma separated)</label>
                      <input type="text" className="input-field" value={formData.interests} onChange={e => setFormData({...formData, interests: e.target.value})} placeholder="Gaming, Music, Reading..."/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Academic Status</label>
                      <input type="text" className="input-field" value={formData.academic_details} onChange={e => setFormData({...formData, academic_details: e.target.value})} placeholder="B.Tech 3rd Year..."/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Language</label>
                      <input type="text" className="input-field" value={formData.language} onChange={e => setFormData({...formData, language: e.target.value})} required />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-6">
                  <h3 className="text-lg font-semibold border-b border-slate-100 dark:border-slate-700 pb-2">Roommate Preferences</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-1">Branch</label>
                      <CustomSelect id="profile-branch" ariaLabel="Academic branch" value={formData.branch} onChange={(value) => setFormData((prev) => ({ ...prev, branch: value }))} options={[
                        { value: 'Computer Science', label: 'Computer Science' },
                        { value: 'Electronics', label: 'Electronics' },
                        { value: 'Mechanical', label: 'Mechanical' },
                        { value: 'Civil', label: 'Civil' }
                      ]} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Sleep Preference</label>
                      <CustomSelect id="profile-sleep" ariaLabel="Sleep preference" value={formData.sleep_pref} onChange={(value) => setFormData((prev) => ({ ...prev, sleep_pref: value }))} options={[
                        { value: 'Early Bird', label: 'Early Bird' },
                        { value: 'Night Owl', label: 'Night Owl' },
                        { value: 'Flexible', label: 'Flexible' }
                      ]} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Study Preference</label>
                      <CustomSelect id="profile-study" ariaLabel="Study preference" value={formData.study_pref} onChange={(value) => setFormData((prev) => ({ ...prev, study_pref: value }))} options={[
                        { value: 'Total Silence', label: 'Total Silence' },
                        { value: 'Background Music', label: 'Background Music' },
                        { value: 'Group Study', label: 'Group Study' }
                      ]} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Food Preference</label>
                      <CustomSelect id="profile-food" ariaLabel="Food preference" value={formData.food_pref} onChange={(value) => setFormData((prev) => ({ ...prev, food_pref: value }))} options={[
                        { value: 'Vegetarian', label: 'Vegetarian' },
                        { value: 'Non-Vegetarian', label: 'Non-Vegetarian' },
                        { value: 'Vegan', label: 'Vegan' },
                        { value: 'Any', label: 'Any' }
                      ]} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Cleanliness</label>
                      <CustomSelect id="profile-cleanliness" ariaLabel="Cleanliness preference" value={formData.cleanliness} onChange={(value) => setFormData((prev) => ({ ...prev, cleanliness: value }))} options={[
                        { value: 'Neat Freak', label: 'Neat Freak' },
                        { value: 'Moderate', label: 'Moderate' },
                        { value: 'Messy', label: 'Messy' }
                      ]} />
                    </div>
                    <div>
                       <label className="block text-sm font-medium mb-1">Bed Preference</label>
                       <CustomSelect id="profile-bed" ariaLabel="Bed preference" value={formData.bed_pref} onChange={(value) => setFormData((prev) => ({ ...prev, bed_pref: value }))} options={[
                         { value: 'lower', label: 'Lower' },
                         { value: 'upper', label: 'Upper' }
                       ]} />
                    </div>
                  </div>
                </div>

                <section className="space-y-4 pt-6">
                  <div><h3 className="text-lg font-semibold border-b border-slate-100 dark:border-slate-700 pb-2">My custom living preferences</h3><p className="text-sm text-slate-500 mt-2">Add answers to room-specific questions. Matching answers can improve your compatibility score.</p></div>
                  {customPrefRows.map((item, index) => (
                    <div className="profile-custom-pref-row" key={index}>
                      <label><span>Preference name</span><input className="input-field" maxLength={40} value={item.key} placeholder="e.g. Quiet hours" onChange={(event) => setCustomPrefRows((rows) => rows.map((row, i) => i === index ? { ...row, key: event.target.value } : row))} /></label>
                      <label><span>My answer</span><input className="input-field" maxLength={100} value={item.value} placeholder="e.g. Quiet after 11 PM" onChange={(event) => setCustomPrefRows((rows) => rows.map((row, i) => i === index ? { ...row, value: event.target.value } : row))} /></label>
                      {customPrefRows.length > 1 && <button type="button" className="profile-remove-pref" onClick={() => setCustomPrefRows((rows) => rows.filter((_, i) => i !== index))} aria-label="Remove preference">×</button>}
                    </div>
                  ))}
                  {customPrefRows.length < 12 && <button type="button" className="profile-add-pref" onClick={() => setCustomPrefRows((rows) => [...rows, { key: '', value: '' }])}>+ Add another preference</button>}
                </section>

                <div className="flex gap-4 pt-4">
                  <button type="submit" className="btn-primary flex-1">Save Changes</button>
                  <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary">Cancel</button>
                </div>
              </form>
            </div>
          ) : (
            <div className="animate-in fade-in duration-500">
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="glass-panel p-6 border-t-4 border-t-primary">
                     <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><FiHeart className="text-primary"/> About Me</h3>
                     {profile?.bio ? (
                       <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm">{profile.bio}</p>
                     ) : (
                       <p className="text-slate-400 italic text-sm">No bio provided yet.</p>
                     )}
                   </div>
                   
                   <div className="glass-panel p-6 border-t-4 border-t-accent">
                     <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><FiSettings className="text-accent"/> Setup Focus</h3>
                     <div className="space-y-3">
                        <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                          <span className="text-sm font-medium">Study Vibe</span>
                          <span className="text-sm font-bold text-accent">{profile?.study_pref || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                          <span className="text-sm font-medium">Circadian Rhythm</span>
                          <span className="text-sm font-bold text-accent">{profile?.sleep_pref || 'N/A'}</span>
                        </div>
                     </div>
                   </div>
                </div>
              )}

              {activeTab === 'rooms' && (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-white flex items-center gap-2">
                    🏠 Application History
                  </h3>
                  {applications.length === 0 ? (
                    <div className="glass-panel p-12 text-center text-slate-500">
                      <div className="text-5xl mb-4">📭</div>
                      <p className="text-lg font-medium">You haven't applied to any rooms yet.</p>
                      <button onClick={() => navigate('/find-rooms')} className="mt-4 btn-primary text-sm px-4 py-2">Find Rooms</button>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {applications.map(app => (
                        <div key={app.request_id} className="glass-panel p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-l-4" style={{
                          borderLeftColor: app.status === 'accepted' ? '#10b981' : app.status === 'rejected' ? '#ef4444' : '#f59e0b'
                        }}>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100">Block {app.block}</h4>
                              <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300">
                                {app.room_type}
                              </span>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              Owner: {app.owner_name}
                            </p>
                          </div>
                          
                          <div className="flex sm:flex-col items-center sm:items-end gap-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                              app.status === 'accepted' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                              app.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            }`}>
                              {app.status === 'applied' ? 'Pending' : app.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'preferences' && (
                <div className="glass-panel p-6 grid grid-cols-2 sm:grid-cols-3 gap-6">
                  {['Language', 'Branch', 'Food Preference', 'Cleanliness', 'Bed Preference', 'CGPA Range'].map((label, idx) => {
                    const keys = ['language', 'branch', 'food_pref', 'cleanliness', 'bed_pref', 'cgpa_range'];
                    const val = profile ? profile[keys[idx]] : 'N/A';
                    return (
                      <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-100 dark:border-slate-700">
                        <span className="block text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">{label}</span>
                        <span className="block font-semibold text-slate-800 dark:text-slate-200">{val || 'N/A'}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Profile;
