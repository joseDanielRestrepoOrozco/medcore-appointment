export interface UserPayload {
  id: string;
  fullname: string;
  role: string;
  status: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}
