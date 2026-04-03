import { Response } from 'express';

interface ApiResponsePayload {
  success: boolean;
  data?: unknown;
  error?: string | null;
  message?: string | null;
}

export const sendApiResponse = (
  res: Response,
  statusCode: number,
  payload: ApiResponsePayload
): void => {
  res.status(statusCode).json({
    success: payload.success,
    data: payload.data ?? null,
    error: payload.error ?? null,
    message: payload.message ?? null,
  });
};
