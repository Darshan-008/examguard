const express = require('express');
const router = express.Router();
const { postDetection, getLogs, getTodayStats, getAnalytics } = require('../controllers/detectionController');
const { protect } = require('../middleware/auth');

// Public endpoint for ESP32
router.post('/', postDetection);

router.use(protect);
router.get('/logs', getLogs);
router.get('/stats/today', getTodayStats);
router.get('/analytics', getAnalytics);
router.delete('/logs', require('../middleware/auth').adminOnly, require('../controllers/detectionController').clearLogs);

module.exports = router;
