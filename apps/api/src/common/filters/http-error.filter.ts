import { ArgumentsHost, Catch, HttpException, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    host.switchToHttp().getResponse<Response>().status(status).json({
      statusCode: status,
      message: status >= 500 ? 'Internal server error' : exception instanceof HttpException ? exception.message : 'Request failed',
    });
  }
}
