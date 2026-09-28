import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Returns a welcome message',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Hello World!',
        },
      },
    },
  })
  getHello() {
    return this.appService.getHello();
  }

  @Get('health/ready')
  @ApiOperation({
    summary: 'Readiness check: verifies database and Redis connectivity',
  })
  @ApiResponse({ status: 200, description: 'All dependencies reachable' })
  @ApiResponse({ status: 503, description: 'A dependency is unreachable' })
  async getReadiness() {
    const result = await this.appService.getReadiness();
    if (!result.ok) {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }
}
