'use strict';

const express = require('express');
const router = express.Router();

const customerRoutes = require('./customerRoutes');
const productSizeRoutes = require('./productSizeRoutes');
const plateTypeRoutes = require('./plateTypeRoutes');
const orderRoutes = require('./orderRoutes');

// API routes
router.use('/customers', customerRoutes);
router.use('/product-sizes', productSizeRoutes);
router.use('/plate-types', plateTypeRoutes);
router.use('/orders', orderRoutes);

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'API is running' });
});

module.exports = router;
