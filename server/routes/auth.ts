import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db';
import { users, userPreferences, passwordResetTokens } from '../../shared/schema';
import { eq, and, gt } from 'drizzle-orm';
import { generateToken, authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../services/email';

const router = Router();

function generateGritId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'GRIT-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, first_name, last_name, role = 'client' } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await db.select().from(users).where(eq(users.email, normalizedEmail));
    
    if (existingUser.length > 0) {
      return res.status(409).json({ error: 'This email address is already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const gritId = generateGritId();

    const [newUser] = await db.insert(users).values({
      email: normalizedEmail,
      password_hash: hashedPassword,
      first_name,
      last_name,
      role,
      grit_id: gritId,
    }).returning();

    await db.insert(userPreferences).values({
      user_id: newUser.id,
    });

    const token = generateToken({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });

    // Send welcome email (don't block on email sending)
    const userName = first_name || email.split('@')[0];
    sendWelcomeEmail(normalizedEmail, userName).catch((err) => {
      console.error('Failed to send welcome email:', err);
    });

    res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        grit_id: newUser.grit_id,
        created_at: newUser.created_at,
      },
      token,
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    res.status(500).json({ error: error.message || 'Failed to create account' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    console.log('Login attempt:', { email, hasPassword: !!password, body: req.body });

    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail));

    console.log('User lookup result:', { found: !!user, email: normalizedEmail });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    console.log('Password validation:', { valid: validPassword });
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    (req.session as any).userId = user.id;
    (req.session as any).email = user.email;
    (req.session as any).role = user.role;

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        grit_id: user.grit_id,
        avatar_path: user.avatar_path,
        created_at: user.created_at,
      },
      token,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message || 'Failed to login' });
  }
});

router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const [user] = await db.select().from(users).where(eq(users.id, req.user.id));

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
      grit_id: user.grit_id,
      avatar_path: user.avatar_path,
      created_at: user.created_at,
    });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ error: error.message || 'Failed to get user' });
  }
});

router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    
    const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail));
    
    if (user) {
      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      
      // Save token to database
      await db.insert(passwordResetTokens).values({
        user_id: user.id,
        token: resetToken,
        expires_at: expiresAt,
      });
      
      // Send password reset email
      const userName = user.first_name || user.email.split('@')[0];
      sendPasswordResetEmail(user.email, userName, resetToken).catch((err) => {
        console.error('Failed to send password reset email:', err);
      });
    }
    
    // Always return success to prevent email enumeration
    res.json({ message: 'If an account exists with this email, a reset link will be sent.' });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    
    // Find valid token
    const [resetToken] = await db.select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.used, false),
          gt(passwordResetTokens.expires_at, new Date())
        )
      );
    
    if (!resetToken) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update user password
    await db.update(users)
      .set({ password_hash: hashedPassword, updated_at: new Date() })
      .where(eq(users.id, resetToken.user_id));
    
    // Mark token as used
    await db.update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.id, resetToken.id));
    
    res.json({ message: 'Password has been reset successfully' });
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

router.post('/change-password', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const [user] = await db.select().from(users).where(eq(users.id, req.user.id));

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.update(users).set({ password_hash: hashedPassword, updated_at: new Date() }).where(eq(users.id, req.user.id));

    res.json({ message: 'Password updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;
