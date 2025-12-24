import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailService } from '../../email/email.service';

interface EmailJobData {
  to: string;
  subject: string;
  template: string;
  context: any;
}

@Injectable()
@Processor('email')
export class EmailWorker extends WorkerHost {
  private readonly logger = new Logger(EmailWorker.name);

  constructor(private emailService: EmailService) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<any> {
    const { to, subject, template, context } = job.data;

    this.logger.log(`Processing email job: ${subject} to ${to}`);

    try {
      await this.emailService.sendEmailDirect(to, subject, template, context);

      this.logger.log(`Email sent successfully to ${to}`);

      return {
        success: true,
        to,
        subject,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${to}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
