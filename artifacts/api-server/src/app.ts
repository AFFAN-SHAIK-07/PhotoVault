import express, { type ErrorRequestHandler, type Express } from "express";
import cors from "cors";
import multer from "multer";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { ApiError } from "./routes/sharing";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
}));
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

const errorHandler: ErrorRequestHandler = (error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }
  if (error instanceof ApiError) {
    response.status(error.status).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }
  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === "LIMIT_FILE_SIZE";
    response.status(tooLarge ? 413 : 400).json({
      error: {
        code: tooLarge ? "UPLOAD_TOO_LARGE" : "INVALID_UPLOAD",
        message: tooLarge
          ? "The uploaded file exceeds the configured size limit."
          : "The upload request is invalid.",
      },
    });
    return;
  }
  if (typeof error === "object" && error !== null && "status" in error && error.status === 400) {
    response.status(400).json({
      error: { code: "INVALID_REQUEST", message: "The request body is malformed." },
    });
    return;
  }
  const errorCode = typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "";
  const unavailable = errorCode.startsWith("08") ||
    ["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "ETIMEDOUT", "28P01", "28000", "3D000", "53300", "57P03"].includes(errorCode);
  logger.error({ err: error, method: request.method, path: request.path }, "API request failed");
  response.status(unavailable ? 503 : 500).json({
    error: {
      code: unavailable ? "DATABASE_UNAVAILABLE" : "INTERNAL_SERVER_ERROR",
      message: unavailable
        ? "The database is unavailable. Configure PostgreSQL and run the migrations."
        : "The request could not be completed.",
    },
  });
};

app.use(errorHandler);

export default app;
