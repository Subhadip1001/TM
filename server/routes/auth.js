import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import verifyToken from '../middleware/verifyToken.js';

const router = express.Router();

router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const normalizedEmail = (email || '').trim().toLowerCase();

        const gmailRegex = /^[a-z0-9][a-z0-9._%+-]*@gmail\.com$/;
        if (!gmailRegex.test(normalizedEmail)) {
            return res.status(400).json({ error: 'A valid Gmail address (@gmail.com) is required' });
        }

        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) return res.status(400).json({ error: 'Email already exists' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({ username, email: normalizedEmail, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ token, user: { id: user._id, username: user.username, email: user.email } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Google OAuth Login & Auto-Signup
router.post('/google', async (req, res) => {
    try {
        const { idToken, accessToken, userInfo } = req.body;
        let email = '';
        let name = '';

        // 1. Verify and extract user details from Google tokens
        if (idToken) {
            // Verify via Google tokeninfo
            const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
            if (verifyRes.ok) {
                const tokenData = await verifyRes.json();
                email = tokenData.email;
                name = tokenData.name || tokenData.given_name || '';
            }
        }

        // Fallback to accessToken via userinfo endpoint if idToken was not used or expired
        if (!email && accessToken) {
            const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (userinfoRes.ok) {
                const data = await userinfoRes.json();
                email = data.email;
                name = data.name || data.given_name || '';
            }
        }

        // Direct fallback if userInfo was sent and verified
        if (!email && userInfo?.email) {
            email = userInfo.email;
            name = userInfo.name || '';
        }

        const normalizedEmail = (email || '').trim().toLowerCase();
        if (!normalizedEmail) {
            return res.status(400).json({ error: 'Failed to verify Google account email' });
        }

        // 2. Check if user already exists
        let user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            // New user: auto create account with Google (no password required)
            let baseUsername = (name || normalizedEmail.split('@')[0])
                .replace(/[^a-zA-Z0-9_]/g, '')
                .trim();
            if (!baseUsername || baseUsername.length < 3) {
                baseUsername = 'user_' + Math.floor(1000 + Math.random() * 9000);
            }

            // Ensure unique username
            let finalUsername = baseUsername;
            let counter = 1;
            while (await User.findOne({ username: finalUsername })) {
                finalUsername = `${baseUsername}${counter++}`;
            }

            user = new User({
                username: finalUsername,
                email: normalizedEmail,
                authProvider: 'google',
                banks: []
            });
            await user.save();
        }

        // 3. Generate 7-day JWT token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({
            token,
            user: { id: user._id, username: user.username, email: user.email },
            isNewUser: !user.createdAt || (Date.now() - new Date(user.createdAt).getTime() < 5000)
        });
    } catch (err) {
        console.error('Google Auth Route Error:', err);
        res.status(500).json({ error: 'Google authentication failed: ' + err.message });
    }
});

// Get user profile
router.get('/me', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.status(200).json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Change password
router.put('/password', verifyToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Incorrect current password' });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.status(200).json({ message: 'Password updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a bank
router.post('/bank', verifyToken, async (req, res) => {
    try {
        const { name, amount } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        user.banks.push({ name, amount: parseFloat(amount) });
        await user.save();

        res.status(201).json(user.banks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Edit a bank
router.put('/bank/:id', verifyToken, async (req, res) => {
    try {
        const { name, amount } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const bank = user.banks.id(req.params.id);
        if (!bank) return res.status(404).json({ error: 'Bank not found' });

        if (name) bank.name = name;
        if (amount !== undefined) bank.amount = parseFloat(amount);
        await user.save();

        res.status(200).json(user.banks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a bank
router.delete('/bank/:id', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        user.banks.pull({ _id: req.params.id });
        await user.save();

        res.status(200).json(user.banks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
