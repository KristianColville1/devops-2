import { CreateTableCommand, DescribeTableCommand, ResourceNotFoundException } from '@aws-sdk/client-dynamodb'
import { getRawClient } from './client.js'
import { env, envTruthy } from '@/core/env.js'

async function ensureTable(tableName: string): Promise<void> {
  const client = getRawClient()
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }))
  } catch (err) {
    if (!(err instanceof ResourceNotFoundException)) throw err
    await client.send(
      new CreateTableCommand({
        TableName: tableName,
        KeySchema: [{ AttributeName: 'instanceId', KeyType: 'HASH' }],
        AttributeDefinitions: [{ AttributeName: 'instanceId', AttributeType: 'S' }],
        BillingMode: 'PAY_PER_REQUEST',
      }),
    )
  }
}

export async function bootstrapDb(): Promise<void> {
  if (!envTruthy('DYNAMO_LOCAL')) return
  await ensureTable(env('DYNAMO_TABLE_NODES') ?? 'devops-nodes')
}
