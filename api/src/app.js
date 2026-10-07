import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import healthRoutes from './routes/healthRoutes.js';
import categoriesRoutes from './routes/categoriesRoutes.js';
import requestsRoutes from './routes/requestsRoutes.js';
import statusRoutes from './routes/statusRoutes.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', apiRateLimiter);
app.use('/api', healthRoutes);
app.use('/api', categoriesRoutes);
app.use('/api', requestsRoutes);
app.use('/api', statusRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;