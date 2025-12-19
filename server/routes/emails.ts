import { Router, Response } from 'express';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { sendEmail, sendWelcomeEmail, sendApplicationStatusEmail, sendPaymentConfirmationEmail, sendQuotationEmail, sendTestEmail, sendNewsletterEmail, sendDonationReceiptEmail, getResendClient, logSentEmail } from '../services/email';
import { db } from '../db';
import { newsletterSubscriptions, emailLogs } from '../../shared/schema';
import { eq, desc, sql, and, ilike, or } from 'drizzle-orm';

const router = Router();

router.post('/send', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { to, subject, html, text } = req.body;
    
    if (!to || !subject) {
      return res.status(400).json({ error: 'Missing required fields: to, subject' });
    }
    
    const result = await sendEmail({ to, subject, html, text });
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(502).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/welcome', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, name } = req.body;
    
    if (!email || !name) {
      return res.status(400).json({ error: 'Missing required fields: email, name' });
    }
    
    const result = await sendWelcomeEmail(email, name);
    if (result.success) {
      res.json(result);
    } else {
      res.status(502).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/application-status', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, name, status, applicationId } = req.body;
    
    if (!email || !name || !status || !applicationId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await sendApplicationStatusEmail(email, name, status, applicationId);
    if (result.success) {
      res.json(result);
    } else {
      res.status(502).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/payment-confirmation', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, name, amount, description } = req.body;
    
    if (!email || !name || !amount || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await sendPaymentConfirmationEmail(email, name, amount, description);
    if (result.success) {
      res.json(result);
    } else {
      res.status(502).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/quotation', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, name, quotationDetails } = req.body;
    
    if (!email || !name || !quotationDetails) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await sendQuotationEmail(email, name, quotationDetails);
    if (result.success) {
      res.json(result);
    } else {
      res.status(502).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/test', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, subject } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Missing required field: email' });
    }
    
    const result = await sendTestEmail(email, subject);
    if (result.success) {
      res.json(result);
    } else {
      res.status(502).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/donation-receipt', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, name, amount, donationId } = req.body;
    
    if (!email || !name || !amount || !donationId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await sendDonationReceiptEmail(email, name, amount, donationId);
    if (result.success) {
      res.json(result);
    } else {
      res.status(502).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/newsletter/send', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { subject, htmlContent, sendToAll, recipientEmails } = req.body;
    
    if (!subject || !htmlContent) {
      return res.status(400).json({ error: 'Missing required fields: subject, htmlContent' });
    }
    
    let emails: string[] = recipientEmails || [];
    
    if (sendToAll) {
      const subscribers = await db.select().from(newsletterSubscriptions).where(eq(newsletterSubscriptions.is_active, true));
      emails = subscribers.map(s => s.email);
    }
    
    if (emails.length === 0) {
      return res.status(400).json({ error: 'No recipients found' });
    }
    
    const results = await sendNewsletterEmail(emails, subject, htmlContent);
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    res.json({
      success: true,
      message: `Newsletter sent to ${successCount} recipients. ${failCount > 0 ? `${failCount} failed.` : ''}`,
      results
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/logs', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = '1', pageSize = '50', status, emailType, search, startDate, endDate } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limit = parseInt(pageSize as string, 10);
    const offset = (pageNum - 1) * limit;
    
    let whereConditions: any[] = [];
    
    if (status && status !== 'all') {
      whereConditions.push(eq(emailLogs.status, status as string));
    }
    if (emailType && emailType !== 'all') {
      whereConditions.push(eq(emailLogs.email_type, emailType as string));
    }
    if (search) {
      const searchTerm = `%${search}%`;
      whereConditions.push(
        or(
          ilike(emailLogs.recipient_email, searchTerm),
          ilike(emailLogs.subject, searchTerm),
          ilike(emailLogs.recipient_name, searchTerm)
        )
      );
    }
    if (startDate) {
      whereConditions.push(sql`${emailLogs.created_at} >= ${startDate}::timestamp`);
    }
    if (endDate) {
      whereConditions.push(sql`${emailLogs.created_at} <= ${endDate}::timestamp`);
    }
    
    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : sql`true`;
    
    const [logs, countResult] = await Promise.all([
      db.select().from(emailLogs)
        .where(whereClause)
        .orderBy(desc(emailLogs.created_at))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(emailLogs).where(whereClause)
    ]);
    
    const totalCount = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(totalCount / limit);
    
    res.json({
      data: logs,
      emails: logs,
      count: totalCount,
      page: pageNum,
      pageSize: limit,
      totalPages
    });
  } catch (error: any) {
    console.error('Error fetching email logs:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/logs/stats', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const statsResult = await db.select({
      total: sql<number>`count(*)`,
      sent: sql<number>`count(*) filter (where status = 'sent')`,
      delivered: sql<number>`count(*) filter (where status = 'delivered')`,
      failed: sql<number>`count(*) filter (where status = 'failed')`,
      bounced: sql<number>`count(*) filter (where status = 'bounced')`,
      pending: sql<number>`count(*) filter (where status = 'pending')`,
    }).from(emailLogs);
    
    const stats = statsResult[0];
    const total = Number(stats?.total || 0);
    const delivered = Number(stats?.delivered || 0);
    const failed = Number(stats?.failed || 0);
    
    res.json({
      total,
      sent: Number(stats?.sent || 0),
      delivered,
      failed,
      bounced: Number(stats?.bounced || 0),
      pending: Number(stats?.pending || 0),
      deliveryRate: total > 0 ? (delivered / total) * 100 : 0,
      failureRate: total > 0 ? (failed / total) * 100 : 0,
      avgSendTime: 0
    });
  } catch (error: any) {
    console.error('Error fetching email stats:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/logs/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const log = await db.select().from(emailLogs).where(eq(emailLogs.id, id)).limit(1);
    
    if (log.length === 0) {
      return res.status(404).json({ error: 'Email log not found' });
    }
    
    res.json(log[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/inbox', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { client } = await getResendClient();
    
    // Resend SDK returns { data, error } structure
    const result = await client.emails.list();
    
    console.log('Resend emails.list() response:', JSON.stringify(result, null, 2));
    
    if (result.error) {
      console.error('Resend API error:', result.error);
      return res.json({
        object: 'list',
        has_more: false,
        data: []
      });
    }
    
    // Transform the data to match our expected format
    const emails = result.data?.data || [];
    
    res.json({
      object: 'list',
      has_more: result.data?.has_more || false,
      data: emails
    });
  } catch (error: any) {
    console.error('Error fetching inbox emails:', error);
    res.json({
      object: 'list',
      has_more: false,
      data: []
    });
  }
});

router.post('/send-with-logging', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { to, toName, subject, html, text, emailType, emailCategory, fromName, replyTo, cc, bcc } = req.body;
    
    if (!to || !subject) {
      return res.status(400).json({ error: 'Missing required fields: to, subject' });
    }
    
    const result = await sendEmail({ to, subject, html, text });
    
    if (result.success) {
      await logSentEmail({
        recipientEmail: to,
        recipientName: toName,
        subject,
        bodyHtml: html,
        bodyText: text,
        senderEmail: fromName,
        sentByUserId: req.user?.id,
        emailType: emailType || 'manual',
        emailCategory,
        status: 'sent',
        emailProvider: 'resend'
      });
      
      res.json(result);
    } else {
      res.status(502).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
