export class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.expose = true;
  }
}

export const badRequest = (message) => new HttpError(400, message);

export const notFound = (message) => new HttpError(404, message);

export const serviceUnavailable = (message) => new HttpError(503, message);
