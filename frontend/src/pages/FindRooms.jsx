import { useState, useEffect } from 'react';
import api from '../api';

const FindRooms = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applyMessage, setApplyMessage] = useState({ id: null, msg: '', type: '' });
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const { data } = await api.get(`/rooms/vacant/${user.id}`);
        setRooms(data);
      } catch (err) {
        console.error('FindRooms fetch error:', err);
        const msg = err.response?.data?.message || err.message || 'Failed to load rooms. Please make sure you have filled your profile.';
        setError(String(msg));
      } finally {
        setLoading(false);
      }
    };
    fetchRooms();
  }, [user.id]);

  const handleApply = async (roomId) => {
    try {
      await api.post('/rooms/apply', { room_id: roomId });
      setApplyMessage({ id: roomId, msg: 'Application sent!', type: 'success' });
    } catch (err) {
      setApplyMessage({ id: roomId, msg: err.response?.data?.message || 'Failed to apply', type: 'error' });
    }
    setTimeout(() => setApplyMessage({ id: null, msg: '', type: '' }), 3000);
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 50) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-500 bg-red-50';
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Finding the best matches...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="max-w-7xl mx-auto p-6 mt-4">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold bg-gradient-to-r from-primary to-indigo-500 bg-clip-text text-transparent mb-3">Roommate Matches</h1>
        <p className="text-slate-600 max-w-2xl mx-auto">Discover vacant rooms and find your perfect compatible roommate based on your profile preferences.</p>
      </div>

      {rooms.length === 0 ? (
        <div className="text-center p-12 glass-panel">
          <p className="text-slate-500 text-lg">No vacant rooms found at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {rooms.map((room) => (
            <div key={room.room_id} className="glass-panel overflow-hidden flex flex-col hover:shadow-2xl transition-shadow duration-300">
              <div className="p-6 flex-grow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{room.block}</h2>
                    <p className="text-sm font-medium text-primary dark:text-indigo-400">{room.room_type}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-bold flex items-center ${getScoreColor(room.compatibility_score)}`}>
                    {room.compatibility_score}% Match
                  </div>
                </div>
                
                <div className="mb-6">
                  <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                    <span>Compatibility</span>
                    <span>100%</span>
                  </div>
                  <div className="progress-bar-bg">
                     <div 
                        className="progress-bar-fill" 
                        style={{ width: `${room.compatibility_score}%`, backgroundImage: room.compatibility_score >= 80 ? 'linear-gradient(to right, #4ade80, #10b981)' : room.compatibility_score >= 50 ? 'linear-gradient(to right, #facc15, #eab308)' : 'linear-gradient(to right, #f87171, #ef4444)' }}
                     ></div>
                  </div>
                </div>

                {room.compatibility_matches && room.compatibility_matches.length > 0 && (
                  <div className="mb-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Matched On</p>
                    <div className="flex flex-wrap gap-2">
                      {room.compatibility_matches.map((match, idx) => (
                        <span key={idx} className="bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-300 text-xs font-semibold px-2 py-1 rounded-md">
                          ✓ {match}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400 mb-4">
                  <p><span className="font-semibold text-slate-700 dark:text-slate-300">Owner:</span> {room.owner_name}</p>
                  <p><span className="font-semibold text-slate-700 dark:text-slate-300">Occupancy:</span> <span className="text-primary dark:text-indigo-400 font-medium">{room.current_occupancy}</span> / {room.total_capacity}</p>
                  {room.additional_requirements && (
                    <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/80 rounded text-xs italic border border-slate-100 dark:border-slate-700">
                      "{room.additional_requirements}"
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-4 bg-slate-50/50 border-t border-slate-100">
                {applyMessage.id === room.room_id ? (
                  <div className={`w-full py-2 px-4 rounded font-medium text-center text-sm ${applyMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {applyMessage.msg}
                  </div>
                ) : (
                  <button 
                    onClick={() => handleApply(room.room_id)}
                    className="btn-primary w-full py-2.5 shadow-none"
                  >
                    Apply for Room
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FindRooms;
