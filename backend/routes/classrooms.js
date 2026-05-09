const express = require('express');
const router = express.Router();
const { getClassrooms, createClassroom, updateClassroom, deleteClassroom } = require('../controllers/classroomController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect);
router.get('/', getClassrooms);
router.post('/', adminOnly, createClassroom);
router.put('/:id', adminOnly, updateClassroom);
router.delete('/:id', adminOnly, deleteClassroom);

module.exports = router;
