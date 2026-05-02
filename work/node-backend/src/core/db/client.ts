import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { env } from '@/core/env.js'

let rawClient: DynamoDBClient | null = null
let docClient: DynamoDBDocumentClient | null = null

export function getRawClient(): DynamoDBClient {
  if (!rawClient) {
    const endpoint = env('DYNAMO_ENDPOINT')
    rawClient = new DynamoDBClient({
      region: env('AWS_REGION') ?? 'us-east-1',
      ...(endpoint ? { endpoint } : {}),
      // DynamoDB Local doesn't validate credentials; stub them out to skip the provider chain.
      ...(endpoint ? { credentials: { accessKeyId: 'local', secretAccessKey: 'local' } } : {}),
    })
  }
  return rawClient
}

export function getDocClient(): DynamoDBDocumentClient {
  if (!docClient) {
    docClient = DynamoDBDocumentClient.from(getRawClient(), {
      marshallOptions: { removeUndefinedValues: true },
    })
  }
  return docClient
}
