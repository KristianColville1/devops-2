import { Controller, Get } from '@/core/http/routing/decorators.js'
import { BaseController } from '@/core/http/BaseController.js'
import { env } from '@/core/env.js'
import { hostname } from 'node:os'

@Controller('system')
export class SystemController extends BaseController {
  @Get('/whoami')
  async whoami() {
    return {
      ok: true,
      hostname: hostname(),
      pid: process.pid,
      instanceId: env('EC2_INSTANCE_ID') ?? hostname(),
      az: env('EC2_AZ') ?? 'local',
    }
  }
}
