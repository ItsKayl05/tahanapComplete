import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthContext } from '../../../context/AuthContext';
import { buildApi } from '../../../services/apiConfig';
import Sidebar from '../Sidebar/Sidebar';
import '../landlord-theme.css';
import './AddProperties.css';
import PhotoDomeViewer from '../../../components/PhotoDomeViewer';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const barangayList = [
    'Assumption','Bagong Buhay I','Bagong Buhay II','Bagong Buhay III','Ciudad Real','Citrus','Dulong Bayan','Fatima I','Fatima II','Fatima III','Fatima IV','Fatima V','Francisco Homes – Guijo','Francisco Homes – Mulawin','Francisco Homes – Narra','Francisco Homes – Yakal','Gaya-gaya','Graceville','Gumaok Central','Gumaok East','Gumaok West','Kaybanban','Kaypian','Lawang Pare','Maharlika','Minuyan I','Minuyan II','Minuyan III','Minuyan IV','Minuyan V','Minuyan Proper','Muzon East','Muzon Proper','Muzon South','Muzon West','Paradise III','Poblacion','Poblacion 1','San Isidro','San Manuel','San Martin De Porres','San Martin I','San Martin II','San Martin III','San Martin IV','San Pedro','San Rafael I','San Rafael II','San Rafael III','San Rafael IV','San Rafael V','San Roque','Sapang Palay Proper','Sta. Cruz I','Sta. Cruz II','Sta. Cruz III','Sta. Cruz IV','Sta. Cruz V','Sto. Cristo','Sto. Nino I','Sto. Nino II','Tungkong Mangga'
];
const categories = ['Apartment','Dorm','House','Condominium','Studio'];

