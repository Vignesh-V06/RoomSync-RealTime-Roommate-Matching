import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiSend, FiArrowLeft } from 'react-icons/fi';
import api from '../api';
import { initSocket } from '../socket';

const RoomChat = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let socket;
    
    const fetchMessages = async () => {
      try {
        const { data } = await api.get(`/chat/${roomId}`);
        setMessages(data);
        
        // Initialize socket and join room
        socket = initSocket(user.id);
        socket.emit('join_room', roomId);
        
        socket.on('receive_message', (msg) => {
          setMessages(prev => [...prev, msg]);
        });
        
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to enter room chat');
      } finally {
        setLoading(false);
      }
    };
    
    fetchMessages();

    return () => {
      if (socket) {
        socket.off('receive_message');
      }
    };
  }, [roomId, user.id]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await api.post(`/chat/${roomId}`, { message: newMessage });
      setNewMessage('');
    } catch (err) {
      console.error(err);
      setError('Failed to send message');
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Connecting to chat...</div>;

  if (error) return (
    <div className="max-w-3xl mx-auto p-6 mt-10">
      <div className="glass-panel text-center p-12">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-4">Access Denied</h2>
        <p className="text-red-500 mb-6">{error}</p>
        <button onClick={() => navigate(-1)} className="btn-secondary flex items-center gap-2 mx-auto">
          <FiArrowLeft /> Go Back
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 h-[calc(100vh-5rem)] flex flex-col">
      <div className="glass-panel flex-1 flex flex-col overflow-hidden">
        
        {/* Chat Header */}
        <div className="p-4 border-b border-white/20 dark:border-slate-700/50 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/80">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
              <FiArrowLeft />
            </button>
            <div>
              <h2 className="font-bold text-slate-800 dark:text-white">Room Chat #{roomId}</h2>
              <p className="text-xs text-primary dark:text-indigo-400 font-medium">Room members can coordinate here</p>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30 dark:bg-slate-900/10">
          {messages.length === 0 ? (
            <div className="text-center text-slate-400 mt-10">
              No messages yet. Be the first to say hello! 👋
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMine = msg.sender_id === user.id;
              return (
                <div key={idx} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                  <span className="text-xs text-slate-400 mb-1 ml-1 mr-1">{isMine ? 'You' : msg.sender_name}</span>
                  <div className={`max-w-[75%] rounded-2xl px-5 py-3 ${
                    isMine 
                    ? 'bg-gradient-to-br from-primary to-indigo-600 text-white rounded-br-none shadow-md shadow-indigo-500/20' 
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-none shadow-sm border border-slate-100 dark:border-slate-700'
                  }`}>
                    <p className="text-sm">{msg.message}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="p-4 bg-white/50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700">
          <form onSubmit={handleSend} className="flex items-center gap-3">
            <input 
              type="text" 
              className="flex-1 input-field bg-white dark:bg-slate-900 shadow-inner" 
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
            />
            <button 
              type="submit" 
              disabled={!newMessage.trim()}
              className="p-3 bg-gradient-to-r from-primary to-indigo-500 text-white rounded-full shadow-lg hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5 active:scale-95"
            >
              <FiSend />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default RoomChat;
