import { Fragment, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiArrowLeft, FiArrowRight, FiCamera, FiMail, FiMessageCircle, FiMessageSquare,
  FiPhone, FiSend, FiSmile, FiUser, FiX
} from 'react-icons/fi';
import api from '../api';
import RoomSyncLoader from '../components/RoomSyncLoader';
import useRoomSyncLoader from '../hooks/useRoomSyncLoader';
import { initSocket } from '../socket';
import toast from 'react-hot-toast';

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

const CHAT_EMOJIS = [
  '😀', '😃', '😄', '😁', '😊', '😍', '🥰', '😘',
  '😂', '🤣', '🙂', '😉', '😎', '🤔', '🙌', '👏',
  '👍', '👎', '🙏', '❤️', '🔥', '🎉', '✨', '💯',
  '😭', '🥹', '😴', '🤝', '👀', '💙', '☕', '🏠'
];

const getMessageDayKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].join('-');
};

const formatMessageDay = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (getMessageDayKey(date) === getMessageDayKey(today)) return 'Today';
  if (getMessageDayKey(date) === getMessageDayKey(yesterday)) return 'Yesterday';
  return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatMessageTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const ChatDashboard = () => {
  const navigate = useNavigate();
  const user = getStoredUser();
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const showInitialLoader = useRoomSyncLoader(loading);
  const [roomsError, setRoomsError] = useState('');
  const [messagesError, setMessagesError] = useState('');
  const [sending, setSending] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const activeRoomRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [roomDetails, setRoomDetails] = useState(null);
  const [roomPanelOpen, setRoomPanelOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
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
          setSocket(socket);
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
    setRoomDetails(null);
    setRoomPanelOpen(false);
    setSelectedMember(null);

    const fetchRoomDetails = async () => {
      try {
        const { data } = await api.get('/rooms/' + activeRoom.room_id + '/details');
        if (active) setRoomDetails(data);
      } catch (err) {
        if (active) setMessagesError(err.response?.data?.message || 'Room details could not be loaded.');
      }
    };

    const fetchMessages = async () => {
      try {
        const { data } = await api.get('/chat/' + activeRoom.room_id);
        if (active) setMessages(Array.isArray(data) ? data : []);
      } catch (err) {
        if (active) setMessagesError(err.response?.data?.message || 'Messages could not be loaded.');
      }
    };

    fetchMessages();
    fetchRoomDetails();
    return () => { active = false; };
  }, [activeRoom]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleReceiveMessage = (message) => {
      if (activeRoomRef.current && String(message.room_id) === String(activeRoomRef.current.room_id)) {
        setMessages((previous) => {
          if (previous.some((item) => String(item.id) === String(message.id))) return previous;

          if (String(message.sender_id) === String(user?.id)) {
            const pendingIndex = previous.findIndex((item) =>
              item.pending
              && String(item.room_id) === String(message.room_id)
              && item.message === message.message
            );
            if (pendingIndex >= 0) {
              return previous.map((item, index) => index === pendingIndex ? { ...message, pending: false } : item);
            }
          }

          return [...previous, message];
        });
      }

      setRooms((previous) => {
        const index = previous.findIndex((room) => String(room.room_id) === String(message.room_id));
        if (index <= 0) return previous;
        const next = [...previous];
        const [latest] = next.splice(index, 1);
        return [latest, ...next];
      });
    };

    const handleRoomMembershipRemoved = ({ room_id: removedRoomId }) => {
      if (!removedRoomId) return;
      setRooms((previous) => previous.filter((room) => String(room.room_id) !== String(removedRoomId)));

      if (String(activeRoomRef.current?.room_id) === String(removedRoomId)) {
        activeRoomRef.current = null;
        setActiveRoom(null);
        setMessages([]);
        setRoomDetails(null);
        setMobileChatOpen(false);
      }
      toast.error('The room owner removed your membership. Your room chat access has ended.');
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('room_membership_removed', handleRoomMembershipRemoved);
    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('room_membership_removed', handleRoomMembershipRemoved);
    };
  }, [socket, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const selectRoom = (room) => {
    setActiveRoom(room);
    setMobileChatOpen(true);
  };

  const openMember = (memberId) => {
    const member = (roomDetails?.members || []).find((item) => String(item.id) === String(memberId));
    if (member) {
      setSelectedMember(member);
      setRoomPanelOpen(true);
    }
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !activeRoom) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoError('Choose a JPG, PNG or WebP image.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setPhotoError('Each photo must be smaller than 4 MB.');
      return;
    }
    setUploadingPhoto(true);
    setPhotoError('');
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('The selected photo could not be read.'));
        reader.readAsDataURL(file);
      });
      await api.post('/rooms/' + activeRoom.room_id + '/images', {
        original_name: file.name,
        mime_type: file.type,
        data_base64: dataUrl
      });
      const { data } = await api.get('/rooms/' + activeRoom.room_id + '/details');
      setRoomDetails(data);
    } catch (err) {
      setPhotoError(err.response?.data?.message || err.message || 'Photo upload failed.');
    } finally {
      setUploadingPhoto(false);
    }
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

  if (showInitialLoader) return <RoomSyncLoader label="Loading your conversations…" />;

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
                      <small>Room {room.room_number || 'number not set'}</small>
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
                <button type="button" className="chat-room-title-button" onClick={() => { setSelectedMember(null); setRoomPanelOpen(true); }}>
                  <h2>{activeRoom.block || 'Room conversation'}</h2><p>Room {activeRoom.room_number || 'number not set'} · {activeRoom.room_type} · Room details</p>
                </button>
              </header>

              <div className="chat-message-list">
                {messagesError && <div className="chat-inline-error" role="status">{messagesError}</div>}
                {messages.length === 0 ? (
                  <div className="chat-first-message"><FiMessageCircle /><strong>Start the conversation</strong><span>Say hello and get to know the people you may be sharing with.</span></div>
                ) : (
                  messages.map((message, index) => {
                    const mine = String(message.sender_id) === String(user.id);
                    const previousMessage = messages[index - 1];
                    const showDateDivider = !previousMessage
                      || getMessageDayKey(previousMessage.created_at) !== getMessageDayKey(message.created_at);
                    return (
                      <Fragment key={message.id}>
                        {showDateDivider && (
                          <div className="chat-date-divider"><span>{formatMessageDay(message.created_at)}</span></div>
                        )}
                        <div className={'chat-message-row' + (mine ? ' chat-message-mine' : '')}>
                        {!mine && <button type="button" className="chat-message-sender chat-member-trigger" onClick={() => openMember(message.sender_id)}>{message.sender_name || 'Room member'}</button>}
                        <div className={'chat-message-bubble' + (mine ? ' chat-message-bubble-mine' : '')}>
                          <p>{message.message}</p>
                        </div>
                        <span className="chat-message-time">
                          <time dateTime={new Date(message.created_at).toISOString()}>{formatMessageTime(message.created_at)}</time>
                          {message.pending ? ' · Sending' : ''}
                        </span>
                        </div>
                      </Fragment>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <form className="chat-composer" onSubmit={handleSend}>
                <div className="chat-emoji-wrap">
                  <button
                    type="button"
                    className="chat-emoji-toggle"
                    aria-label={emojiPickerOpen ? 'Close emoji picker' : 'Open emoji picker'}
                    aria-expanded={emojiPickerOpen}
                    onClick={() => setEmojiPickerOpen((open) => !open)}
                  >
                    <FiSmile />
                  </button>
                  {emojiPickerOpen && (
                    <div className="chat-emoji-picker" role="group" aria-label="Choose an emoji">
                      <div className="chat-emoji-grid">
                        {CHAT_EMOJIS.map((emoji) => (
                          <button
                            type="button"
                            key={emoji}
                            className="chat-emoji-option"
                            aria-label={`Insert ${emoji}`}
                            onClick={() => {
                              setNewMessage((current) => current + emoji);
                              setEmojiPickerOpen(false);
                            }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
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
                  <FiSend /><span className="chat-send-label">Send</span>
                </button>
              </form>
            </>
          )}
        </section>

        {roomPanelOpen && activeRoom && (
          <div className="chat-detail-backdrop" role="presentation" onClick={() => { setRoomPanelOpen(false); setSelectedMember(null); }}>
            <aside className="chat-detail-panel" role="dialog" aria-modal="true" aria-label={selectedMember ? 'Room member details' : 'Room details'} onClick={(event) => event.stopPropagation()}>
              <header className="chat-detail-header">
                <div><span className="section-kicker">{selectedMember ? 'ROOM MEMBER' : 'ROOM INFORMATION'}</span><h2>{selectedMember ? selectedMember.name : (roomDetails?.room?.block || activeRoom.block)}</h2></div>
                <button type="button" className="chat-detail-close" aria-label="Close details" onClick={() => { setRoomPanelOpen(false); setSelectedMember(null); }}><FiX /></button>
              </header>
              {selectedMember ? (
                <div className="chat-member-card">
                  <div className="chat-member-avatar"><FiUser /></div>
                  <h3>{selectedMember.name}</h3>
                  <p className="chat-member-username">{Number(selectedMember.is_owner) === 1 ? 'Room owner' : '@' + (selectedMember.username || 'username unavailable')}</p>
                  <div className="chat-member-detail"><FiMail /><span>{selectedMember.email || 'Email not available'}</span></div>
                  <div className="chat-member-detail"><FiPhone /><span>{selectedMember.phone || 'Phone number not added'}</span></div>
                  <button type="button" className="chat-detail-back-button" onClick={() => setSelectedMember(null)}>Back to room details</button>
                </div>
              ) : (
                <div className="chat-room-details-body">
                  {roomDetails?.room ? (
                    <>
                      <div className="chat-room-detail-grid">
                        <div><span>Hostel block</span><strong>{roomDetails.room.block}</strong></div>
                        <div><span>Room number</span><strong>{roomDetails.room.room_number || 'Not set'}</strong></div>
                        <div><span>Sharing type</span><strong>{roomDetails.room.room_type}</strong></div>
                        <div><span>Bed type</span><strong>{roomDetails.room.bed_type || 'Not specified'}</strong></div>
                        <div><span>Occupancy</span><strong>{roomDetails.room.current_occupancy} / {roomDetails.room.total_capacity}</strong></div>
                        <div><span>Listing status</span><strong>{roomDetails.room.status}</strong></div>
                        <div><span>Room owner</span><strong>{roomDetails.room.owner_name}</strong></div>
                      </div>
                      {roomDetails.room.additional_requirements && <div className="chat-room-notes"><span>Room notes</span><p>{roomDetails.room.additional_requirements}</p></div>}
                      {(roomDetails.room.custom_options || []).length > 0 && (
                        <div className="chat-room-custom-list"><span>Room preferences</span>
                          {roomDetails.room.custom_options.map((item) => <div key={item.key}><strong>{item.label}</strong><small>{item.value}</small></div>)}
                        </div>
                      )}
                      <section className="chat-room-gallery-section">
                        <div className="chat-detail-section-heading"><h3>Room photos</h3><span>{(roomDetails.images || []).length}/5</span></div>
                        {(roomDetails.images || []).length > 0 ? (
                          <div className="chat-room-gallery">
                            {roomDetails.images.map((photo) => <img key={photo.id} src={(api.defaults.baseURL || '/api') + '/rooms/' + activeRoom.room_id + '/images/' + photo.id} alt={photo.original_name || 'Room interior'} loading="lazy" />)}
                          </div>
                        ) : <p className="chat-room-gallery-empty">The owner has not added room photos yet.</p>}
                        {String(roomDetails.room.owner_id) === String(user.id) && (roomDetails.images || []).length < 5 && (
                          <label className="chat-upload-photo-button">
                            <FiCamera /> {uploadingPhoto ? 'Uploading photo…' : 'Upload room photo'}
                            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
                          </label>
                        )}
                        {photoError && <p className="chat-inline-error" role="alert">{photoError}</p>}
                      </section>
                      <section className="chat-room-members-section">
                        <div className="chat-detail-section-heading"><h3>Room members</h3><span>{(roomDetails.members || []).length}</span></div>
                        {(roomDetails.members || []).map((member) => (
                          <button type="button" className="chat-detail-member-row" key={member.id} onClick={() => setSelectedMember(member)}>
                            <span className="chat-detail-member-avatar">{(member.name || 'U').charAt(0).toUpperCase()}</span>
                            <span><strong>{member.name}</strong><small>{Number(member.is_owner) === 1 ? 'Room owner' : '@' + (member.username || 'member')}</small></span>
                            <FiArrowRight />
                          </button>
                        ))}
                      </section>
                    </>
                  ) : <p className="chat-sidebar-state">Loading room details…</p>}
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatDashboard;
