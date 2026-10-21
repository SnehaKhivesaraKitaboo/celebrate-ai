export class AppError extends Error {
  constructor(status, publicMessage, code) {
    super(publicMessage);
    this.name = 'AppError';
    this.status = status;
    this.publicMessage = publicMessage;
    this.code = code;
  }
}
