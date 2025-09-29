import fs from "fs/promises"; // Use async file operations
import path from "path";
import multer from "multer";
import mongoose from 'mongoose';
import Property from "../models/Property.js";
import User from "../models/User.js";

// Ensure the uploads/properties directory exists
const uploadDir = path.join(process.cwd(), "uploads/properties/");
fs.mkdir(uploadDir, { recursive: true }).catch(console.error);

// Constants
const MAX_IMAGES = 8; // Align with frontend limit
// Configure Multer for image + video uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`)
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max per file (covers video requirement)
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'images' || file.fieldname === 'panorama360') {
            if (file.mimetype.startsWith('image/')) return cb(null, true);
            return cb(new Error('Only image files allowed in ' + file.fieldname + ' field'));
        }
        if (file.fieldname === 'video') {
            const allowedVideo = ['video/mp4', 'video/webm', 'video/ogg'];
            if (allowedVideo.includes(file.mimetype)) return cb(null, true);
            return cb(new Error('Invalid video format. Allowed: mp4, webm, ogg'));
        }
        cb(new Error('Unexpected field: ' + file.fieldname));
    }
}).fields([
    { name: 'images', maxCount: MAX_IMAGES },
    { name: 'video', maxCount: 1 },
    { name: 'panorama360', maxCount: 1 }
]);

// Helper: Build absolute media URL
const toAbsolute = (req, relPath) => relPath ? (relPath.startsWith('http') ? relPath : `${req.protocol}://${req.get('host')}${relPath}`) : '';
// Helper: Format image paths for frontend
const formatImagePaths = (req, images) => images.map(img => toAbsolute(req, img));
// Helper: safe number coercion
const num = (v, def = 0) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : def;
};

// Helper function to delete images
const deleteImages = async (imagesToDelete) => {
    try {
        for (const image of imagesToDelete) {
            const imagePath = path.join(process.cwd(), "uploads/properties", image);
            try {
                await fs.unlink(imagePath); // Delete the image file
                console.log(`Deleted image: ${imagePath}`);
            } catch (err) {
                console.error(`Failed to delete image ${imagePath}: ${err.message}`);
            }
        }
    } catch (err) {
        console.error("Error deleting images:", err);
    }
};

