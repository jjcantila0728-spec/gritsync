import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import connectPgSimple from 'connect-pg-simple';
import { pool } from './db';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import applicationsRoutes from './routes/applications';
import paymentsRoutes from './routes/payments';
import notificationsRoutes from './routes/notifications';
import quotationsRoutes from './routes/quotations';
import donationsRoutes from './routes/donations';
import careersRoutes from './routes/careers';
import testimonialsRoutes from './routes/testimonials';
import settingsRoutes from './routes/settings';
import dashboardRoutes from './routes/dashboard';
import promoCodesRoutes from './routes/promo-codes';

const app = express();
const PORT = process.env.PORT || 3001;

const PgSession = connectPgSimple(session);

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

app.use(session({
  store: new PgSession({
    pool: pool,
    tableName: 'sessions',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'gritsync-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  },
}));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/quotations', quotationsRoutes);
app.use('/api/donations', donationsRoutes);
app.use('/api/careers', careersRoutes);
app.use('/api/testimonials', testimonialsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/promo-codes', promoCodesRoutes);

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
