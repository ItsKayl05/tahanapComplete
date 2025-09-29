
import React, { useEffect, useState, useContext } from 'react';
import './Messages.css';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import ChatBox from '../../../components/ChatBox/ChatBox';
import DashboardSidebar from '../../../components/DashboardSidebar/DashboardSidebar';
import { AuthContext } from '../../../context/AuthContext';
import { buildUpload } from '../../../services/apiConfig';


const Messages = ({ currentUserId }) => {
  const { logout } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchParams] = useSearchParams();
  const targetUserId = searchParams.get('user');

  useEffect(() => {
    const token = localStorage.getItem('user_token');
    // Fetch all messages involving the current user
    axios.get('/api/messages/threads', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        setUsers(res.data);
        // If coming from Contact Owner, auto-select the target user
        if (targetUserId) {
          const found = res.data.find(u => u._id === targetUserId);
          if (found) setSelectedUser(found);
        }
      })
      .catch(() => setUsers([]));
  }, [currentUserId, targetUserId]);

  // helper to resolve avatar src from various possible fields
  const avatarFor = (u) => {
    const p = (u && (u.profilePic || u.profilePicUrl || u.avatar || u.image));
    if (!p) return '/default-avatar.png';
    if (typeof p === 'string' && p.startsWith('http')) return p;
    return buildUpload(`/profiles/${p}`);
  };

  return (
    <div className="landlord-dashboard dashboard-container">
      <DashboardSidebar
        variant="landlord"
        links={[
          { key:'profile', label:'Profile', to:'/landlord-profile', active: false },
          { key:'add-properties', label:'Add Properties', to:'/add-properties', active: false },
          { key:'my-properties', label:'My Properties', to:'/my-properties', active: false },
          { key:'properties', label:'All Listings', to:'/properties', active: false },
          { key:'property-map', label:'Property Map', to:'/property-map', active: false },
          { key:'messages', label:'Messages', to:'/landlord/messages', active: true },
        ]}
        onNavigate={(to)=> { window.location.href = to; }}
        onLogout={() => { logout(); localStorage.removeItem('user_token'); window.dispatchEvent(new Event('storage')); }}
      />
      <main className="landlord-messages-main messages-page" style={{flex:1}}>
        <div className="messages-layout" style={{display:'flex',height:'80vh'}}>
          <div className="messages-list" style={{width:320, borderRight:'1px solid #eee', overflowY:'auto', background:'#f7f7fa'}}>
  <h3 className="messages-title">Messages</h3>
        {users.length === 0 && <div style={{color:'#888',padding:'1em'}}>No conversations yet.</div>}
        {users.map(u => (
          <div key={u._id} style={{padding:'0.75em 1em',cursor:'pointer',background:selectedUser&&selectedUser._id===u._id?'#e6eaff':'',display:'flex',alignItems:'center',borderRadius:8,margin:'0.25em 0'}} onClick={()=>setSelectedUser(u)}>
            <img src={avatarFor(u)} alt={u.fullName} style={{width:40,height:40,borderRadius:'50%',marginRight:12,objectFit:'cover',border:'2px solid #dbeafe'}} />
            <div style={{flex:1}}>
              <div className="messages-username">{u.fullName || u.username}</div>
              {u.lastMessage && <div style={{fontSize:'0.95em',color:'#888',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{u.lastMessage}</div>}
            </div>
          </div>
        ))}
      </div>
  <div className="messages-area" style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:'#f4f6fb'}}>
        {selectedUser ? (
          <ChatBox currentUserId={currentUserId} targetUserId={selectedUser._id} targetUserName={selectedUser.fullName || selectedUser.username} targetUserAvatar={selectedUser.profilePic} large />
        ) : (
          <div style={{color:'#888',fontSize:'1.1em'}}>Select a conversation to start chatting</div>
        )}
          </div>
          </div>
      </main>
    </div>
  );
};

export default Messages;
