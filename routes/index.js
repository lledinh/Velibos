var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/velibos', function(req, res, next) {
  res.render('index', { title: 'Velibos' });
});

module.exports = router;
