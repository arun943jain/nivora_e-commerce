export class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.expose = true;
  }
}

export const badRequest = (message) => new HttpError(400, message);

export const unauthorized = (message = "Authentication required.") =>
  new HttpError(401, message);

export const forbidden = (message = "You do not have permission to do that.") =>
  new HttpError(403, message);

export const notFound = (message) => new HttpError(404, message);

export const conflict = (message) => new HttpError(409, message);

export const serviceUnavailable = (message) => new HttpError(503, message);
