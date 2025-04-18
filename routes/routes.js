
const express = require('express');
const router = express.Router();
const { saveCollection, getStatus, handleRedirect } = require('../controllers/collectionController');

router.post('/coleta', saveCollection);
router.get('/status/:uid', getStatus);
router.get('/redirect/:uid', handleRedirect);

module.exports = router;
