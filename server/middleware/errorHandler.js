// Centralized error handler — always last middleware in Express
const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    error:   err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

// 404 handler
const notFound = (req, res) => {
  res.status(404).json({ success: false, error: `Route not found: ${req.path}` });
};

module.exports = { errorHandler, notFound };
