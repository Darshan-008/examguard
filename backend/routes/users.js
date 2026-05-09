const express = require('express');
const router = express.Router();
const { getUsers, updateUser, deleteUser, getDashboardStats } = require('../controllers/userController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect, adminOnly);
router.get('/', getUsers);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);
router.get('/dashboard/stats', getDashboardStats);

module.exports = router;
