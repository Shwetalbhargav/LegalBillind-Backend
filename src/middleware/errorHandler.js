export function errorHandler(err, req, res, _next) {
  const statusCode = Number(err.statusCode || err.status) || 500;
  const isServerError = statusCode >= 500;

  if (isServerError) {
    console.error('[API Error]', {
      method: req.method,
      path: req.originalUrl,
      message: err.message,
      stack: err.stack,
    });
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message: isServerError ? 'Internal server error' : err.message,
      statusCode,
    },
  });
}
