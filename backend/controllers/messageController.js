// Get all message threads for the current user
export const getMessageThreads = async (req, res) => {
	try {
		const myId = req.user.id;
		// Find all messages where the user is sender or receiver
		const messages = await Message.find({
			$or: [
				{ sender: myId },
				{ receiver: myId }
			]
		}).sort({ updatedAt: -1, createdAt: -1 });

		// Map to unique user IDs (other than self)
		const userMap = new Map();
		for (const msg of messages) {
			const otherId = String(msg.sender) === String(myId) ? String(msg.receiver) : String(msg.sender);
			if (!userMap.has(otherId)) {
				userMap.set(otherId, { lastMessage: msg.content, lastMessageAt: msg.createdAt });
			}
		}
		const userIds = Array.from(userMap.keys());
		if (userIds.length === 0) return res.json([]);
		// Fetch user info
		const users = await User.find({ _id: { $in: userIds } }).select('_id fullName username profilePic');
		// Merge last message info
		const result = users.map(u => ({
			_id: u._id,
			fullName: u.fullName,
			username: u.username,
			profilePic: u.profilePic,
			lastMessage: userMap.get(String(u._id)).lastMessage
		}));
		res.json(result);
	} catch (err) {
		res.status(500).json({ message: 'Error fetching message threads', error: err.message });
	}
};
import Message from '../models/Message.js';
import User from '../models/User.js';

// Send a message
export const sendMessage = async (req, res) => {
	try {
		const { receiver, content, property } = req.body;
		if (!receiver || !content) return res.status(400).json({ message: 'Receiver and content are required.' });
		const message = new Message({
			sender: req.user.id,
			receiver,
			content,
			property: property || undefined
		});
		await message.save();
		res.status(201).json(message);
	} catch (err) {
		res.status(500).json({ message: 'Error sending message', error: err.message });
	}
};

// Get chat history between two users
export const getMessages = async (req, res) => {
	try {
		const { userId } = req.params;
		const myId = req.user.id;
		const messages = await Message.find({
			$or: [
				{ sender: myId, receiver: userId },
				{ sender: userId, receiver: myId }
			]
		}).sort({ createdAt: 1 });
		res.json(messages);
	} catch (err) {
		res.status(500).json({ message: 'Error fetching messages', error: err.message });
	}
};