// 🏡 Add Property
export const addProperty = async (req, res) => {
    upload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || "Error uploading media" });

        try {
            const { title, description, address, price, barangay, category, petFriendly, allowedPets, occupancy, parking, rules, landmarks, numberOfRooms, areaSqm, latitude, longitude } = req.body;

            if (!title || !description || !address || !price || !barangay || !category) {
                return res.status(400).json({ error: "All required fields must be filled" });
            }

            const landlord = req.user.id;

            // Verification gating (temporarily disabled if feature flag set)
            if (process.env.DISABLE_VERIFICATION !== 'true') {
                if (req.user.role === 'landlord') {
                    if (req.user.landlordVerified === false || req.user.landlordVerified === undefined) {
                        const { default: User } = await import('../models/User.js');
                        const landlordUser = await User.findById(landlord).select('landlordVerified');
                        if (!landlordUser || !landlordUser.landlordVerified) {
                            return res.status(403).json({ error: 'Landlord not verified. Please upload required IDs and wait for admin approval.' });
                        }
                    } else if (!req.user.landlordVerified) {
                        return res.status(403).json({ error: 'Landlord not verified. Please upload required IDs and wait for admin approval.' });
                    }
                }
            } // else bypass verification

            const images = (req.files?.images || []).map(file => `/uploads/properties/${file.filename}`);
            let video = '';
            if (req.files?.video && req.files.video.length) {
                video = `/uploads/properties/${req.files.video[0].filename}`;
            }
            // Handle panorama360 upload
            let panorama360 = '';
            if (req.files?.panorama360 && req.files.panorama360.length) {
                panorama360 = `/uploads/properties/${req.files.panorama360[0].filename}`;
            }
            if (images.length > MAX_IMAGES) {
                return res.status(400).json({ error: `Maximum of ${MAX_IMAGES} images exceeded` });
            }

            const allowedAvailability = ['Available','Fully Occupied','Not Yet Ready'];

            // ensure availabilityStatus defaults to 'Available' unless explicitly set by landlord to a valid option
            const availabilityStatus = (req.body.availabilityStatus && allowedAvailability.includes(req.body.availabilityStatus)) ? req.body.availabilityStatus : 'Available';

            const newProperty = new Property({
                landlord,
                title,
                description,
                address,
                price: num(price),
                barangay,
                category,
                petFriendly: petFriendly === 'true' || petFriendly === true,
                allowedPets,
                occupancy: num(occupancy, 1),
                parking: parking === 'true' || parking === true,
                rules,
                landmarks,
                numberOfRooms: num(numberOfRooms, 0),
                areaSqm: num(areaSqm, 0),
                images,
                video,
                panorama360,
                latitude: latitude ? Number(latitude) : null,
                longitude: longitude ? Number(longitude) : null,
                status: 'approved', // auto-approved to avoid admin bottleneck
                availabilityStatus
            });

            await newProperty.save();
            const responseProperty = {
                ...newProperty._doc,
                images: formatImagePaths(req, newProperty.images),
                video: toAbsolute(req, newProperty.video),
                panorama360: toAbsolute(req, newProperty.panorama360)
            };
            res.status(201).json({ message: "Property added successfully!", property: responseProperty });

        } catch (error) {
            console.error("Add Property Error:", error);
            res.status(500).json({ error: "Server error while adding property" });
        }
    });
};

// 🏡 Get All Properties
export const getAllProperties = async (req, res) => {
    try {
        const properties = await Property.find().populate('landlord', 'fullName username profilePic address contactNumber role landlordVerified');
        // Filter out properties whose landlord is null (deleted)
        const filtered = properties.filter(property => property.landlord !== null);
        res.status(200).json(filtered.map(property => ({
            ...property._doc,
            images: formatImagePaths(req, property.images),
            video: toAbsolute(req, property.video),
            panorama360: toAbsolute(req, property.panorama360),
            latitude: property.latitude,
            longitude: property.longitude,
            landlordProfile: property.landlord ? {
                id: property.landlord._id,
                fullName: property.landlord.fullName || property.landlord.username || 'Landlord',
                username: property.landlord.username || '',
                contactNumber: property.landlord.contactNumber || '',
                address: property.landlord.address || '',
                verified: !!property.landlord.landlordVerified,
                profilePic: property.landlord.profilePic ? toAbsolute(req, `/uploads/profiles/${property.landlord.profilePic}`) : ''
            } : null
        })));
    } catch (error) {
        console.error('Get Properties Error:', error);
        if (error instanceof mongoose.Error) {
            console.error('Mongoose Error Details:', {
                message: error.message,
                name: error.name,
                stack: error.stack,
                errors: error.errors
            });
        }
        res.status(500).json({ error: 'Error fetching properties', details: error.message });
    }
};

// 🏡 Get Properties by Landlord
export const getPropertiesByLandlord = async (req, res) => {
    try {
        const properties = await Property.find({ landlord: req.user.id }).populate('landlord', 'fullName username profilePic landlordVerified contactNumber');
        res.status(200).json(properties.map(p => ({
            ...p._doc,
            images: formatImagePaths(req, p.images || []),
            video: toAbsolute(req, p.video),
            panorama360: toAbsolute(req, p.panorama360),
            landlordProfile: p.landlord ? {
                id: p.landlord._id,
                fullName: p.landlord.fullName || p.landlord.username || 'You',
                username: p.landlord.username || '',
                contactNumber: p.landlord.contactNumber || '',
                verified: !!p.landlord.landlordVerified,
                profilePic: p.landlord.profilePic ? toAbsolute(req, `/uploads/profiles/${p.landlord.profilePic}`) : ''
            } : null
        })));
    } catch (error) {
        console.error('Get Landlord Properties Error:', error);
        res.status(500).json({ error: 'Error fetching your properties' });
    }
};

