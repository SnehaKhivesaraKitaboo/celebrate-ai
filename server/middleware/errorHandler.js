export function apiNotFound(req, res) {
  res.status(404).json({ error: 'Not found.' });
}

// Express identifies error middleware by its four-argument signature.
export function errorHandler(err, req, res, next) {
  if (err.publicMessage) {
    if (err.status >= 500) console.error(`Request failed: ${err.code}`);
    res.status(err.status).json({ error: err.publicMessage, code: err.code });
    return;
  }
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status >= 500) console.error('Unhandled server error:', err.name || 'Error');
  const message = status >= 500 ? 'Something went wrong. Please try again.' : 'The request could not be processed.';
  res.status(status).json({ error: message });
}
