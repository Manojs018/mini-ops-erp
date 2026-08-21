export class AppError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InsufficientStockError extends AppError {
  constructor(message: string = 'Insufficient stock available') {
    super(message, 409);
  }
}

export class DuplicateTransactionError extends AppError {
  constructor(message: string = 'Transaction already processed') {
    super(message, 409);
  }
}
