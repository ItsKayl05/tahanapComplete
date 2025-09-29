import User from '../models/User.js';
import Property from '../models/Property.js'; // Assuming this is your property model

// Fetch admin dashboard stats
export const getAdminStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalProperties = await Property.countDocuments();
 

        res.json({
            totalUsers,
            totalProperties,
// ...existing code...
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch admin stats', error });
    }
};
