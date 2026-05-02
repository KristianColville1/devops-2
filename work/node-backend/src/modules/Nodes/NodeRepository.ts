import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { BaseRepository } from '@/core/db/BaseRepository.js'
import { env } from '@/core/env.js'
import type { NodeRecord } from './NodeRecord.js'

export class NodeRepository extends BaseRepository<NodeRecord> {
  protected readonly tableName = env('DYNAMO_TABLE_NODES') ?? 'devops-nodes'

  async register(node: NodeRecord): Promise<void> {
    await this.putItem(node)
  }

  async findById(instanceId: string): Promise<NodeRecord | null> {
    return this.getItem({ instanceId })
  }

  async heartbeat(
    instanceId: string,
    stats: Pick<NodeRecord, 'memoryPct' | 'cpuPct' | 'wsConnections'>,
  ): Promise<void> {
    const now = Date.now()
    await this.db.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { instanceId },
        ConditionExpression: 'attribute_exists(instanceId)',
        UpdateExpression:
          'SET lastSeen = :lastSeen, memoryPct = :memoryPct, cpuPct = :cpuPct, wsConnections = :wsConnections, expiresAt = :expiresAt',
        ExpressionAttributeValues: {
          ':lastSeen': now,
          ':memoryPct': stats.memoryPct,
          ':cpuPct': stats.cpuPct,
          ':wsConnections': stats.wsConnections,
          ':expiresAt': Math.floor(now / 1000) + 300,
        },
      }),
    )
  }

  async deregister(instanceId: string): Promise<void> {
    await this.deleteItem({ instanceId })
  }

  async listActive(): Promise<NodeRecord[]> {
    const now = Math.floor(Date.now() / 1000)
    return this.scanItems({
      FilterExpression: 'expiresAt > :now',
      ExpressionAttributeValues: { ':now': now },
    })
  }
}
