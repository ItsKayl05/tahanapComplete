
import React, { useEffect, useRef, useState, useContext } from 'react';
import { useSocket } from '../../context/SocketContext';
import { AuthContext } from '../../context/AuthContext';
import { buildUpload } from '../../services/apiConfig';
import axios from 'axios';
import './ChatBox.css';

// Helper to get token from localStorage
function getAuthToken() {
  return localStorage.getItem('user_token');
}

// Robust id extractor: handles string ids, mongoose ObjectId, or populated objects { _id }
function extractId(val) {
  if (!val && val !== 0) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    if (val._id) return String(val._id);
    if (val.id) return String(val.id);
    try { return String(val.toString()); } catch (e) { return ''; }
  }
  return String(val);
}

// Normalize ID string for comparisons: trim whitespace and strip surrounding quotes
function normalizeIdStr(val) {
  const s = extractId(val || '');
  return s.replace(/^['"]|['"]$/g, '').trim();
}

const SOCKET_URL = 'http://localhost:4000';

const ChatBox = ({ currentUserId: rawCurrentUserId, targetUserId: rawTargetUserId, targetUserName, targetUserAvatar, large }) => {
  // normalize ids to strings (raw sources)
  const currentUserIdRaw = rawCurrentUserId ? String(rawCurrentUserId) : (localStorage.getItem('user_id') || '');
  const targetUserIdRaw = rawTargetUserId ? String(rawTargetUserId) : '';

    // Try to derive a reliable current user id: prefer passed prop, then localStorage, then decode JWT token if available
    const token = getAuthToken();
    let tokenUserId = '';
    // lightweight JWT parser (no external dependency). Works in browser.
    function parseJwtPayload(t) {
      try {
        const parts = t.split('.');
        if (!parts[1]) return null;
        const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        // decode base64
        const json = decodeURIComponent(atob(b64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(json);
      } catch (e) {
        return null;
      }
    }
    if (token) {
      const decoded = parseJwtPayload(token);
      if (decoded) {
        tokenUserId = decoded && (decoded.id || decoded.userId || decoded._id || decoded.sub) ? String(decoded.id || decoded.userId || decoded._id || decoded.sub) : '';
      }
    }

  // final raw ids
  const currentUserId = currentUserIdRaw || tokenUserId || '';
  const targetUserId = targetUserIdRaw || '';

  // normalized ids used across the component
  const targetUserIdNorm = normalizeIdStr(targetUserId);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef();

  // Prefer currentUser from AuthContext but fall back to localStorage heuristics
  const { currentUser } = useContext(AuthContext) || {};
  // prefer the authoritative id from currentUser if available
  const currentUserAuthId = currentUser && (currentUser.id || currentUser._id || currentUser._userId) ? String(currentUser.id || currentUser._id || currentUser._userId) : '';
  const currentUserIdNorm = normalizeIdStr(currentUserAuthId || currentUserId);
  const roomId = [currentUserIdNorm, targetUserIdNorm].filter(Boolean).sort().join('-');
  const { socket } = useSocket() || {};
  // track rooms we've warned about (same current & target) to avoid spamming console
  const warnedSameIdRoomsRef = useRef(new Set());
  // track rooms we've already asked the socket to join to avoid duplicate emits
  const joinedRoomsRef = useRef(new Set());
  const deriveAvatarFromLocal = () => {
    try {
      // try current_user cached by AuthContext
      const raw = localStorage.getItem('current_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.profilePic) return parsed.profilePic.startsWith('http') ? parsed.profilePic : buildUpload(`/profiles/${parsed.profilePic}`);
      }
    } catch (e) {}
    try {
      const keys = ['user_profile', 'user', 'profile', 'user_profilePic', 'profilePic'];
      for (const k of keys) {
        const v = localStorage.getItem(k);
        if (!v) continue;
        try {
          const parsed = JSON.parse(v);
          if (parsed && (parsed.profilePic || parsed.profile_pic || parsed.avatar)) {
            const p = parsed.profilePic || parsed.profile_pic || parsed.avatar;
            return p.startsWith('http') ? p : buildUpload(`/profiles/${p}`);
          }
        } catch (e) {
          // treat as plain filename/url
          return v.startsWith('http') ? v : buildUpload(`/profiles/${v}`);
        }
      }
    } catch (e) {}
    return null;
  };
  const ctxPic = currentUser && currentUser.profilePic ? (currentUser.profilePic.startsWith('http') ? currentUser.profilePic : buildUpload(`/profiles/${currentUser.profilePic}`)) : null;
  const derived = ctxPic || deriveAvatarFromLocal() || '/default-avatar.png';
  const currentUserAvatar = derived;

  // Local cache helpers (per-room)
  const cacheKey = roomId ? `chat:${roomId}` : null;
  const loadCache = (key) => {
    try {
      if (!key) return null;
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      // Normalize cached messages to ensure consistent shape and include senderAvatar when available
      return parsed.map(m => {
        const sid = normalizeIdStr(m.senderId || m.sender || '');
        const rawAvatar = m.senderAvatar || m.senderProfilePic || (m.sender && (m.sender.profilePic || m.sender.profile_pic)) || m.profilePic || '';
        let senderAvatar = rawAvatar ? (rawAvatar.startsWith('http') ? rawAvatar : buildUpload(`/profiles/${rawAvatar}`)) : '';
        // derive missing avatars from known participants
        if (!senderAvatar) {
          if (sid && currentUserIdNorm && sid === currentUserIdNorm) senderAvatar = currentUserAvatar;
          else if (sid && targetUserIdNorm && sid === targetUserIdNorm) senderAvatar = (targetUserAvatar && targetUserAvatar.startsWith('http')) ? targetUserAvatar : (targetUserAvatar ? buildUpload(`/profiles/${targetUserAvatar}`) : '');
        }
        return {
          id: m.id || m._id || `${sid}_${String(m.createdAt||m.timestamp||'')}`,
          senderId: sid,
          receiverId: normalizeIdStr(m.receiverId || m.receiver || ''),
          content: m.content || m.message || '',
          createdAt: m.createdAt || m.timestamp || new Date().toISOString(),
          senderAvatar
        };
      });
    } catch (e) {
      return null;
    }
  };
  const saveCache = (key, msgs) => {
    try {
      if (!key) return;
      localStorage.setItem(key, JSON.stringify(msgs || []));
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    if (!roomId) return;
    // Load cached messages first so UI shows history immediately
    const cached = loadCache(cacheKey);
    if (cached && cached.length) {
      setMessages(cached);
    }

    // Fetch chat history with token and update cache
    const token = getAuthToken();
    axios.get(`/api/messages/${targetUserId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(res => {
        const normalized = (res.data || []).map(m => {
          const sIdRaw = m.sender || m.senderId;
          const rIdRaw = m.receiver || m.receiverId;
          const sId = normalizeIdStr(sIdRaw);
          const rId = normalizeIdStr(rIdRaw);
          // normalize possible avatar fields from API
          const rawAvatar = m.senderAvatar || (m.sender && (m.sender.profilePic || m.sender.profile_pic)) || m.profilePic || '';
          let senderAvatar = rawAvatar ? (rawAvatar.startsWith('http') ? rawAvatar : buildUpload(`/profiles/${rawAvatar}`)) : '';
          if (!senderAvatar) {
            if (sId && currentUserIdNorm && sId === currentUserIdNorm) senderAvatar = currentUserAvatar;
            else if (sId && targetUserIdNorm && sId === targetUserIdNorm) senderAvatar = (targetUserAvatar && targetUserAvatar.startsWith('http')) ? targetUserAvatar : (targetUserAvatar ? buildUpload(`/profiles/${targetUserAvatar}`) : '');
          }
          return {
            id: m._id || m.id || `${sId}_${String(m.createdAt||m.timestamp||'')}`,
            senderId: sId,
            receiverId: rId,
            content: m.content || m.message || '',
            createdAt: m.createdAt || m.timestamp || new Date().toISOString(),
            senderAvatar
          };
        });
        // sort by createdAt ascending
        normalized.sort((a,b)=> new Date(a.createdAt) - new Date(b.createdAt));
        setMessages(prev => {
          // only update if data changed length or latest id differs
          const same = prev && prev.length === normalized.length && prev.length>0 && prev[prev.length-1].id === normalized[normalized.length-1].id;
          if (same) return prev;
          saveCache(cacheKey, normalized);
          return normalized;
        });
      })
      .catch(() => {
        // keep cached messages if fetch fails; do not clear
      });
  }, [roomId, targetUserId]);

  useEffect(() => {
    if (!socket) return;
    const s = socket;
    s.on('connect_error', (err) => {
      console.warn('Socket connect_error (chatbox):', err && err.message ? err.message : err);
    });
    s.on('connect_timeout', () => {
      console.warn('Socket connect_timeout (chatbox)');
    });
    s.on('connect', () => {
      try {
        console.info('Socket connected (chatbox)', s.id);
        if (roomId && !joinedRoomsRef.current.has(roomId)) {
          s.emit('joinRoom', { roomId });
          joinedRoomsRef.current.add(roomId);
          console.info('Socket joinRoom emitted for', roomId);
        }
      } catch (e) {
        console.warn('Error during socket connect handler (chatbox)', e);
      }
    });
    s.on('reconnect_attempt', (n) => console.info('Socket reconnect_attempt (chatbox)', n));
    s.on('reconnect_failed', () => console.warn('Socket reconnect_failed (chatbox)'));
    s.on('disconnect', (reason) => {
      console.info('Socket disconnected (chatbox)', reason);
      try { joinedRoomsRef.current.clear(); } catch (e) {}
    });
    const handleReceive = (msg) => {
      if (!msg) return;
      const msgRoom = msg.roomId || [String(msg.sender || ''), String(msg.receiver || '')].filter(Boolean).sort().join('-');
      if (roomId && msgRoom !== roomId) return;
      const sId = normalizeIdStr(msg.sender || msg.senderId);
      const rId = normalizeIdStr(msg.receiver || msg.receiverId);
      let senderAvatar = msg.senderAvatar || '';
      if (!senderAvatar) {
        const rawAvatar2 = (msg.sender && (msg.sender.profilePic || msg.sender.profile_pic)) || msg.profilePic || '';
        if (rawAvatar2) senderAvatar = rawAvatar2.startsWith('http') ? rawAvatar2 : buildUpload(`/profiles/${rawAvatar2}`);
      }
      if (!senderAvatar) {
        if (sId && currentUserIdNorm && sId === currentUserIdNorm) senderAvatar = currentUserAvatar;
        else if (sId && targetUserIdNorm && sId === targetUserIdNorm) senderAvatar = (targetUserAvatar && targetUserAvatar.startsWith('http')) ? targetUserAvatar : (targetUserAvatar ? buildUpload(`/profiles/${targetUserAvatar}`) : '');
      }
      const normalized = {
        id: msg._id || msg.id || `${sId}_${String(msg.createdAt||msg.timestamp||Date.now())}`,
        senderId: sId,
        receiverId: rId,
        content: msg.content || msg.message || '',
        createdAt: msg.createdAt || msg.timestamp || new Date().toISOString(),
        senderAvatar
      };
      try { console.debug('[chat] receiveMessage normalized:', normalized, 'roomId=', roomId, 'currentUserIdNorm=', currentUserIdNorm); } catch(e){}
      setMessages(prev => {
        if (prev.some(p => (p.id && normalized.id && p.id === normalized.id) || (p.senderId === normalized.senderId && p.content === normalized.content && String(p.createdAt) === String(normalized.createdAt)))) return prev;
        const replaced = prev.map(p => {
          if (p.id && String(p.id).startsWith('local-') && p.senderId === normalized.senderId && p.content === normalized.content) {
            // preserve optimistic message's senderAvatar if present, otherwise use normalized senderAvatar
            return { ...normalized, senderAvatar: p.senderAvatar || normalized.senderAvatar || (p.senderId === currentUserIdNorm ? currentUserAvatar : (p.senderId === targetUserIdNorm ? (targetUserAvatar && targetUserAvatar.startsWith('http') ? targetUserAvatar : (targetUserAvatar ? buildUpload(`/profiles/${targetUserAvatar}`) : '')) : '')) };
          }
          return p;
        });
        const next = [...replaced, normalized].filter(Boolean);
        saveCache(cacheKey, next);
        return next;
      });
    };
    s.on('receiveMessage', handleReceive);
    return () => {
      s.off('receiveMessage', handleReceive);
    };
  }, [socket, roomId]);

  // Ensure we join the right room whenever roomId becomes available or changes
  useEffect(() => {
    // use socket from context (socketRef is defined in SocketContext but not exported here)
    const s = socket;
    if (!s) return;
    if (!roomId) return;
    try {
      // Emit joinRoom again to ensure server-side subscription
      if (s.emit) {
        s.emit('joinRoom', { roomId });
        console.info('Socket joinRoom emitted (on room change) for', roomId);
      }
    } catch (e) {
      console.warn('Failed to emit joinRoom on room change', e);
    }
  }, [roomId, socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const now = new Date().toISOString();
    
    // Include current user's profile in the message
    const userProfile = currentUser?.profilePic 
      ? buildUpload(`/profiles/${currentUser.profilePic}`)
      : deriveAvatarFromLocal();
      
    const msg = {
      roomId,
      message: input,
      sender: currentUserIdNorm,
      receiver: targetUserIdNorm,
      senderAvatar: userProfile, // Include profile pic
      timestamp: now,
      createdAt: now
    };
    // emit optimistic message
    const localId = `local-${now}-${Math.random()}`;
  // Create local message with proper avatar
  const local = { 
    id: localId, 
    senderId: currentUserIdNorm, 
    receiverId: targetUserIdNorm, 
    content: input, 
    createdAt: now 
  };

  // Cache current user data for consistent avatar display
  try { 
    if (!localStorage.getItem('current_user') && currentUser) {
      localStorage.setItem('current_user', JSON.stringify(currentUser));
    }
  } catch (e) {}

  // Set avatar in order of preference:
  // 1. Current user's profile pic from context
  // 2. Avatar derived from localStorage
  // 3. Default fallback
  local.senderAvatar = (currentUser?.profilePic && buildUpload(`/profiles/${currentUser.profilePic}`)) || 
                      deriveAvatarFromLocal() || 
                      '/default-avatar.png';
    setMessages(prev => {
      const next = [...prev, local];
      saveCache(cacheKey, next);
      return next;
    });
    setInput('');
    try {
  if (socket && socket.emit) socket.emit('sendMessage', msg);
      // Save to DB with token, expect server to return saved message
      const token = getAuthToken();
      const res = await axios.post('/api/messages', { receiver: targetUserId, content: input }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const saved = res.data;
      const normalizedSaved = {
        id: saved._id || saved.id,
        senderId: normalizeIdStr(saved.sender || saved.senderId || currentUserIdNorm),
        receiverId: normalizeIdStr(saved.receiver || saved.receiverId || targetUserIdNorm),
        content: saved.content || saved.message || input,
        createdAt: saved.createdAt || saved.timestamp || now
        ,
        // Respect optimistic avatar if it exists; otherwise use server-provided avatar (normalized)
        senderAvatar: (saved.senderAvatar && saved.senderAvatar.startsWith('http')) ? saved.senderAvatar : (saved.senderAvatar ? buildUpload(`/profiles/${saved.senderAvatar}`) : currentUserAvatar)
      };
      // replace optimistic local message with saved one and persist
      setMessages(prev => {
        const next = prev.map(p => p.id === localId ? normalizedSaved : p);
        saveCache(cacheKey, next);
        return next;
      });
    } catch (err) {
      // If save failed, remove optimistic message and show error
      setMessages(prev => prev.filter(p => p.id !== localId));
      console.error('Failed to send message', err);
    }
  };

  return (
    <div className={`chatbox-container ${large ? 'large' : ''}`}>
      <div className="chatbox-header">
        <img className="chatbox-header-avatar" src={(targetUserAvatar && targetUserAvatar.startsWith('http')) ? targetUserAvatar : (targetUserAvatar ? buildUpload(`/profiles/${targetUserAvatar}`) : '/default-avatar.png')} alt={targetUserName} />
        <div className="chatbox-header-title">{targetUserName}</div>
      </div>
      <div className="chatbox-messages">
        {messages.map((msg, i) => {
                  // Get reliable current user ID from multiple sources
          const myId = normalizeIdStr(
            currentUser?._id || 
            currentUser?.id || 
            localStorage.getItem('user_id')
          );
          
          // Get clean message sender ID with full object support
          const msgSenderId = normalizeIdStr(
            msg.senderId || 
            msg.sender?._id || 
            msg.sender?.id || 
            msg.sender
          );
          
          // Message ownership check:
          // 1. Exact ID match with current user
          // 2. Local message (just sent)
          const isMyMessage = msgSenderId === myId || msg.id?.startsWith('local-');
          
          // Determine styles and avatar based on ownership
          let messageStyle, avatarSrc;
          
          if (isMyMessage) {
            // My message: Right-aligned + Blue + Own avatar (optional)
            messageStyle = {
              rowClass: 'mine',
              bubbleClass: 'me'
            };
            
            // For my messages, get avatar from:
            // 1. Message's existing sender avatar
            // 2. Current user's profile from context
            // 3. Profile pic from localStorage
            // 4. Default avatar as fallback
            avatarSrc = msg.senderAvatar || 
                       (currentUser?.profilePic && buildUpload(`/profiles/${currentUser.profilePic}`)) ||
                       deriveAvatarFromLocal() ||
                       '/default-avatar.png';
                       
          } else {
            // Their messages: Left-aligned + Gray
            messageStyle = {
              rowClass: 'theirs', 
              bubbleClass: 'them'
            };
            
            // For their messages, get avatar from:
            // 1. Message's saved sender avatar 
            // 2. Target user's provided avatar
            // 3. Try to fetch from profiles folder
            // 4. Default avatar as fallback
            avatarSrc = msg.senderAvatar ||
                       (targetUserAvatar && (
                         targetUserAvatar.startsWith('http') 
                           ? targetUserAvatar 
                           : buildUpload(`/profiles/${targetUserAvatar}`)
                       )) ||
                       buildUpload(`/profiles/${msgSenderId}_profile.jpg`) ||
                       '/default-avatar.png';
          }

          // Only show avatar for first message in a sequence from same sender
          const prevMsg = messages[i - 1];
          const showAvatar = !prevMsg || normalizeIdStr(prevMsg.senderId) !== msgSenderId;

          return (
            <div 
              key={msg.id || msg._id || i} 
              className={`chatbox-message-row ${messageStyle.rowClass}`}
              title={isMyMessage ? 'You' : targetUserName}
            >
              {/* Only render avatar for receiver (their) messages */}
              {!isMyMessage && (
                <img
                  className="msg-avatar loading"
                  src={avatarSrc}
                  alt={targetUserName || 'User avatar'}
                  style={{ 
                    display: showAvatar ? 'block' : 'none'
                  }}
                  onLoad={(e) => {
                    e.currentTarget.classList.remove('loading');
                  }}
                  onError={(e) => {
                    // Remove loading state
                    e.currentTarget.classList.remove('loading');
                    // Only set default if not already default
                    if (e.currentTarget.src !== '/default-avatar.png') {
                      e.currentTarget.src = '/default-avatar.png';
                    }
                    e.currentTarget.onerror = null;
                  }}
                />
              )}
              
              <div className={`chatbox-message ${messageStyle.bubbleClass}`}>
                {msg.content || msg.message}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <form className="chatbox-input-row" onSubmit={sendMessage}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Type a message..." />
        <button type="submit">Send</button>
      </form>
    </div>
  );
};

export default ChatBox;
