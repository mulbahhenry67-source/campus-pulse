import { NextFunction, Request, Response } from "express";
import { AnyZodObject, ZodError } from "zod";
import { AppError } from "./errorHandler";

/** Validates req.body (or another part of the request) against a zod schema. */
export function validateBody(schema: AnyZodObject) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(formatZodError(result.error));
    }
    req.body = result.data;
    next();
  };
}

/** Validates req.query against a zod schema (coercing strings to numbers/booleans as needed). */
export function validateQuery(schema: AnyZodObject) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(formatZodError(result.error));
    }
    // Express 5 makes req.query a getter; stash parsed output separately for handlers to use.
    (req as Request & { validatedQuery?: unknown }).validatedQuery = result.data;
    next();
  };
}

function formatZodError(error: ZodError): AppError {
  const fieldErrors = error.flatten().fieldErrors;
  return new AppError(422, "VALIDATION_ERROR", "One or more fields are invalid.", fieldErrors);
}
