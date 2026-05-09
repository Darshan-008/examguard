const express = require('express');
const router = express.Router();
const { getDevices, createDevice, updateDevice, deleteDevice, toggleJammer, heartbeat } = require('../controllers/deviceController');
const { protect, adminOnly } = require('../middleware/auth');

// Public heartbeat for ESP32
router.post('/heartbeat', heartbeat);

router.use(protect);
router.get('/', getDevices);
router.post('/', adminOnly, createDevice);
router.put('/:id', adminOnly, updateDevice);
router.delete('/:id', adminOnly, deleteDevice);
router.put('/:id/jammer', protect, toggleJammer);
router.put('/:id/monitoring', protect, require('../controllers/deviceController').toggleMonitoring);

module.exports = router;
