export class ApiError extends Error {
  status: number;
  error: string;

  constructor(error: string, message: string, status = 400) {
    super(message);
    this.status = status;
    this.error = error;
  }
}
