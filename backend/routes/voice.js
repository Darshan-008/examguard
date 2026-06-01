const express = require('express');
const router = express.Router();
const { processVoice, history } = require('../controllers/voiceController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect);
router.use(adminOnly);

router.post('/process', processVoice);
router.get('/history', history);

module.exports = router;
