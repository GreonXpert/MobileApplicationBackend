// routes/setupRoutes.js
const express = require('express');
const { ensureInitialUsers } = require('../controllers/setupController');

const router = express.Router();

/**
 * POST /api/setup/init
 * Optional manual trigger (recommended to protect with a key)
 */
router.post('/init', async (req, res) => {
  try {
    // Simple protection (add SETUP_KEY in .env if you want)
    const key = req.headers['x-setup-key'];
    if (process.env.SETUP_KEY && key !== process.env.SETUP_KEY) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    await ensureInitialUsers();
    res.json({ success: true, message: 'Initial users ensured.' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
