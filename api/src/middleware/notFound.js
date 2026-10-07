export function notFound(request, _response, next) {
  const error = new Error(`Route not found: ${request.originalUrl}`);
  error.status = 404;
  next(error);
}