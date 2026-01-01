import { BadRequestException, Logger } from '@nestjs/common';

/**
 * Maps contract error codes to user-friendly messages
 */
const CONTRACT_ERROR_MESSAGES: Record<number, string> = {
  1: 'You are not authorized as an admin',
  2: 'Admin address cannot be zero',
  3: 'Fee account cannot be zero',
  4: 'Fee account is already set to this value',
  5: 'Only the owner can perform this action',
  6: 'You are not authorized to perform this action',
  7: 'Bounty not found on the blockchain',
  8: 'This bounty is no longer active',
  9: 'The bounty submission deadline has passed',
  10: 'The judging deadline has passed',
  11: 'Cannot modify bounty that has submissions',
  12: 'Cannot select winners before submission deadline',
  13: 'Judging deadline must be after submission deadline',
  14: 'Not enough winners selected for the distribution',
  15: 'Reward distribution percentages must sum to 100',
  16: 'Invalid deadline update - deadline cannot be in the past',
  17: 'Submission not found on the blockchain',
  18: 'Project not found on the blockchain',
  19: 'Invalid project type',
  20: 'This project is no longer active',
  21: 'Invalid milestones configuration',
  22: 'Milestone not found on the blockchain',
  23: 'This milestone has already been paid',
  24: 'Insufficient funds in escrow',
  25: 'Invalid reward amount',
  26: 'Invalid amount specified',
  27: 'The deadline has passed',
  28: 'An internal contract error occurred',
};

/**
 * Common Stellar/Soroban network error patterns
 */
const NETWORK_ERROR_PATTERNS = [
  {
    pattern: /account.*not.*found|account.*does.*not.*exist/i,
    message:
      'Account not found on the Stellar network. Please ensure the account is funded and exists.',
  },
  {
    pattern: /insufficient.*balance|not.*enough.*funds/i,
    message:
      'Insufficient balance to complete this transaction. Please add funds to your account.',
  },
  {
    pattern: /transaction.*failed|tx.*failed/i,
    message: 'Transaction failed to execute on the network. Please try again.',
  },
  {
    pattern: /timeout|timed.*out/i,
    message:
      'Transaction timed out. The network may be congested. Please try again.',
  },
  {
    pattern: /invalid.*signature/i,
    message:
      'Invalid transaction signature. Please try signing the transaction again.',
  },
  {
    pattern: /sequence.*number/i,
    message:
      'Transaction sequence number mismatch. Please refresh and try again.',
  },
  {
    pattern: /trustline.*not.*found|no.*trustline/i,
    message:
      'Trustline not found. Please add a trustline for this asset first.',
  },
  {
    pattern: /bad.*auth|authorization.*failed/i,
    message: 'Authorization failed. Please check your account permissions.',
  },
  {
    pattern: /op_under_dest_min|under.*destination.*minimum/i,
    message: 'Amount received would be less than the minimum specified.',
  },
  {
    pattern: /op_over_source_max|over.*source.*maximum/i,
    message: 'Amount to send exceeds the maximum specified.',
  },
];

export class ContractErrorHandler {
  private static readonly logger = new Logger(ContractErrorHandler.name);

  /**
   * Parse and handle contract errors with user-friendly messages
   */
  static handleContractError(error: any, context: string): never {
    this.logger.error(`Contract error in ${context}:`, error);

    // Try to extract error code from contract error
    const errorCode = this.extractErrorCode(error);
    if (errorCode !== null && CONTRACT_ERROR_MESSAGES[errorCode]) {
      throw new BadRequestException(
        `Contract error: ${CONTRACT_ERROR_MESSAGES[errorCode]}`,
      );
    }

    // Check for network/Stellar errors
    const errorString = JSON.stringify(error);
    for (const { pattern, message } of NETWORK_ERROR_PATTERNS) {
      if (pattern.test(errorString)) {
        throw new BadRequestException(`Network error: ${message}`);
      }
    }

    // Check if error has a message property
    if (error?.message) {
      const errorMessage = error.message.toLowerCase();

      // Check network patterns against message
      for (const { pattern, message } of NETWORK_ERROR_PATTERNS) {
        if (pattern.test(errorMessage)) {
          throw new BadRequestException(`Network error: ${message}`);
        }
      }

      // Return the error message if it looks user-friendly
      if (errorMessage.length < 200 && !errorMessage.includes('stack')) {
        throw new BadRequestException(`Contract error: ${error.message}`);
      }
    }

    // Default error message
    throw new BadRequestException(
      `Failed to execute contract operation in ${context}. Please try again or contact support if the issue persists.`,
    );
  }

  /**
   * Extract error code from various error formats
   */
  private static extractErrorCode(error: any): number | null {
    // Direct error code
    if (typeof error === 'number') {
      return error;
    }

    // Error object with code property
    if (error?.code !== undefined) {
      const code = Number(error.code);
      if (!isNaN(code)) {
        return code;
      }
    }

    // Error object with error property
    if (error?.error !== undefined) {
      return this.extractErrorCode(error.error);
    }

    // Soroban contract error format: { type: 'contract', code: X }
    if (error?.type === 'contract' && error?.code !== undefined) {
      const code = Number(error.code);
      if (!isNaN(code)) {
        return code;
      }
    }

    // Try to parse from string representation
    if (typeof error === 'string') {
      const match = error.match(/error.*code[:\s]+(\d+)/i);
      if (match && match[1]) {
        const code = Number(match[1]);
        if (!isNaN(code)) {
          return code;
        }
      }
    }

    // Try to parse from JSON string
    try {
      const errorString = JSON.stringify(error);
      const match = errorString.match(/"code"[:\s]+(\d+)/);
      if (match && match[1]) {
        const code = Number(match[1]);
        if (!isNaN(code)) {
          return code;
        }
      }
    } catch {
      // Ignore JSON parsing errors
    }

    return null;
  }

  /**
   * Get user-friendly error message for a specific error code
   */
  static getErrorMessage(errorCode: number): string {
    return CONTRACT_ERROR_MESSAGES[errorCode] || 'Unknown contract error';
  }

  /**
   * Check if an error is a specific contract error
   */
  static isContractError(error: any, errorCode: number): boolean {
    const extractedCode = this.extractErrorCode(error);
    return extractedCode === errorCode;
  }

  /**
   * Log contract error details for debugging
   */
  static logErrorDetails(error: any, context: string): void {
    this.logger.error(`Detailed contract error in ${context}:`, {
      error,
      errorType: typeof error,
      errorCode: this.extractErrorCode(error),
      errorString: JSON.stringify(error, null, 2),
    });
  }
}
