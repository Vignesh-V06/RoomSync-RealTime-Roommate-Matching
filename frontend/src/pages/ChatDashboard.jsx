import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiArrowLeft, FiArrowRight, FiMessageCircle, FiMessageSquare,
  FiSend, FiUsers
} from 'react-icons/fi';
import api from '../api';
import { initSocket } from '../socket';

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

const ChatDashboard = () => {
  const navigate = useNavigate();
  const user = getStoredUser();
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [roomsError, setRoomsError] = useState('');
  const [messagesError, setMessagesError] = useState('');
  const [sending, setSending] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const activeRoomRef = useRef(null);
  const socketRef = useRef(null);
  const sendLockRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const fetchRooms = async () => {
      setLoading(true);
      setRoomsError('');
      try {
        const { data } = await api.get('/rooms/my-groups');
        if (!mounted) return;
        const safeRooms = Array.isArray(data) ? data : [];
        setRooms(safeRooms);

        if (user?.id) {
          const socket = initSocket(user.id);
          socketRef.current = socket;
          safeRooms.forEach((room) => socket.emit('join_room', room.room_id));
        }
      } catch (err) {
        if (mounted) setRoomsError(err.response?.data?.message || 'Your conversations could not be loaded.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (user?.id) fetchRooms();
    else {
      setRoomsError('Your session could not be read. Please sign in again.');
      setLoading(false);
    }

    return () => { mounted = false; };
  }, [user?.id]);

  useEffect(() => {
    activeRoomRef.current = activeRoom;
    if (!activeRoom) {
      setMessages([]);
      return undefined;
    }

    let active = true;
    setMessages([]);
    setMessagesError('');

    const fetchMessages = async () => {
      try {
        const { data } = await api.get('/chat/' + activeRoom.room_id);
        if (active) setMessages(Array.isArray(data) ? data : []);
      } catch (err) {
        if (active) setMessagesError(err.response?.data?.message || 'Messages could not be loaded.');
      }
    };

    fetchMessages();
    return () => { active = false; };
  }, [activeRoom]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return undefined;

    const handleReceiveMessage = (message) => {
      if (activeRoomRef.current && String(message.room_id) === String(activeRoomRef.current.room_id)) {
        setMessages((previous) => (
          previous.some((item) => String(item.id) === String(message.id))
            ? previous
            : [...previous, message]
        ));
      }

      setRooms((previous) => {
        const index = previous.findIndex((room) => String(room.room_id) === String(message.room_id));
        if (index <= 0) return previous;
        const next = [...previous];
        const [latest] = next.splice(index, 1);
        return [latest, ...next];
      });
    };

    socket.on('receive_message', handleReceiveMessage);
    return () => socket.off('receive_message', handleReceiveMessage);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const selectRoom = (room) => {
    setActiveRoom(room);
    setMobileChatOpen(true);
  };

  const handleSend = async (event) => {
    event.preventDefault();
    const content = newMessage.trim();
    if (!content || !activeRoom || sendLockRef.current) return;

    sendLockRef.current = true;
    setSending(true);
    setMessagesError('');
    setNewMessage('');

    const temporaryId = 'pending-' + Date.now();
    const optimisticMessage = {
      id: temporaryId,
      room_id: activeRoom.room_id,
      sender_id: user.id,
      sender_name: user.name || 'You',
      message: content,
      created_at: new Date().toISOString(),
      pending: true
    };
    setMessages((previous) => [...previous, optimisticMessage]);

    try {
      const { data } = await api.post('/chat/' + activeRoom.room_id, { message: content });
      setMessages((previous) => previous.map((item) => (
        item.id === temporaryId ? { ...data, pending: false } : item
      )));
      setRooms((previous) => {
        const index = previous.findIndex((room) => String(room.room_id) === String(activeRoom.room_id));
        if (index <= 0) return previous;
        const next = [...previous];
        const [latest] = next.splice(index, 1);
        return [latest, ...next];
      });
    } catch (err) {
      setMessages((previous) => previous.filter((item) => item.id !== temporaryId));
      setNewMessage(content);
      setMessagesError(err.response?.data?.message || 'Message not sent. Your text is back in the composer.');
    } finally {
      sendLockRef.current = false;
      setSending(false);
    }
  };

  if (loading) {
    return <div className="chat-page"><div className="chat-loading">Loading your conversations…</div></div>;
  }

  return (
    <div className="chat-page">
      <div className={'chat-shell' + (mobileChatOpen ? ' chat-mobile-open' : '')}>
        <aside className="chat-sidebar">
          <div className="chat-sidebar-header">
            <div><span className="section-kicker">ROOMSYNC MESSAGES</span><h1>Your conversations</h1><p>Chats for rooms you own or have joined.</p></div>
            <span className="chat-count">{rooms.length}</span>
          </div>

          {roomsError ? (
            <div className="chat-sidebar-state">
              <p>{roomsError}</p>
              <button type="button" className="chat-small-action" onClick={() => window.location.reload()}>Reload</button>
            </div>
          ) : rooms.length === 0 ? (
            <div className="chat-sidebar-empty">
              <FiMessageCircle />
              <h2>No conversations yet</h2>
              <p>Once an application is accepted, the room conversation will appear here.</p>
              <button type="button" onClick={() => navigate('/find-rooms')}>Find rooms <FiArrowRight /></button>
            </div>
          ) : (
            <div className="chat-room-list">
              {rooms.map((room) => {
                const active = String(activeRoom?.room_id) === String(room.room_id);
                return (
                  <button
                    type="button"
                    className={'chat-room-item' + (active ? ' chat-room-item-active' : '')}
                    key={room.room_id}
                    onClick={() => selectRoom(room)}
                    aria-pressed={active}
                  >
                    <span className="chat-room-avatar">{(room.block || 'R').charAt(0).toUpperCase()}</span>
                    <span className="chat-room-item-copy">
                      <strong>{room.block || 'Room conversation'}</strong>
                      <small>{room.owner_id === user.id ? 'Your room' : 'Hosted by ' + (room.owner_name || 'room owner')}</small>
                    </span>
                    <span className="chat-room-type">{room.room_type}</span>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <section className="chat-conversation">
          {!activeRoom ? (
            <div className="chat-conversation-empty">
              <span className="chat-empty-icon"><FiMessageSquare /></span>
              <h2>Choose a conversation</h2>
              <p>Select a room on the left to view messages and continue the conversation.</p>
            </div>
          ) : (
            <>
              <header className="chat-conversation-header">
                <button type="button" className="chat-mobile-back" onClick={() => setMobileChatOpen(false)} aria-label="Back to conversations"><FiArrowLeft /></button>
                <span className="chat-room-avatar">{(activeRoom.block || 'R').charAt(0).toUpperCase()}</span>
                <div><h2>{activeRoom.block || 'Room conversation'}</h2><p>{activeRoom.room_type} · Room members</p></div>
              </header>

              <div className="chat-message-list">
                {messagesError && <div className="chat-inline-error" role="status">{messagesError}</div>}
                {messages.length === 0 ? (
                  <div className="chat-first-message"><FiMessageCircle /><strong>Start the conversation</strong><span>Say hello and get to know the people you may be sharing with.</span></div>
                ) : (
                  messages.map((message) => {
                    const mine = String(message.sender_id) === String(user.id);
                    return (
                      <div className={'chat-message-row' + (mine ? ' chat-message-mine' : '')} key={message.id}>
                        {!mine && <span className="chat-message-sender">{message.sender_name || 'Room member'}</span>}
                        <div className={'chat-message-bubble' + (mine ? ' chat-message-bubble-mine' : '')}>
                          <p>{message.message}</p>
                        </div>
                        <span className="chat-message-time">
                          {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {message.pending ? ' · Sending' : ''}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <form className="chat-composer" onSubmit={handleSend}>
                <input
                  type="text"
                  aria-label="Write a message"
                  value={newMessage}
                  onChange={(event) => setNewMessage(event.target.value)}
                  placeholder="Write a message…"
                  maxLength={2000}
                  disabled={sending}
                />
                <button type="submit" disabled={!newMessage.trim() || sending} aria-label="Send message">
                  <FiSend />
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default ChatDashboard;
