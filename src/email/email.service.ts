import { Injectable, Inject, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as nodemailer from 'nodemailer';
import { cache_service } from 'src/cache/cache.module';
import { Redis } from '@upstash/redis';
import { QueuePayload } from 'src/rabbitMq/rabbitMq.model';
import * as Handlebars from 'handlebars';

interface EmailTemplate {
  template_key: string;
  content_type: string;
  subject_template: string;
  body_template: string;
  required_variables: string[];
}

interface UserProfile {
  user_id: string;
  email: string;
  name: string;
}

interface SendEmailResult {
  success: boolean;
  message_id?: string;
  error?: string;
}

@Injectable()
export class EmailServices {
  private readonly logger = new Logger(EmailServices.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly httpService: HttpService,
    @Inject(cache_service) private cacheService: Redis,
  ) {
    this.transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    this.verifyTransporter();
  }

  private async verifyTransporter(): Promise<void> {
    try {
      await this.transporter.verify();
      this.logger.log('Email transporter is ready');
    } catch (error) {
      this.logger.error('Email transporter verification failed', error);
    }
  }

  public get_cache_manager(): Redis {
    return this.cacheService;
  }

  private async fetch_template(template_key: string): Promise<EmailTemplate> {
    const cache_key = `email_template:${template_key}`;

    try {
      // Try to get from cache first
      const cache_template =
        await this.cacheService.get<EmailTemplate>(cache_key);

      if (cache_template) {
        this.logger.log(` Cache hit for template: ${template_key}`);
        return cache_template;
      }

      this.logger.log(`Fetching template from service: ${template_key}`);

      const response = await firstValueFrom(
        this.httpService.get(`/templates/${template_key}`),
      );

      const email_template: EmailTemplate = response.data;

      // Store in cache for 1 hour (3600 seconds)
      await this.cacheService.set(cache_key, email_template, { ex: 3600 });

      return email_template;
    } catch (error) {
      this.logger.error(` Failed to fetch template: ${template_key}`, error);
      throw new Error(`Template not found: ${template_key}`);
    }
  }

  private async fetch_user_profile(user_id: string): Promise<UserProfile> {
    const cache_key = `user_profile:${user_id}`;

    try {
      // Check cache first
      const cached_user = await this.cacheService.get<UserProfile>(cache_key);
      if (cached_user) {
        this.logger.log(`Cache hit for user: ${user_id}`);
        return cached_user;
      }

      // Fetch from User Service
      const response = await firstValueFrom(
        this.httpService.get(`/users/${user_id}`),
      );

      const user_profile: UserProfile = response.data;

      // Cache for 10 minutes (600 seconds)
      await this.cacheService.set(cache_key, user_profile, { ex: 600 });

      return user_profile;
    } catch (error) {
      this.logger.error(`Failed to fetch user profile: ${user_id}`, error);
      throw new Error(`User not found: ${user_id}`);
    }
  }

  private render_template(template: string, data: Record<string, any>): string {
    try {
      const compiled = Handlebars.compile(template);
      return compiled(data);
    } catch (error) {
      this.logger.error(' Template rendering failed', error);
      throw new Error('Failed to render email template');
    }
  }

  private validate_required_variables(
    required: string[],
    provided: Record<string, any>,
  ): { valid: boolean; missing: string[] } {
    const missing = required.filter(
      (variable) =>
        provided[variable] === undefined || provided[variable] === null,
    );

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  
  async process_email_job(job: QueuePayload): Promise<SendEmailResult> {
    const {
      request_id,
      user_id,
      notification_type,
      message_data,
      retry_count,
    } = job;

  

    try {
      //  Fetch the email template
      const template = await this.fetch_template(notification_type);

      //  Validate required variables
      const validation = this.validate_required_variables(
        template.required_variables,
        message_data,
      );

      if (!validation.valid) {
        const error_msg = `Missing required variables: ${validation.missing.join(', ')}`;
        this.logger.error(` ${error_msg}`);
        throw new Error(error_msg);
      }

      //  Fetch user profile to get email address
      const user = await this.fetch_user_profile(user_id);

      if (!user.email) {
        throw new Error(`User ${user_id} has no email address`);
      }

      // Render email subject and body
      const rendered_subject = this.render_template(
        template.subject_template,
        message_data,
      );

      const rendered_body = this.render_template(
        template.body_template,
        message_data,
      );

      //  Send the email
      const mail_options: nodemailer.SendMailOptions = {
        from:
          process.env.SMTP_FROM ||
          '"Notification Service" <noreply@example.com>',
        to: user.email,
        subject: rendered_subject,
        html: rendered_body,
        // Optional: Add plain text version
        text: rendered_body.replace(/<[^>]*>/g, ''), 
      };

      const info = await this.transporter.sendMail(mail_options);

      this.logger.log(`✅ Email sent successfully: ${info.messageId}`);

      // Optional: Store success in cache for tracking
      await this.cacheService.set(
        `email_sent:${request_id}`,
        {
          request_id,
          user_id,
          email: user.email,
          message_id: info.messageId,
          sent_at: new Date().toISOString(),
        },
        { ex: 86400 }, 
      );

      return {
        success: true,
        message_id: info.messageId,
      };
    } catch (error) {
      this.logger.error(` Email job failed: ${request_id}`, error);

      // Store failure for tracking
      await this.cacheService.set(
        `email_failed:${request_id}`,
        {
          request_id,
          user_id,
          error: error.message,
          retry_count,
          failed_at: new Date().toISOString(),
        },
        { ex: 86400 },
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

 
  async health_check(): Promise<{ status: string; smtp_ready: boolean }> {
    try {
      await this.transporter.verify();
      return { status: 'healthy', smtp_ready: true };
    } catch (error) {
      return { status: 'unhealthy', smtp_ready: false };
    }
  }

//    Send test email (useful for debugging)
   
  async send_test_email(to: string): Promise<SendEmailResult> {
    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject: 'Test Email from Notification Service',
        html: '<h1>Test Email</h1><p>If you received this, your email service is working!</p>',
      });

      return {
        success: true,
        message_id: info.messageId,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
