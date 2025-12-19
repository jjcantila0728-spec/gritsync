import { pgTable, uuid, varchar, text, boolean, timestamp, integer, decimal, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const userRoleEnum = pgEnum('user_role', ['client', 'admin']);
export const applicationStatusEnum = pgEnum('application_status', ['pending', 'in_progress', 'submitted', 'approved', 'rejected', 'completed', 'cancelled', 'initiated']);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'pending_approval', 'paid', 'completed', 'failed', 'cancelled', 'refunded']);
export const employmentTypeEnum = pgEnum('employment_type', ['full-time', 'part-time', 'contract', 'temporary', 'internship']);
export const donationStatusEnum = pgEnum('donation_status', ['pending', 'completed', 'failed', 'refunded']);
export const sponsorshipStatusEnum = pgEnum('sponsorship_status', ['pending', 'under_review', 'approved', 'rejected', 'awarded']);
export const testimonialStatusEnum = pgEnum('testimonial_status', ['pending', 'approved', 'rejected', 'featured']);
export const careerApplicationStatusEnum = pgEnum('career_application_status', ['pending', 'under_review', 'forwarded', 'interviewed', 'accepted', 'rejected']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password_hash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('client'),
  first_name: varchar('first_name', { length: 255 }),
  last_name: varchar('last_name', { length: 255 }),
  grit_id: varchar('grit_id', { length: 50 }).unique(),
  avatar_path: text('avatar_path'),
  default_avatar_design: text('default_avatar_design'),
  email_verified: boolean('email_verified').default(false),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const sessions = pgTable('sessions', {
  sid: varchar('sid', { length: 255 }).primaryKey(),
  sess: jsonb('sess').notNull(),
  expire: timestamp('expire').notNull(),
});

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  used: boolean('used').default(false),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const settings = pgTable('settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: varchar('key', { length: 255 }).notNull().unique(),
  value: text('value'),
  description: text('description'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const applications = pgTable('applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').references(() => users.id),
  applicant_name: varchar('applicant_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  service_type: varchar('service_type', { length: 100 }).notNull(),
  state_of_application: varchar('state_of_application', { length: 100 }),
  status: varchar('status', { length: 50 }).default('pending'),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const applicationTimelineSteps = pgTable('application_timeline_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  application_id: uuid('application_id').references(() => applications.id, { onDelete: 'cascade' }),
  step_key: varchar('step_key', { length: 100 }).notNull(),
  step_name: varchar('step_name', { length: 255 }),
  status: varchar('status', { length: 50 }).default('pending'),
  data: jsonb('data').default('{}'),
  completed_at: timestamp('completed_at'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const applicationPayments = pgTable('application_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  application_id: uuid('application_id').references(() => applications.id, { onDelete: 'cascade' }),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 10 }).default('USD'),
  payment_type: varchar('payment_type', { length: 50 }),
  status: varchar('status', { length: 30 }).default('pending'),
  stripe_payment_intent_id: varchar('stripe_payment_intent_id', { length: 255 }),
  payment_method: varchar('payment_method', { length: 50 }),
  paid_at: timestamp('paid_at', { withTimezone: true }),
  proof_url: text('proof_url'),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  application_id: uuid('application_id').references(() => applications.id),
  type: varchar('type', { length: 50 }).default('general'),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  read: boolean('read').default(false),
  created_at: timestamp('created_at').defaultNow(),
});

export const userPreferences = pgTable('user_preferences', {
  user_id: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  email_notifications_enabled: boolean('email_notifications_enabled').default(true),
  email_timeline_updates: boolean('email_timeline_updates').default(true),
  email_status_changes: boolean('email_status_changes').default(true),
  email_payment_updates: boolean('email_payment_updates').default(true),
  email_general_notifications: boolean('email_general_notifications').default(true),
  two_factor_enabled: boolean('two_factor_enabled').default(false),
  two_factor_secret: varchar('two_factor_secret', { length: 255 }),
  two_factor_backup_codes: jsonb('two_factor_backup_codes'),
  two_factor_verified_at: timestamp('two_factor_verified_at'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const quotations = pgTable('quotations', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').references(() => users.id),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 30 }).default('pending'),
  service: varchar('service', { length: 100 }),
  state: varchar('state', { length: 100 }),
  payment_type: varchar('payment_type', { length: 30 }),
  line_items: jsonb('line_items'),
  client_first_name: varchar('client_first_name', { length: 255 }),
  client_last_name: varchar('client_last_name', { length: 255 }),
  client_email: varchar('client_email', { length: 255 }),
  client_mobile: varchar('client_mobile', { length: 50 }),
  validity_date: varchar('validity_date', { length: 50 }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const donations = pgTable('donations', {
  id: uuid('id').primaryKey().defaultRandom(),
  donor_name: varchar('donor_name', { length: 255 }),
  donor_email: varchar('donor_email', { length: 255 }),
  donor_phone: varchar('donor_phone', { length: 50 }),
  is_anonymous: boolean('is_anonymous').default(false),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 10 }).default('USD'),
  payment_method: varchar('payment_method', { length: 50 }),
  stripe_payment_intent_id: varchar('stripe_payment_intent_id', { length: 255 }),
  transaction_id: varchar('transaction_id', { length: 255 }),
  sponsorship_id: uuid('sponsorship_id'),
  status: varchar('status', { length: 30 }).default('pending'),
  message: text('message'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const nclexSponsorships = pgTable('nclex_sponsorships', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').references(() => users.id),
  first_name: varchar('first_name', { length: 255 }).notNull(),
  last_name: varchar('last_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  mobile_number: varchar('mobile_number', { length: 50 }).notNull(),
  date_of_birth: varchar('date_of_birth', { length: 50 }),
  country: varchar('country', { length: 100 }),
  nursing_school: varchar('nursing_school', { length: 255 }),
  graduation_date: varchar('graduation_date', { length: 50 }),
  current_employment_status: varchar('current_employment_status', { length: 100 }),
  years_of_experience: varchar('years_of_experience', { length: 50 }),
  financial_need_description: text('financial_need_description').notNull(),
  motivation_statement: text('motivation_statement').notNull(),
  how_will_this_help: text('how_will_this_help'),
  resume_path: text('resume_path'),
  transcript_path: text('transcript_path'),
  recommendation_letter_path: text('recommendation_letter_path'),
  status: varchar('status', { length: 30 }).default('pending'),
  admin_notes: text('admin_notes'),
  reviewed_by: uuid('reviewed_by').references(() => users.id),
  reviewed_at: timestamp('reviewed_at'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const partnerAgencies = pgTable('partner_agencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  logo_url: text('logo_url'),
  website_url: text('website_url'),
  contact_email: varchar('contact_email', { length: 255 }),
  contact_phone: varchar('contact_phone', { length: 50 }),
  address: text('address'),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const careers = pgTable('careers', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  requirements: text('requirements'),
  responsibilities: text('responsibilities'),
  location: varchar('location', { length: 255 }),
  employment_type: varchar('employment_type', { length: 50 }),
  salary_range: varchar('salary_range', { length: 100 }),
  department: varchar('department', { length: 100 }),
  is_active: boolean('is_active').default(true),
  is_featured: boolean('is_featured').default(false),
  application_deadline: varchar('application_deadline', { length: 50 }),
  application_instructions: text('application_instructions'),
  partner_agency_id: uuid('partner_agency_id').references(() => partnerAgencies.id),
  views_count: integer('views_count').default(0),
  applications_count: integer('applications_count').default(0),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
  created_by: uuid('created_by').references(() => users.id),
});

export const careerApplications = pgTable('career_applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').references(() => users.id),
  career_id: uuid('career_id').references(() => careers.id),
  first_name: varchar('first_name', { length: 255 }).notNull(),
  last_name: varchar('last_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  mobile_number: varchar('mobile_number', { length: 50 }).notNull(),
  date_of_birth: varchar('date_of_birth', { length: 50 }),
  country: varchar('country', { length: 100 }),
  nursing_school: varchar('nursing_school', { length: 255 }),
  graduation_date: varchar('graduation_date', { length: 50 }),
  years_of_experience: varchar('years_of_experience', { length: 50 }),
  current_employment_status: varchar('current_employment_status', { length: 100 }),
  license_number: varchar('license_number', { length: 100 }),
  license_state: varchar('license_state', { length: 100 }),
  resume_path: text('resume_path'),
  cover_letter_path: text('cover_letter_path'),
  additional_documents_path: text('additional_documents_path'),
  partner_agency_id: uuid('partner_agency_id').references(() => partnerAgencies.id),
  forwarded_to_agency_at: timestamp('forwarded_to_agency_at'),
  forwarded_email_sent: boolean('forwarded_email_sent').default(false),
  status: varchar('status', { length: 30 }).default('pending'),
  admin_notes: text('admin_notes'),
  reviewed_by: uuid('reviewed_by').references(() => users.id),
  reviewed_at: timestamp('reviewed_at'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const testimonials = pgTable('testimonials', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  location: varchar('location', { length: 255 }),
  service: varchar('service', { length: 100 }).notNull().default('NCLEX Processing'),
  testimony: text('testimony').notNull(),
  image_url: text('image_url'),
  rating: integer('rating').default(5),
  status: varchar('status', { length: 50 }).default('pending'),
  featured: boolean('featured').default(false),
  approved_at: timestamp('approved_at', { withTimezone: true }),
  approved_by: uuid('approved_by').references(() => users.id),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const emailAddresses = pgTable('email_addresses', {
  id: uuid('id').primaryKey().defaultRandom(),
  email_address: varchar('email_address', { length: 255 }).notNull().unique(),
  display_name: varchar('display_name', { length: 255 }),
  address_type: varchar('address_type', { length: 50 }).default('business'),
  is_primary: boolean('is_primary').default(false),
  is_active: boolean('is_active').default(true),
  is_verified: boolean('is_verified').default(false),
  can_send: boolean('can_send').default(true),
  can_receive: boolean('can_receive').default(true),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
  last_used_at: timestamp('last_used_at'),
});

export const emailTemplates = pgTable('email_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 500 }).notNull(),
  body_html: text('body_html').notNull(),
  body_text: text('body_text'),
  template_type: varchar('template_type', { length: 50 }).default('notification'),
  variables: jsonb('variables').default('[]'),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const emailLogs = pgTable('email_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipient_email: varchar('recipient_email', { length: 255 }).notNull(),
  recipient_name: varchar('recipient_name', { length: 255 }),
  recipient_user_id: uuid('recipient_user_id').references(() => users.id),
  subject: varchar('subject', { length: 500 }).notNull(),
  body_html: text('body_html'),
  body_text: text('body_text'),
  sender_email: varchar('sender_email', { length: 255 }),
  sender_name: varchar('sender_name', { length: 255 }),
  sent_by_user_id: uuid('sent_by_user_id').references(() => users.id),
  email_type: varchar('email_type', { length: 50 }).default('transactional'),
  email_category: varchar('email_category', { length: 100 }),
  status: varchar('status', { length: 50 }).default('pending'),
  email_provider: varchar('email_provider', { length: 50 }),
  application_id: uuid('application_id').references(() => applications.id),
  metadata: jsonb('metadata').default('{}'),
  tags: jsonb('tags').default('[]'),
  sent_at: timestamp('sent_at'),
  delivered_at: timestamp('delivered_at'),
  opened_at: timestamp('opened_at'),
  clicked_at: timestamp('clicked_at'),
  failed_at: timestamp('failed_at'),
  error_message: text('error_message'),
  error_code: varchar('error_code', { length: 50 }),
  provider_response: jsonb('provider_response'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const newsletterSubscriptions = pgTable('newsletter_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  subscription_type: varchar('subscription_type', { length: 50 }).notNull().default('visa_bulletin'),
  is_active: boolean('is_active').default(true),
  subscribed_at: timestamp('subscribed_at', { withTimezone: true }).defaultNow(),
  unsubscribed_at: timestamp('unsubscribed_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const services = pgTable('services', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  base_price_usd: decimal('base_price_usd', { precision: 10, scale: 2 }),
  base_price_php: decimal('base_price_php', { precision: 10, scale: 2 }),
  is_active: boolean('is_active').default(true),
  metadata: jsonb('metadata').default('{}'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const exchangeRates = pgTable('exchange_rates', {
  id: uuid('id').primaryKey().defaultRandom(),
  from_currency: varchar('from_currency', { length: 10 }).notNull().default('USD'),
  to_currency: varchar('to_currency', { length: 10 }).notNull().default('PHP'),
  rate: decimal('rate', { precision: 10, scale: 4 }).notNull(),
  source: varchar('source', { length: 100 }).default('manual'),
  effective_date: varchar('effective_date', { length: 50 }).notNull(),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const promoCodes = pgTable('promo_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  description: text('description'),
  discount_type: varchar('discount_type', { length: 20 }).notNull(),
  discount_value: decimal('discount_value', { precision: 10, scale: 2 }).notNull(),
  min_order_amount: decimal('min_order_amount', { precision: 10, scale: 2 }),
  max_uses: integer('max_uses'),
  current_uses: integer('current_uses').default(0),
  valid_from: timestamp('valid_from'),
  valid_until: timestamp('valid_until'),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const userDocuments = pgTable('user_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').references(() => users.id).notNull(),
  application_id: uuid('application_id').references(() => applications.id),
  filename: varchar('filename', { length: 500 }).notNull(),
  file_type: varchar('file_type', { length: 100 }),
  document_type: varchar('document_type', { length: 100 }).notNull(),
  storage_path: text('storage_path'),
  file_size: integer('file_size'),
  status: varchar('status', { length: 50 }).default('uploaded'),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const serviceRequiredDocuments = pgTable('service_required_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  service_type: varchar('service_type', { length: 100 }).notNull(),
  document_type: varchar('document_type', { length: 100 }).notNull(),
  document_name: varchar('document_name', { length: 255 }).notNull(),
  description: text('description'),
  required: boolean('required').default(true),
  sort_order: integer('sort_order').default(0),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  applications: many(applications),
  notifications: many(notifications),
  preferences: one(userPreferences),
  quotations: many(quotations),
}));

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  user: one(users, { fields: [applications.user_id], references: [users.id] }),
  timelineSteps: many(applicationTimelineSteps),
  payments: many(applicationPayments),
  notifications: many(notifications),
}));

export const applicationTimelineStepsRelations = relations(applicationTimelineSteps, ({ one }) => ({
  application: one(applications, { fields: [applicationTimelineSteps.application_id], references: [applications.id] }),
}));

export const applicationPaymentsRelations = relations(applicationPayments, ({ one }) => ({
  application: one(applications, { fields: [applicationPayments.application_id], references: [applications.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.user_id], references: [users.id] }),
  application: one(applications, { fields: [notifications.application_id], references: [applications.id] }),
}));

export const quotationsRelations = relations(quotations, ({ one }) => ({
  user: one(users, { fields: [quotations.user_id], references: [users.id] }),
}));

export const careersRelations = relations(careers, ({ one, many }) => ({
  partnerAgency: one(partnerAgencies, { fields: [careers.partner_agency_id], references: [partnerAgencies.id] }),
  applications: many(careerApplications),
}));

export const careerApplicationsRelations = relations(careerApplications, ({ one }) => ({
  user: one(users, { fields: [careerApplications.user_id], references: [users.id] }),
  career: one(careers, { fields: [careerApplications.career_id], references: [careers.id] }),
  partnerAgency: one(partnerAgencies, { fields: [careerApplications.partner_agency_id], references: [partnerAgencies.id] }),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Application = typeof applications.$inferSelect;
export type InsertApplication = typeof applications.$inferInsert;
export type ApplicationPayment = typeof applicationPayments.$inferSelect;
export type InsertApplicationPayment = typeof applicationPayments.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type Quotation = typeof quotations.$inferSelect;
export type InsertQuotation = typeof quotations.$inferInsert;
export type Donation = typeof donations.$inferSelect;
export type InsertDonation = typeof donations.$inferInsert;
export type Career = typeof careers.$inferSelect;
export type InsertCareer = typeof careers.$inferInsert;
export type CareerApplication = typeof careerApplications.$inferSelect;
export type InsertCareerApplication = typeof careerApplications.$inferInsert;
export type Testimonial = typeof testimonials.$inferSelect;
export type InsertTestimonial = typeof testimonials.$inferInsert;
export type UserDocument = typeof userDocuments.$inferSelect;
export type InsertUserDocument = typeof userDocuments.$inferInsert;