// 🏡 Get Single Property
export const getProperty = async (req, res) => {
    try {
        const property = await Property.findById(req.params.id).populate('landlord', 'fullName username profilePic address contactNumber landlordVerified');
        if (!property) return res.status(404).json({ error: 'Property not found' });
        res.status(200).json({
            ...property._doc,
            images: formatImagePaths(req, property.images),
            video: toAbsolute(req, property.video),
            panorama360: toAbsolute(req, property.panorama360),
            landlordProfile: property.landlord ? {
                id: property.landlord._id,
                fullName: property.landlord.fullName || property.landlord.username || 'Landlord',
                username: property.landlord.username || '',
                contactNumber: property.landlord.contactNumber || '',
                address: property.landlord.address || '',
                verified: !!property.landlord.landlordVerified,
                profilePic: property.landlord.profilePic ? toAbsolute(req, `/uploads/profiles/${property.landlord.profilePic}`) : ''
            } : null
        });
    } catch (error) {
        console.error('Get Property Error:', error);
        res.status(500).json({ error: 'Error retrieving property' });
    }
};

// 🏡 Update Property
export const updateProperty = async (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            console.error("Multer upload error:", err);
            return res.status(400).json({ error: err.message || "Error uploading media" });
        }

        try {
            const property = await Property.findById(req.params.id);
            if (!property) {
                console.error("Property not found for update, id:", req.params.id);
                return res.status(404).json({ error: "Property not found" });
            }

            // Handle panorama360 upload/replacement/removal
            // Log incoming body and files for debugging
            console.log("UpdateProperty req.body:", req.body);
            console.log("UpdateProperty req.files:", req.files);
            let updatedPanorama = property.panorama360 || '';
            if (req.files?.panorama360 && req.files.panorama360.length) {
                // delete previous panorama if exists
                if (updatedPanorama) {
                    const prevName = updatedPanorama.split('/').pop();
                    const prevPath = path.join(process.cwd(), 'uploads/properties', prevName);
                    fs.unlink(prevPath).catch(()=>{});
                }
                updatedPanorama = `/uploads/properties/${req.files.panorama360[0].filename}`;
            }
            // Allow explicit panorama removal
            if (req.body.removePanorama === 'true' && updatedPanorama) {
                const prevName = updatedPanorama.split('/').pop();
                const prevPath = path.join(process.cwd(), 'uploads/properties', prevName);
                fs.unlink(prevPath).catch(()=>{});
                updatedPanorama = '';
            }

            if (property.landlord.toString() !== req.user.id) {
                return res.status(403).json({ error: "Unauthorized" });
            }

            let updatedImages = property.images;

            // Remove deleted images from the property
            if (req.body.deletedImages) {
                const imagesToDelete = req.body.deletedImages;
                updatedImages = updatedImages.filter(img => !imagesToDelete.includes(img.split("/").pop()));

                // Delete images from storage
                await deleteImages(imagesToDelete);
            }

            // Handle new image uploads
            if (req.files?.images && req.files.images.length > 0) {
                const newUploadedImages = req.files.images.map(file => `/uploads/properties/${file.filename}`);
                updatedImages = [...updatedImages, ...newUploadedImages];
            }
            if (updatedImages.length > MAX_IMAGES) {
                // Delete just-uploaded new images to avoid orphan files
                const overflow = updatedImages.length - MAX_IMAGES;
                const newUploaded = (req.files?.images || []).slice(-overflow);
                await deleteImages(newUploaded.map(f => f.filename));
                return res.status(400).json({ error: `Maximum of ${MAX_IMAGES} images allowed` });
            }

            // Handle video upload / replacement
            let updatedVideo = property.video || '';
            if (req.files?.video && req.files.video.length) {
                // delete previous video if exists
                if (updatedVideo) {
                    const prevName = updatedVideo.split('/').pop();
                    const prevPath = path.join(process.cwd(), 'uploads/properties', prevName);
                    fs.unlink(prevPath).catch(()=>{});
                }
                updatedVideo = `/uploads/properties/${req.files.video[0].filename}`;
            }

            // Allow explicit video removal
            if (req.body.removeVideo === 'true' && updatedVideo) {
                const prevName = updatedVideo.split('/').pop();
                const prevPath = path.join(process.cwd(), 'uploads/properties', prevName);
                fs.unlink(prevPath).catch(()=>{});
                updatedVideo = '';
            }

            // Prevent landlords from arbitrarily changing admin workflow status
            if (req.body.status) delete req.body.status;

            // Allow landlords to change availabilityStatus but validate values
            const allowedAvailability = ['Available','Fully Occupied','Not Yet Ready'];
            let availabilityStatus;
            if (req.body.availabilityStatus && allowedAvailability.includes(req.body.availabilityStatus)) {
                availabilityStatus = req.body.availabilityStatus;
            }

            const updatedData = {
                ...req.body,
                ...(availabilityStatus ? { availabilityStatus } : {}),
                price: req.body.price !== undefined ? num(req.body.price) : property.price,
                occupancy: req.body.occupancy !== undefined ? num(req.body.occupancy, 1) : property.occupancy,
                petFriendly: req.body.petFriendly !== undefined ? (req.body.petFriendly === 'true' || req.body.petFriendly === true) : property.petFriendly,
                parking: req.body.parking !== undefined ? (req.body.parking === 'true' || req.body.parking === true) : property.parking,
                numberOfRooms: req.body.numberOfRooms ? num(req.body.numberOfRooms, 0) : (property.numberOfRooms || 0),
                areaSqm: req.body.areaSqm ? num(req.body.areaSqm, 0) : (property.areaSqm || 0),
                images: updatedImages,
                video: updatedVideo,
                panorama360: updatedPanorama
            };

            const updatedProperty = await Property.findByIdAndUpdate(req.params.id, updatedData, { new: true });

            res.json({
                ...updatedProperty._doc,
                images: formatImagePaths(req, updatedProperty.images),
                video: toAbsolute(req, updatedProperty.video),
                panorama360: toAbsolute(req, updatedProperty.panorama360)
            });
        } catch (error) {
            console.error("UpdateProperty error:", error);
            res.status(500).json({ error: error.message, stack: error.stack });
        }
    });
};

// 🛡️ Admin: update status
export const setPropertyStatus = async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
        const { id } = req.params;
        const { status } = req.body;
        const allowed = ['approved','pending','rejected','archived'];
        if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
        const property = await Property.findByIdAndUpdate(id, { status }, { new: true });
        if (!property) return res.status(404).json({ error: 'Property not found' });
        res.json({ message:'Status updated', property: {
            ...property._doc,
            images: formatImagePaths(req, property.images),
            video: toAbsolute(req, property.video)
        }});
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// 🏡 Delete Property
export const deleteProperty = async (req, res) => {
    try {
        const property = await Property.findById(req.params.id);
        if (!property) return res.status(404).json({ error: "Property not found" });

        if (property.landlord.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: "Unauthorized" });
        }

        // Remove images asynchronously
        await deleteImages(property.images);
        // Remove video if exists
        if (property.video) {
            const videoPath = path.join(process.cwd(), 'uploads/properties', property.video.split('/').pop());
            fs.unlink(videoPath).catch(()=>{});
        }

        await property.deleteOne();
        res.status(200).json({ message: "Property deleted successfully" });

    } catch (error) {
        console.error("Delete Property Error:", error);
        res.status(500).json({ error: "Error deleting property" });
    }
};