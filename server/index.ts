import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import connectPgSimple from 'connect-pg-simple';
import path from 'path';
import fs from 'fs';
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
import servicesRoutes from './routes/services';
import timelineStepsRoutes from './routes/timeline-steps';
import partnerAgenciesRoutes from './routes/partner-agencies';
import sponsorshipsRoutes from './routes/sponsorships';
import emailsRoutes from './routes/emails';
import documentsRoutes from './routes/documents';
import serviceRequiredDocumentsRoutes from './routes/service-required-documents';
import newsletterRoutes from './routes/newsletter';

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
app.use('/api/services', servicesRoutes);
app.use('/api/timeline-steps', timelineStepsRoutes);
app.use('/api/partner-agencies', partnerAgenciesRoutes);
app.use('/api/sponsorships', sponsorshipsRoutes);
app.use('/api/emails', emailsRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/service-required-documents', serviceRequiredDocumentsRoutes);
app.use('/api/newsletter', newsletterRoutes);

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const distPath = path.join(process.cwd(), 'dist');
const isProduction = process.env.NODE_ENV === 'production' || process.env.REPL_SLUG !== undefined && !process.env.npm_lifecycle_event?.includes('dev');

if (isProduction && fs.existsSync(path.join(distPath, 'index.html'))) {
  app.use(express.static(distPath));
  app.use((_req: Request, res: Response) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const serverPort = process.env.PORT ? parseInt(process.env.PORT) : PORT;

app.listen(serverPort, '0.0.0.0', () => {
  console.log(`Server running on port ${serverPort}`);
});

export default app;
