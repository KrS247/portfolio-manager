const express = require('express');
const router = express.Router();

router.use('/auth',        require('./auth'));
router.use('/portfolios',  require('./portfolios'));
router.use('/programs',    require('./programs'));
router.use('/projects',    require('./projects'));
router.use('/tasks',       require('./tasks'));
router.use('/users',       require('./users'));
router.use('/roles',       require('./roles'));
router.use('/permissions', require('./permissions'));
router.use('/risks',       require('./risks'));
router.use('/teams',       require('./teams'));
router.use('/clickup',     require('./clickup'));

module.exports = router;
