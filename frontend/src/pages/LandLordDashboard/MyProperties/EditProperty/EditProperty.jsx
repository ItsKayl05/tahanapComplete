import React, { useState, useEffect } from "react";
import PhotoDomeViewer from '../../../../components/PhotoDomeViewer';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import '../../landlord-theme.css';
import '../MyProperties.css'; /* reuse some shared patterns like skeleton if any */
import "./EditProperty.css";
import Sidebar from "../../Sidebar/Sidebar";
import { buildApi, buildUpload } from '../../../../services/apiConfig';

const categories = ["Apartment", "Dorm", "House", "Studio"];
const barangays = [
    "Assumption",
    "Bagong Buhay I", "Bagong Buhay II", "Bagong Buhay III",
    "Ciudad Real", "Citrus",
    "Dulong Bayan",
    "Fatima I", "Fatima II", "Fatima III", "Fatima IV", "Fatima V",
    "Francisco Homes – Guijo", "Francisco Homes – Mulawin", "Francisco Homes – Narra", "Francisco Homes – Yakal",
    "Gaya-gaya", "Graceville", "Gumaok Central", "Gumaok East", "Gumaok West",
    "Kaybanban", "Kaypian",
    "Lawang Pare",
    "Maharlika", "Minuyan I", "Minuyan II", "Minuyan III", "Minuyan IV", "Minuyan V", "Minuyan Proper",
    "Muzon East", "Muzon Proper", "Muzon South", "Muzon West",
    "Paradise III", "Poblacion", "Poblacion 1",
    "San Isidro", "San Manuel", "San Martin De Porres", "San Martin I", "San Martin II", "San Martin III", "San Martin IV",
    "San Pedro", "San Rafael I", "San Rafael II", "San Rafael III", "San Rafael IV", "San Rafael V",
    "San Roque", "Sapang Palay Proper",
    "Sta. Cruz I", "Sta. Cruz II", "Sta. Cruz III", "Sta. Cruz IV", "Sta. Cruz V",
    "Sto. Cristo", "Sto. Nino I", "Sto. Nino II",
    "Tungkong Mangga"
];

