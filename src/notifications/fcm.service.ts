import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { EnvConfig } from '../config/env.config';

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private app: admin.app.App;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    try {
      const serviceAccountPath = this.configService.get<string>(
        EnvConfig.FIREBASE_SERVICE_ACCOUNT_PATH,
      );

      if (!serviceAccountPath) {
        this.logger.warn(
          'FIREBASE_SERVICE_ACCOUNT_PATH not configured. FCM notifications will be disabled.',
        );
        return;
      }

      const serviceAccount = JSON.parse(
        readFileSync(serviceAccountPath, 'utf8'),
      );

      this.app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      this.logger.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      this.logger.error(
        `Failed to initialize Firebase Admin SDK: ${error.message}`,
      );
    }
  }

  async sendToDevice(
    token: string,
    title: string,
    body: string,
    data?: any,
  ): Promise<boolean> {
    if (!this.app) {
      this.logger.warn('FCM not initialized. Skipping push notification.');
      return false;
    }

    try {
      const message: admin.messaging.Message = {
        notification: {
          title,
          body,
        },
        data: data || {},
        token,
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`Successfully sent message: ${response}`);
      return true;
    } catch (error) {
      this.logger.error(`Error sending FCM message: ${error.message}`);
      return false;
    }
  }

  async sendToMultipleDevices(
    tokens: string[],
    title: string,
    body: string,
    data?: any,
  ): Promise<{ successCount: number; failureCount: number }> {
    if (!this.app) {
      this.logger.warn('FCM not initialized. Skipping push notifications.');
      return { successCount: 0, failureCount: tokens.length };
    }

    if (tokens.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        notification: {
          title,
          body,
        },
        data: data || {},
        tokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      this.logger.log(
        `Successfully sent ${response.successCount} messages, ${response.failureCount} failed`,
      );

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      this.logger.error(
        `Error sending multicast FCM message: ${error.message}`,
      );
      return { successCount: 0, failureCount: tokens.length };
    }
  }

  async sendToTopic(
    topic: string,
    title: string,
    body: string,
    data?: any,
  ): Promise<boolean> {
    if (!this.app) {
      this.logger.warn('FCM not initialized. Skipping push notification.');
      return false;
    }

    try {
      const message: admin.messaging.Message = {
        notification: {
          title,
          body,
        },
        data: data || {},
        topic,
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`Successfully sent message to topic: ${response}`);
      return true;
    } catch (error) {
      this.logger.error(`Error sending FCM topic message: ${error.message}`);
      return false;
    }
  }

  async subscribeToTopic(tokens: string[], topic: string): Promise<boolean> {
    if (!this.app) {
      this.logger.warn('FCM not initialized. Cannot subscribe to topic.');
      return false;
    }

    try {
      const response = await admin.messaging().subscribeToTopic(tokens, topic);
      this.logger.log(
        `Successfully subscribed ${response.successCount} tokens to topic ${topic}`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Error subscribing to topic: ${error.message}`);
      return false;
    }
  }

  async unsubscribeFromTopic(
    tokens: string[],
    topic: string,
  ): Promise<boolean> {
    if (!this.app) {
      this.logger.warn('FCM not initialized. Cannot unsubscribe from topic.');
      return false;
    }

    try {
      const response = await admin
        .messaging()
        .unsubscribeFromTopic(tokens, topic);
      this.logger.log(
        `Successfully unsubscribed ${response.successCount} tokens from topic ${topic}`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Error unsubscribing from topic: ${error.message}`);
      return false;
    }
  }
}
