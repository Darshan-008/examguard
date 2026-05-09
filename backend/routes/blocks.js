const express = require('express');
const router = express.Router();
const { getBlocks, createBlock, updateBlock, deleteBlock } = require('../controllers/blockController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect);
router.get('/', getBlocks);
router.post('/', adminOnly, createBlock);
router.put('/:id', adminOnly, updateBlock);
router.delete('/:id', adminOnly, deleteBlock);

module.exports = router;