const EditProperty = () => {
    // Store original lat/lng for reset
    const [originalLatLng, setOriginalLatLng] = useState({ lat: "", lng: "" });
    const { propertyId } = useParams();
    const navigate = useNavigate();
    const [property, setProperty] = useState(null);
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        address: "",
        price: "",
        barangay: "",
        category: "",
        petFriendly: false,
        allowedPets: "",
        occupancy: "",
        parking: false,
        rules: "",
        landmarks: "",
    availabilityStatus: "Available",
        numberOfRooms: "",
        areaSqm: "",
        latitude: "",
        longitude: ""
    });
    const [manualPin, setManualPin] = useState(false);
    const [images, setImages] = useState([]); // existing image paths from server
    const [newImages, setNewImages] = useState([]); // File objects newly added
    const [deletedImages, setDeletedImages] = useState([]); // names marked for deletion
    const [videoFile, setVideoFile] = useState(null); // new video file
    const [videoPreview, setVideoPreview] = useState(null); // blob URL for preview
    const [removeVideo, setRemoveVideo] = useState(false); // flag to remove existing video
    // 360° Panoramic image state
    const [panorama, setPanorama] = useState(null); // new file
    const [panoramaPreview, setPanoramaPreview] = useState(null); // blob or url
    const [existingPanorama, setExistingPanorama] = useState(null); // from server
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const fetchProperty = async () => {
            try {
                const userToken = localStorage.getItem("user_token");
                if (!userToken) throw new Error("Unauthorized access. Please log in.");

                const response = await fetch(buildApi(`/properties/${propertyId}`), {
                    headers: { Authorization: `Bearer ${userToken}` },
                });

                if (!response.ok) throw new Error("Failed to fetch property details.");

                const data = await response.json();
                setProperty(data);
                setFormData({
                    title: data.title,
                    description: data.description,
                    address: data.address,
                    price: data.price,
                    barangay: data.barangay,
                    category: data.category,
                    petFriendly: data.petFriendly,
                    allowedPets: data.allowedPets,
                    occupancy: data.occupancy,
                    availabilityStatus: data.availabilityStatus ?? 'Available',
                    parking: data.parking,
                    rules: data.rules,
                    landmarks: data.landmarks,
                    numberOfRooms: data.numberOfRooms ?? "",
                    areaSqm: data.areaSqm ?? "",
                    latitude: data.latitude ?? "",
                    longitude: data.longitude ?? ""
                });
                setOriginalLatLng({
                    lat: data.latitude ?? "",
                    lng: data.longitude ?? ""
                });
                setImages(data.images || []);
                if (data.video) {
                    setVideoPreview(data.video.startsWith('http') ? data.video : buildUpload(data.video));
                }
                                // If backend returns a panorama field, set it
                                if (data.panorama360) {
                                    setExistingPanorama(data.panorama360.startsWith('http') ? data.panorama360 : buildUpload(data.panorama360));
                                }
                                setLoading(false);
            } catch (error) {
                toast.error(error.message || "Error fetching property.");
                setLoading(false);
            }
        };
        fetchProperty();
    }, [propertyId]);

    // Cleanup blob URL when component unmounts or when videoFile or panorama changes
    useEffect(()=>{
        return () => {
            if (videoFile && videoPreview?.startsWith('blob:')) URL.revokeObjectURL(videoPreview);
            if (panoramaPreview) URL.revokeObjectURL(panoramaPreview);
        };
    },[videoFile, videoPreview, panoramaPreview]);
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
            setExistingPanorama(null);
        };
        const removePanorama = () => {
            if (panoramaPreview) URL.revokeObjectURL(panoramaPreview);
            setPanorama(null);
            setPanoramaPreview(null);
            setExistingPanorama(null);
        };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === "checkbox" ? checked : value,
        });
        if (name === "address") setManualPin(false); // If address changes, suggest auto pin
    };

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        const MAX_FILES = 8;
        const currentCount = images.length + newImages.length;
        const availableSlots = MAX_FILES - currentCount;
        if (availableSlots <= 0) {
            toast.info(`Maximum of ${MAX_FILES} images reached.`);
            return;
        }
        const accepted = files.slice(0, availableSlots).filter(file => {
            const exists = newImages.some(f => f.name === file.name);
            const validType = file.type.startsWith('image/');
            const sizeOk = file.size <= 4 * 1024 * 1024; // 4MB
            if (!validType) toast.warn(`${file.name} skipped (not an image).`);
            if (!sizeOk) toast.warn(`${file.name} skipped (>4MB).`);
            if (exists) toast.warn(`${file.name} already added.`);
            return !exists && validType && sizeOk;
        });
        if (!accepted.length) return;
        setNewImages(prev => [...prev, ...accepted]);
    };

    const handleDeleteImage = (index, isExisting) => {
        if (isExisting) {
            const imageToDelete = images[index];
            setDeletedImages((prev) => [...prev, imageToDelete]); // Track deleted images
            setImages(images.filter((_, i) => i !== index)); // Remove from UI
        } else {
            setNewImages(newImages.filter((_, i) => i !== index)); // Remove new images
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submitting) return;
        try {
            const userToken = localStorage.getItem("user_token");
            if (!userToken) throw new Error("Unauthorized access. Please log in.");
            if (!formData.title || !formData.description) {
                toast.error('Title & description are required.');
                return;
            }
            setSubmitting(true);
                        const formDataToSend = new FormData();
                        Object.entries(formData).forEach(([key, value]) => {
                            if (value !== undefined && value !== null && value !== "") {
                                formDataToSend.append(key, value);
                            }
                        });
                        images.forEach(img => formDataToSend.append('existingImages', img));
                        deletedImages.forEach(img => formDataToSend.append('deletedImages[]', img.split('/').pop()));
                        newImages.forEach(file => formDataToSend.append('images', file));
                        if (videoFile) formDataToSend.append('video', videoFile);
                        if (removeVideo) formDataToSend.append('removeVideo', 'true');
                        if (panorama) {
                            formDataToSend.append('panorama360', panorama);
                        } else if (existingPanorama === null && property && property.panorama360) {
                            // Only send removePanorama if there was an existing panorama and now it's removed
                            formDataToSend.append('removePanorama', 'true');
                        }
            const response = await fetch(buildApi(`/properties/${propertyId}`), {
                method: 'PUT',
                headers: { Authorization: `Bearer ${userToken}` },
                body: formDataToSend
            });
            if (!response.ok) throw new Error('Failed to update property.');
            toast.success('Property updated successfully');
            navigate('/my-properties');
        } catch (err) {
            toast.error(err.message || 'Error updating property');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="dashboard-container landlord-dashboard">
            <Sidebar activeItem="my-properties" />
            <div className="landlord-main edit-property-main">
                {loading ? (
                    <div className="ll-card skeleton-card">
                        <div className="skeleton line w-50" />
                        <div className="skeleton line w-80" />
                        <div className="skeleton line w-40" />
                        <div className="skeleton line w-70" />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="ll-card edit-property-form" noValidate>
                        <div className="map-preview-section">
                            <label>Property Location (drag marker to update)</label>
                            <div style={{ height: "300px", width: "100%", marginBottom: "1rem", borderRadius: "8px", overflow: "hidden", boxShadow: "0 2px 8px #0001" }}>
                                <MapContainer
                                    center={formData.latitude && formData.longitude ? [parseFloat(formData.latitude), parseFloat(formData.longitude)] : [14.813, 121.045]}
                                    zoom={15}
                                    style={{ height: "100%", width: "100%" }}
                                >
                                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                    {formData.latitude && formData.longitude && (
                                        <Marker
                                            position={[parseFloat(formData.latitude), parseFloat(formData.longitude)]}
                                            draggable={true}
                                            eventHandlers={{
                                                dragend: (e) => {
                                                    const latlng = e.target.getLatLng();
                                                    setFormData(f => ({ ...f, latitude: latlng.lat.toString(), longitude: latlng.lng.toString() }));
                                                    setManualPin(true);
                                                }
                                            }}
                                            icon={L.icon({
                                                iconUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png",
                                                iconSize: [25, 41],
                                                iconAnchor: [12, 41],
                                                popupAnchor: [1, -34],
                                                shadowUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png",
                                                shadowSize: [41, 41]
                                            })}
                                        >
                                            <Popup>Drag to update location</Popup>
                                        </Marker>
                                    )}
                                </MapContainer>
                            </div>
                            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                                <input className="ll-field" type="text" name="latitude" value={formData.latitude} onChange={handleChange} placeholder="Latitude" style={{ width: "120px" }} />
                                <input className="ll-field" type="text" name="longitude" value={formData.longitude} onChange={handleChange} placeholder="Longitude" style={{ width: "120px" }} />
                                <button type="button" className="ll-btn tiny" onClick={() => {
                                    // Reset pin to original property location
                                    setFormData(f => ({
                                        ...f,
                                        latitude: originalLatLng.lat,
                                        longitude: originalLatLng.lng
                                    }));
                                    setManualPin(false);
                                    toast.info("Pin reset to original property location.");
                                }}>Reset Pin</button>
                                {manualPin && <span className="field-hint" style={{ color: "#1976d2" }}>Manual pin active</span>}
                            </div>
                        </div>
                        <div className="form-header">
                            <h2 className="form-title">Edit Property</h2>
                            <p className="form-subtitle">Update your listing details and images. Changes go live immediately after saving.</p>
                        </div>
                        <div className="form-grid">
                            <div className="field-group">
                                <label className="required">Title</label>
                                <input className="ll-field" name="title" value={formData.title} onChange={handleChange} maxLength={100} required />
                                <div className="field-hint small">{formData.title.length}/100</div>
                            </div>
                            <div className="field-group full">
                                <label className="required">Description</label>
                                <textarea className="ll-field" name="description" value={formData.description} onChange={handleChange} rows={5} maxLength={500} required />
                                <div className="field-hint small">{formData.description.length}/500</div>
                            </div>
                            <div className="field-group">
                                <label className="required">Address</label>
                                <input className="ll-field" name="address" value={formData.address} onChange={handleChange} required />
                            </div>
                            <div className="field-group">
                                <label className="required">Barangay</label>
                                <select className="ll-field" name="barangay" value={formData.barangay} onChange={handleChange} required>
                                    <option value="">Select barangay</option>
                                    {barangays.map(brgy => <option key={brgy} value={brgy}>{brgy}</option>)}
                                </select>
                            </div>
                            <div className="field-group">
                                <label className="required">Category</label>
                                <select className="ll-field" name="category" value={formData.category} onChange={handleChange} required>
                                    <option value="">Select category</option>
                                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>
                            <div className="field-group">
                                <label className="required">Price (₱)</label>
                                <input className="ll-field" type="number" min={1} name="price" value={formData.price} onChange={handleChange} required />
                            </div>
                            <div className="field-group">
                                <label>Number of Rooms</label>
                                <input className="ll-field" type="number" min={0} name="numberOfRooms" value={formData.numberOfRooms} onChange={handleChange} placeholder="e.g. 2" />
                            </div>
                            <div className="field-group">
                                <label className="required">Availability</label>
                                <select className="ll-field" name="availabilityStatus" value={formData.availabilityStatus} onChange={handleChange} required>
                                    <option value="Available">Available</option>
                                    <option value="Fully Occupied">Fully Occupied</option>
                                    <option value="Not Yet Ready">Not Yet Ready</option>
                                </select>
                                <div className="field-hint small">Choose the current availability for this listing.</div>
                            </div>
                            <div className="field-group">
                                <label>Property Size (sqm)</label>
                                <input className="ll-field" type="number" min={0} step={0.1} name="areaSqm" value={formData.areaSqm} onChange={handleChange} placeholder="e.g. 45" />
                            </div>
                            <div className="field-group">
                                <label className="required">Max Occupancy</label>
                                <input className="ll-field" type="number" min={1} name="occupancy" value={formData.occupancy} onChange={handleChange} required />
                            </div>
                            <div className="field-group toggle-field">
                                <label className="checkbox-label"><input type="checkbox" name="petFriendly" checked={formData.petFriendly} onChange={handleChange} /> Pet Friendly</label>
                                {formData.petFriendly && (
                                    <input className="ll-field mt-6" name="allowedPets" placeholder="Allowed pets (e.g. Cats, Dogs)" value={formData.allowedPets} onChange={handleChange} />
                                )}
                            </div>
                            <div className="field-group toggle-field">
                                <label className="checkbox-label"><input type="checkbox" name="parking" checked={formData.parking} onChange={handleChange} /> Parking Available</label>
                            </div>
                            <div className="field-group full">
                                <label>Nearby Landmarks</label>
                                <input className="ll-field" name="landmarks" value={formData.landmarks} onChange={handleChange} placeholder="School, mall, hospital etc." />
                            </div>
                            <div className="field-group full">
                                <label>House Rules</label>
                                <textarea className="ll-field" name="rules" value={formData.rules} onChange={handleChange} placeholder="No loud noises after 10 PM, No smoking inside" rows={3} />
                            </div>
                        </div>

                                                {/* 360° Panoramic Image Section */}
                                                <div className="panorama-section" style={{marginTop:'32px'}}>
                                                    <h3 className="section-title">360° Panoramic Image</h3>
                                                    <p className="field-hint">Optional: Add a panoramic 360° image (JPG/PNG/WebP, max 8MB, equirectangular projection).</p>
                                                    {(panoramaPreview || existingPanorama) ? (
                                                        <div style={{marginBottom:'12px'}}>
                                                            <PhotoDomeViewer imageUrl={panoramaPreview || existingPanorama} mode="MONOSCOPIC" />
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
                                                <div className="images-section">
                            <h3 className="section-title">Images <span style={{fontWeight:400, fontSize:'0.7rem'}}>({images.length + newImages.length}/8 total)</span></h3>
                            <p className="field-hint">You can keep, remove, or add new images (max 8 total, JPG/PNG/WebP up to 4MB each).</p>
                            <div className="current-images-grid">
                                {images.length ? images.map((img, i) => {
                                    const url = img.startsWith('http') ? img : buildUpload(img);
                                    return (
                                        <div key={i} className="image-chip">
                                            <img src={url} alt={`Property ${i}`} />
                                            <button type="button" aria-label="Remove image" onClick={() => handleDeleteImage(i, true)}>&times;</button>
                                        </div>
                                    );
                                }) : <div className="placeholder">No images</div>}
                            </div>
                            <div className="new-upload-block">
                                <label className="file-drop-modern">
                                    <input type="file" multiple accept="image/*" onChange={handleImageChange} />
                                    <span>Add / Replace Images</span>
                                </label>
                                {newImages.length > 0 && (
                                    <div className="new-images-grid">
                                        {newImages.map((file, i) => (
                                            <div key={i} className="image-chip pending">
                                                <img src={URL.createObjectURL(file)} alt={`New ${i}`} />
                                                <button type="button" aria-label="Remove pending image" onClick={() => handleDeleteImage(i, false)}>&times;</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="video-section">
                            <h3 className="section-title">Property Video <span style={{fontWeight:400, fontSize:'0.7rem'}}>({removeVideo ? 'will remove' : (videoFile ? 'new video selected' : (videoPreview ? 'existing' : 'none'))})</span></h3>
                            <p className="field-hint">Optional walkthrough clip (MP4/WebM/OGG, up to 10MB). Uploading a new one replaces the existing video.</p>
                            {!videoPreview && !videoFile && !removeVideo && (
                                <label className="file-drop-modern">
                                    <input type="file" accept="video/mp4,video/webm,video/ogg" onChange={(e)=>{
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const allowed = ['video/mp4','video/webm','video/ogg'];
                                        if (!allowed.includes(file.type)) { toast.error('Invalid video format.'); return; }
                                        if (file.size > 10*1024*1024) { toast.error('Video exceeds 10MB.'); return; }
                                        setVideoFile(file);
                                        setVideoPreview(URL.createObjectURL(file));
                                        setRemoveVideo(false);
                                    }} />
                                    <span>Select / Replace Video</span>
                                </label>
                            )}
                            {(videoPreview || videoFile) && !removeVideo && (
                                <div className="video-preview-wrapper">
                                    <video src={videoPreview} controls preload="none" className="video-preview" />
                                    <div className="video-actions">
                                        <button type="button" className="ll-btn tiny danger" onClick={()=>{
                                            if (videoFile && videoPreview?.startsWith('blob:')) URL.revokeObjectURL(videoPreview);
                                            setVideoFile(null); setVideoPreview(null); setRemoveVideo(true);
                                        }}>Remove Video</button>
                                        <button type="button" className="ll-btn tiny" onClick={()=>{
                                            document.querySelector('input[type="file"][accept^="video"]').click();
                                        }}>Change</button>
                                    </div>
                                </div>
                            )}
                            {removeVideo && (
                                <div className="removed-note">Video will be removed. <button type="button" className="link-btn" onClick={()=>setRemoveVideo(false)}>Undo</button></div>
                            )}
                        </div>
                        <div className="form-actions">
                            <button type="button" className="ll-btn outline" onClick={() => navigate(-1)}>Cancel</button>
                            <button type="submit" className="ll-btn primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save Changes'}</button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default EditProperty;