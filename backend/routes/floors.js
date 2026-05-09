const express = require('express');
const router = express.Router();
const { getFloors, createFloor, updateFloor, deleteFloor } = require('../controllers/floorController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect);
router.get('/', getFloors);
router.post('/', adminOnly, createFloor);
router.put('/:id', adminOnly, updateFloor);
router.delete('/:id', adminOnly, deleteFloor);

module.exports = router;
