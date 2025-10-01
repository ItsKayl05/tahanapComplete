
import React, { useEffect, useState, useContext } from 'react';
import './Messages.css';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import ChatBox from '../../../components/ChatBox/ChatBox';
import { buildUpload } from '../../../services/apiConfig';
import TenantSidebar from '../TenantSidebar/TenantSidebar';
import { AuthContext } from '../../../context/AuthContext';

const Messages = ({ currentUserId: propCurrentUserId }) => {
  const { logout } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchParams] = useSearchParams();
  const targetUserId = searchParams.get('user');
  // Extract property context from URL if present
  const propertyTitle = searchParams.get('propertyTitle') || '';
  const propertyImage = searchParams.get('propertyImage') || '';
  const propertyPrice = searchParams.get('propertyPrice') || '';
  const propertyId = searchParams.get('propertyId') || '';
  const currentUserId = propCurrentUserId || localStorage.getItem('user_id') || '';

  useEffect(() => {
    const token = localStorage.getItem('user_token');
    // Fetch all message threads for the current user
    axios.get('/api/messages/threads', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        setUsers(res.data);
        // If coming from Contact Owner, auto-select the target user
        if (targetUserId) {
          const found = res.data.find(u => String(u._id || u.id) === String(targetUserId));
          if (found) {
            // If property context is present in URL, attach as propertyInfo
            let userWithProperty = { ...found, _id: String(found._id || found.id) };
            if (propertyTitle || propertyImage || propertyPrice || propertyId) {
              userWithProperty.propertyInfo = {
                title: propertyTitle,
                images: propertyImage ? [propertyImage] : [],
                price: propertyPrice,
                _id: propertyId
              };
            }
            setSelectedUser(userWithProperty);
          } else {
            // If target user isn't in threads (no prior messages), fetch their public profile
            axios.get(`/api/users/landlord/${targetUserId}/profile`)
              .then(r => {
                const u = r.data;
                let userWithProperty = { _id: String(u.id || u._id), fullName: u.fullName, username: u.username, profilePic: u.profilePic };
                if (propertyTitle || propertyImage || propertyPrice || propertyId) {
                  userWithProperty.propertyInfo = {
                    title: propertyTitle,
                    images: propertyImage ? [propertyImage] : [],
                    price: propertyPrice,
                    _id: propertyId
                  };
                }
                setSelectedUser(userWithProperty);
              })
              .catch(() => {
                // ignore - leave unselected
              });
          }
        }
      })
      .catch(() => setUsers([]));
  }, [currentUserId, targetUserId]);

  return (
    <div className="tenant-dashboard dashboard-container">
      <TenantSidebar handleLogout={() => { logout(); localStorage.removeItem('user_token'); window.dispatchEvent(new Event('storage')); }} />

      <main className="tenant-messages-main" style={{flex:1}}>
        <div style={{display:'flex',height:'80vh'}}>
          <div style={{width:320, borderRight:'1px solid #eee', overflowY:'auto', background:'#f7f7fa'}}>
  <h3 className="messages-title">Messages</h3>
        {users.length === 0 && <div style={{color:'#888',padding:'1em'}}>No conversations yet.</div>}
        {users.map(u => (
          <div key={u._id} style={{padding:'0.75em 1em',cursor:'pointer',background:selectedUser&&selectedUser._id===u._id?'#e6eaff':'',display:'flex',alignItems:'center',borderRadius:8,margin:'0.25em 0'}} onClick={()=>setSelectedUser(u)}>
            <img src={(u.profilePic && u.profilePic.startsWith('http')) ? u.profilePic : (u.profilePic ? buildUpload(`/profiles/${u.profilePic}`) : '/default-avatar.png')} alt={u.fullName} style={{width:40,height:40,borderRadius:'50%',marginRight:12,objectFit:'cover',border:'2px solid #dbeafe'}} />
            <div style={{flex:1}}>
              <div className="messages-username">{u.fullName || u.username}</div>
              {u.lastMessage && <div style={{fontSize:'0.95em',color:'#888',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{u.lastMessage}</div>}
            </div>
          </div>
        ))}
      </div>
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:'#f4f6fb'}}>
        {selectedUser ? (
          <ChatBox
            currentUserId={String(currentUserId)}
            targetUserId={String(selectedUser._id)}
            targetUserName={selectedUser.fullName || selectedUser.username}
            targetUserAvatar={selectedUser.profilePic}
            large
            propertyTitle={selectedUser.propertyInfo?.title || ''}
            propertyImage={selectedUser.propertyInfo?.images?.[0] || ''}
            propertyPrice={selectedUser.propertyInfo?.price || ''}
            propertyId={selectedUser.propertyInfo?._id || ''}
          />
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
