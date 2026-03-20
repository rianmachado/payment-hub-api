import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { RequestWithAuthContext } from '../auth-context.types';

const AUTH_TOKEN_MISSING_CODE = 'AUTH_TOKEN_MISSING';
const AUTH_TOKEN_INVALID_CODE = 'AUTH_TOKEN_INVALID';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithAuthContext>();
    const authorization = this.extractAuthorizationHeader(request);
    const normalizedAuthorization = authorization.trim();

    if (!normalizedAuthorization) {
      throw new UnauthorizedException({
        code: AUTH_TOKEN_MISSING_CODE,
        message: 'Header Authorization ausente.',
      });
    }

    if (!this.isValidBearerToken(normalizedAuthorization)) {
      throw new UnauthorizedException({
        code: AUTH_TOKEN_INVALID_CODE,
        message: 'Header Authorization invalido.',
      });
    }

    request.authContext = {
      clientScope: this.normalizeClientScope(normalizedAuthorization),
    };

    return true;
  }

  private extractAuthorizationHeader(request: Request): string {
    const headerValue = request.headers.authorization;
    const authorization = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    return authorization ?? '';
  }

  private isValidBearerToken(authorization: string): boolean {
    const [scheme, token] = authorization.split(/\s+/, 2);

    if (!scheme || scheme.toLowerCase() !== 'bearer') {
      return false;
    }

    return Boolean(token?.trim());
  }

  private normalizeClientScope(authorization: string): string {
    const [scheme, token] = authorization.split(/\s+/, 2);
    return `${scheme} ${token.trim()}`;
  }
}
