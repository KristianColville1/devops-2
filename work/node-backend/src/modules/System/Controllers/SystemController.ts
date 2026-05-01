import { Controller, Get } from '@/core/http/routing/decorators.js'
import { BaseController } from '@/core/http/BaseController.js'
import { hostname } from 'node:os'

/**
 * Example JSON API module — add more controllers under `src/modules/<Name>/Controllers/`.
 * `/api/v1/system/whoami` is useful later for ALB load-distribution demos (hostname / instance story).
 */
@Controller('system')
export class SystemController extends BaseController {
  @Get('/whoami')
  async whoami() {
    return {
      ok: true,
      hostname: hostname(),
      pid: process.pid,
    }
  }
}