const AddProperties = () => {
  // Panoramic image state
  const [panorama, setPanorama] = useState(null);
  const [panoramaPreview, setPanoramaPreview] = useState(null);

  // Handle panoramic image upload
  const handlePanoramaChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validType = file.type.startsWith('image/');
    const sizeOk = file.size <= 8*1024*1024;
    if (!validType) { toast.error('Panoramic image must be an image file.'); return; }
    if (!sizeOk) { toast.error('Panoramic image exceeds 8MB limit.'); return; }
    if (panoramaPreview) URL.revokeObjectURL(panoramaPreview);
    setPanorama(file);
    setPanoramaPreview(URL.createObjectURL(file));
  };
  const removePanorama = () => {
    if (panoramaPreview) URL.revokeObjectURL(panoramaPreview);
    setPanorama(null);
    setPanoramaPreview(null);
  };
  const SJDM_CENTER = [14.8136, 121.0450];
  const SJDM_ZOOM = 13;
    const { logout } = useContext(AuthContext);
    const navigate = useNavigate();
  const [propertyData, setPropertyData] = useState({
    title:'', description:'', address:'', price:'', barangay:'', category:'', petFriendly:false, allowedPets:'', occupancy:'', parking:false, rules:'', landmarks:'', numberOfRooms:'', areaSqm:'', images:[], video:null, latitude:'', longitude:'', availabilityStatus: 'Available'
  });
  const [imagePreviews, setImagePreviews] = useState([]);
    const [videoPreview, setVideoPreview] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const MAX_IMAGES = 8;

  // Geocode address+barangay to get lat/lng
  const geocodeAddress = async (address, barangay) => {
    if (!address || !barangay) return;
    const query = encodeURIComponent(`${address}, ${barangay}, San Jose del Monte, Bulacan, Philippines`);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`);
      const data = await res.json();
      if (data && data.length > 0) {
        return { lat: data[0].lat, lon: data[0].lon };
      }
    } catch (err) { /* ignore */ }
    return null;
  };

  // Manual pin placement handler
  function LocationSelector() {
    useMapEvents({
      click(e) {
        setPropertyData(prev => ({ ...prev, latitude: e.latlng.lat, longitude: e.latlng.lng, manualPin: true }));
        toast.info('Pin location set!');
      }
    });
    return null;
  }

  const handleInputChange = async (e) => {
    const { name, value, type, checked } = e.target;
    setPropertyData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));

    // If address or barangay changes, geocode
    if (name === 'address' || name === 'barangay') {
      const nextAddress = name === 'address' ? value : propertyData.address;
      const nextBarangay = name === 'barangay' ? value : propertyData.barangay;
      if (nextAddress && nextBarangay) {
        const coords = await geocodeAddress(nextAddress, nextBarangay);
        if (coords) {
          setPropertyData(prev => ({ ...prev, latitude: coords.lat, longitude: coords.lon }));
        }
      }
    }
  };

    const handleImageChange = (e) => {
        const selected = Array.from(e.target.files || []);
        if (!selected.length) return;
        const spaceLeft = MAX_IMAGES - propertyData.images.length;
        if (spaceLeft <= 0) { toast.info(`Max ${MAX_IMAGES} images reached.`); return; }
        const usable = selected.slice(0, spaceLeft).filter(f => {
            const validType = f.type.startsWith('image/');
            const sizeOk = f.size <= 4*1024*1024;
            if (!validType) toast.warn(`${f.name} skipped (not image).`);
            if (!sizeOk) toast.warn(`${f.name} skipped (>4MB).`);
            return validType && sizeOk;
        });
        if (!usable.length) return;
        setPropertyData(p => ({ ...p, images:[...p.images, ...usable] }));
        setImagePreviews(p => [...p, ...usable.map(f => URL.createObjectURL(f))]);
    };

    const removeImage = (index) => {
        setPropertyData(p => ({ ...p, images: p.images.filter((_,i)=>i!==index) }));
        setImagePreviews(p => p.filter((_,i)=>i!==index));
    };
    // Cleanup blob URLs on unmount
  useEffect(()=>{
    return () => {
      imagePreviews.forEach(url => URL.revokeObjectURL(url));
      if (videoPreview?.startsWith('blob:')) URL.revokeObjectURL(videoPreview);
      if (panoramaPreview) URL.revokeObjectURL(panoramaPreview);
    };
  },[imagePreviews, videoPreview, panoramaPreview]);

    const handleVideoChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const allowed = ['video/mp4','video/webm','video/ogg'];
        if (!allowed.includes(file.type)) { toast.error('Invalid video format. Use MP4, WebM, or OGG.'); return; }
        if (file.size > 10*1024*1024) { toast.error('Video exceeds 10MB limit.'); return; }
        if (propertyData.video) URL.revokeObjectURL(videoPreview);
        setPropertyData(p => ({ ...p, video:file }));
        setVideoPreview(URL.createObjectURL(file));
    };
    const removeVideo = () => {
        if (videoPreview) URL.revokeObjectURL(videoPreview);
        setPropertyData(p => ({ ...p, video:null }));
        setVideoPreview(null);
    };

    const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    const token = localStorage.getItem('user_token');
    if (!token) { toast.error('No token found. Please log in.'); navigate('/login'); return; }
    const required = ['title','description','address','price','barangay','category'];
    if (required.some(f => !propertyData[f])) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (!propertyData.images.length) {
      toast.error('Please add at least one image');
      return;
    }
    if (propertyData.images.length > MAX_IMAGES) {
      toast.error(`Maximum of ${MAX_IMAGES} images allowed.`);
      return;
    }
    // Validate geocoding
    if (!propertyData.latitude || !propertyData.longitude || isNaN(Number(propertyData.latitude)) || isNaN(Number(propertyData.longitude))) {
      toast.error('Map location not found. Please check the address and barangay, then wait for the map preview to update before submitting.');
      return;
    }
    setIsSubmitting(true);
    const formData = new FormData();
    Object.entries(propertyData).forEach(([k,v]) => {
      if (k==='images') v.forEach(img => formData.append('images', img));
      else if (k==='video') { if (v) formData.append('video', v); }
      else formData.append(k,v);
    });
    try {
      const res = await fetch(buildApi('/properties/add'), { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body:formData });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) {
        // Show backend error message, including landlord verification
        toast.error(data.error || data.message || 'Failed to add property');
        setIsSubmitting(false);
        return;
      }
      toast.success('Property added successfully');
      navigate('/my-properties');
    } catch (err) {
      toast.error(err.message || 'Error adding property');
    } finally {
      setIsSubmitting(false);
    }
  }

    const handleLogout = () => {
        logout();
        localStorage.removeItem('user_token');
        toast.success('Logged out successfully');
        navigate('/');
        window.dispatchEvent(new Event('storage'));
    };

  return (
    <div className="dashboard-container landlord-dashboard">
      <Sidebar handleLogout={handleLogout} activeItem="add-properties" />
      <div className="landlord-main add-property-main">
        <form onSubmit={handleSubmit} className="ll-card add-property-form" noValidate>
          <div className="form-header" style={{marginBottom:'32px'}}>
            <h2 className="form-title">Add New Property</h2>
            <p className="form-subtitle">Create a new listing. All fields marked with * are required.</p>
          </div>
          <div className="info-banner" style={{marginBottom:'32px', padding:'12px 18px', background:'#f7f7f7', borderRadius:'8px', fontSize:'15px'}}>
            <strong>Verification Reminder:</strong> Upload <strong>one clear government ID</strong> in the sidebar verification panel to unlock publishing. Review may take up to <strong>1 hour</strong>.
          </div>
          <div className="ll-grid ll-gap-md">
            <div className="ll-stack">
              {/* Property Info Section */}
              <div className="form-group">
                <label className="required">Title</label>
                <input className="ll-field" name="title" value={propertyData.title} onChange={handleInputChange} required placeholder="Property Title" maxLength={100} />
                <div className="field-hint small">{propertyData.title.length}/100</div>
              </div>
              <div className="form-group full">
                <label className="required">Description</label>
                <textarea className="ll-field" name="description" value={propertyData.description} onChange={handleInputChange} rows={5} maxLength={500} required />
                <div className="field-hint small">{propertyData.description.length}/500</div>
              </div>
              <div className="form-group">
                <label className="required">Address</label>
                <input className="ll-field" name="address" value={propertyData.address} onChange={handleInputChange} required placeholder="Street, Building, etc." />
              </div>
              <div className="form-group">
                <label className="required">Barangay</label>
                <select className="ll-field" name="barangay" value={propertyData.barangay} onChange={handleInputChange} required>
                  <option value="">Select Barangay</option>
                  {barangayList.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="required">Category</label>
                <select className="ll-field" name="category" value={propertyData.category} onChange={handleInputChange} required>
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="required">Price (₱)</label>
                <input className="ll-field" type="number" min={0} name="price" value={propertyData.price} onChange={handleInputChange} required />
              </div>
              <div className="form-group">
                <label>Number of Rooms</label>
                <input className="ll-field" type="number" min={0} name="numberOfRooms" value={propertyData.numberOfRooms} onChange={handleInputChange} placeholder="e.g. 2" />
              </div>
              <div className="form-group">
                <label>Availability Status</label>
                <select className="ll-field" name="availabilityStatus" value={propertyData.availabilityStatus} onChange={handleInputChange}>
                  <option value="Available">Available</option>
                  <option value="Fully Occupied">Fully Occupied</option>
                  <option value="Not Yet Ready">Not Yet Ready</option>
                </select>
              </div>
              <div className="form-group">
                <label>Property Size (sqm)</label>
                <input className="ll-field" type="number" min={0} step={0.1} name="areaSqm" value={propertyData.areaSqm} onChange={handleInputChange} placeholder="e.g. 45" />
              </div>
              <div className="form-group">
                <label className="required">Max Occupancy</label>
                <input className="ll-field" type="number" min={1} name="occupancy" value={propertyData.occupancy} onChange={handleInputChange} required />
              </div>
              <div className="form-group toggle-field">
                <label className="checkbox-label"><input type="checkbox" name="parking" checked={propertyData.parking} onChange={handleInputChange} /> Parking Available</label>
              </div>
              <div className="form-group toggle-field">
                <label className="checkbox-label"><input type="checkbox" name="petFriendly" checked={propertyData.petFriendly} onChange={handleInputChange} /> Pet Friendly</label>
                {propertyData.petFriendly && <input className="ll-field mt-6" name="allowedPets" value={propertyData.allowedPets} placeholder="Allowed pets (e.g. Cats, Dogs)" onChange={handleInputChange} />}
              </div>
              <div className="form-group full">
                <label>Nearby Landmarks</label>
                <input className="ll-field" name="landmarks" value={propertyData.landmarks} onChange={handleInputChange} placeholder="School, mall, hospital etc." />
              </div>
              <div className="form-group full">
                <label>House Rules</label>
                <textarea className="ll-field" name="rules" value={propertyData.rules} onChange={handleInputChange} placeholder="No loud noises after 10 PM, No smoking inside" rows={3} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="latitude">Latitude (auto-filled)</label>
                  <input id="latitude" name="latitude" type="number" step="any" value={propertyData.latitude} readOnly style={{background:'#f5f5f5'}} placeholder="Auto-filled" />
                </div>
                <div className="form-group">
                  <label htmlFor="longitude">Longitude (auto-filled)</label>
                  <input id="longitude" name="longitude" type="number" step="any" value={propertyData.longitude} readOnly style={{background:'#f5f5f5'}} placeholder="Auto-filled" />
                </div>
              </div>
            </div>
            <div className="ll-stack">
              {/* Images Section */}
              <div className="images-section" style={{marginTop:'0'}}>
                <h3 className="section-title">Images <span style={{fontWeight:400, fontSize:'0.7rem'}}>({propertyData.images.length}/8 total)</span></h3>
                <p className="field-hint">Add up to 8 images (JPG/PNG/WebP, max 4MB each).</p>
                <div className="current-images-grid">
                  {imagePreviews.length ? imagePreviews.map((url, i) => (
                    <div key={i} className="image-chip">
                      <img src={url} alt={`Property ${i}`} />
                      <button type="button" aria-label="Remove image" onClick={() => removeImage(i)}>&times;</button>
                    </div>
                  )) : <div className="placeholder">No images</div>}
                </div>
                <div className="new-upload-block">
                  <label className="file-drop-modern">
                    <input type="file" multiple accept="image/*" onChange={handleImageChange} />
                    <span>Add / Replace Images</span>
                  </label>
                </div>
              </div>

              {/* 360° Panoramic Image Section */}
              <div className="panorama-section" style={{marginTop:'32px'}}>
                <h3 className="section-title">360° Panoramic Image</h3>
                <p className="field-hint">Optional: Add a panoramic 360° image (JPG/PNG/WebP, max 8MB, equirectangular projection).</p>
                {panoramaPreview ? (
                  <div style={{marginBottom:'12px'}}>
                    <PhotoDomeViewer imageUrl={panoramaPreview} mode="MONOSCOPIC" />
                    <div style={{marginTop:'8px', display:'flex', gap:'8px'}}>
                      <button type="button" className="ll-btn tiny danger" onClick={removePanorama}>Remove</button>
                      <button type="button" className="ll-btn tiny" onClick={()=>document.getElementById('panorama-input').click()}>Replace</button>
                    </div>
                  </div>
                ) : (
                  <label className="file-drop-modern">
                    <input id="panorama-input" type="file" accept="image/*" style={{display:'none'}} onChange={handlePanoramaChange} />
                    <span onClick={()=>document.getElementById('panorama-input').click()}>Add 360° Panoramic Image</span>
                  </label>
                )}
              </div>
              {/* Video Section */}
              <div className="video-section" style={{marginTop:'32px'}}>
                <h3 className="section-title">Property Video <span style={{fontWeight:400, fontSize:'0.7rem'}}>{propertyData.video ? 'selected' : 'none'}</span></h3>
                <p className="field-hint">Optional walkthrough clip (MP4/WebM/OGG, up to 10MB). Uploading a new one replaces the existing video.</p>
                {!videoPreview && !propertyData.video && (
                  <label className="file-drop-modern">
                    <input type="file" accept="video/mp4,video/webm,video/ogg" onChange={handleVideoChange} />
                    <span>Select / Replace Video</span>
                  </label>
                )}
                {(videoPreview || propertyData.video) && (
                  <div className="video-preview-wrapper">
                    <video src={videoPreview} controls preload="none" className="video-preview" />
                    <div className="video-actions">
                      <button type="button" className="ll-btn tiny danger" onClick={removeVideo}>Remove Video</button>
                      <button type="button" className="ll-btn tiny" onClick={()=>document.querySelector('input[type="file"][accept^="video"]').click()}>Change</button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Map Preview Section */}
              <div className="ll-card map-preview-section" style={{marginTop:'32px', padding:'24px', borderRadius:'12px', boxShadow:'0 2px 12px rgba(0,0,0,0.05)', background:'#fafafa'}}>
                <h3 style={{marginBottom:'18px'}}>Map Preview (SJDM only)</h3>
                <div style={{height:'320px', width:'100%', border:'1px solid #ccc', borderRadius:'8px', overflow:'hidden'}}>
                  <MapContainer center={propertyData.latitude && propertyData.longitude ? [parseFloat(propertyData.latitude), parseFloat(propertyData.longitude)] : SJDM_CENTER} zoom={SJDM_ZOOM} style={{height:'100%', width:'100%'}} scrollWheelZoom={true}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
                    <LocationSelector />
                    {propertyData.latitude && propertyData.longitude && (
                      <Marker
                        position={[parseFloat(propertyData.latitude), parseFloat(propertyData.longitude)]}
                        draggable={true}
                        eventHandlers={{
                          dragend: (e) => {
                            const latlng = e.target.getLatLng();
                            setPropertyData(prev => ({ ...prev, latitude: latlng.lat, longitude: latlng.lng, manualPin: true }));
                            toast.info('Pin moved!');
                          }
                        }}
                      >
                        <Popup>
                          <strong>{propertyData.title || 'New Property'}</strong><br />
                          {propertyData.address}<br />
                          {propertyData.price ? `₱${propertyData.price}` : ''}
                          <br /><span style={{fontSize:'0.8em'}}>Manual pin: Click map or drag marker to set location</span>
                        </Popup>
                      </Marker>
                    )}
                  </MapContainer>
                </div>
                <div style={{marginTop:'8px', fontSize:'0.95em', color:'#555'}}>
                  Tip: You can manually set the pin by clicking on the map or dragging the marker. Zoom in/out and pan to adjust view.<br />
                  {propertyData.manualPin && (
                    <button type="button" className="ll-btn tiny outline" style={{marginTop:'8px'}} onClick={() => {
                      // Reset pin to auto-geocoded value
                      setPropertyData(prev => ({ ...prev, latitude:'', longitude:'', manualPin: false }));
                      toast.info('Pin reset. Enter address and barangay to auto-fill location.');
                    }}>Reset Pin to Auto</button>
                  )}
                </div>
              </div>
              <div className="form-actions" style={{marginTop:'32px', display:'flex', gap:'16px', justifyContent:'flex-end'}}>
                <button type="button" className="ll-btn outline" onClick={()=>navigate(-1)}>Cancel</button>
                <button type="submit" className="ll-btn primary" disabled={isSubmitting}>{isSubmitting ? 'Adding...' : 'Add Property'}</button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProperties;