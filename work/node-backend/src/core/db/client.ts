import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { env } from '@/core/env.js'

let rawClient: DynamoDBClient | null = null
let docClient: DynamoDBDocumentClient | null = null

export function getRawClient(): DynamoDBClient {
  if (!rawClient) {
    rawClient = new DynamoDBClient({
      region: env('AWS_REGION') ?? 'us-east-1',
      ...(env('DYNAMO_ENDPOINT') ? { endpoint: env('DYNAMO_ENDPOINT') } : {}),
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
