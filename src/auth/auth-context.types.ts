import { Request } from 'express';

export type AuthContext = {
  clientScope: string;
};

export type RequestWithAuthContext = Request & {
  authContext?: AuthContext;
};
