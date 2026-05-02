import { Controller, Get } from '@/core/http/routing/decorators.js'
import { BaseController } from '@/core/http/BaseController.js'
import { NodeRepository } from '@/modules/Nodes/NodeRepository.js'

@Controller('nodes')
export class NodesController extends BaseController {
  private readonly repo = new NodeRepository()

  @Get('/')
  async list() {
    const nodes = await this.repo.listActive()
    return { ok: true, nodes }
  }
}
