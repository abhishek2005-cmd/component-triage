export function errorHandler(error, _request, response, _next) {
  const statusCode = error.status || 500;
  const message = statusCode === 500 ? 'Internal server error' : error.message;

  response.status(statusCode).json({ error: message });
}