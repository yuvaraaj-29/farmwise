const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, username, password } = req.body;
    const usernameLC = username?.trim().toLowerCase();
    const emailLC = email?.trim().toLowerCase();
    const nameClean = name?.trim();

    if (!nameClean || !emailLC || !usernameLC || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existingUser = await User.findOne({ $or: [{ username: usernameLC }, { email: emailLC }] });
    if (existingUser) {
      if (existingUser.username === usernameLC) {
        return res.status(409).json({ error: 'Username already taken.' });
      }
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const user = await User.create({ name: nameClean, email: emailLC, username: usernameLC, password });
    const token = jwt.sign({ username: user.username, id: user._id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, username: user.username, name: user.name });
  } catch (err) {
    console.error('[Auth] Register error:', err.message);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const usernameLC = username?.trim().toLowerCase();

    if (!usernameLC || !password) {
      return res.status(400).json({ error: 'Username and password required.' });
    }

    const user = await User.findOne({ username: usernameLC });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = jwt.sign({ username: user.username, id: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: user.username, name: user.name });
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    res.status(500).json({ error: 'Login failed.' });
  }
});

// GET /api/auth/verify
router.get('/verify', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ username: user.username, name: user.name });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed.' });
  }
});

module.exports = router;
