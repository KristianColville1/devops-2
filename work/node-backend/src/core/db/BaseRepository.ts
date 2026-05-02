import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  ScanCommand,
  type ScanCommandInput,
} from '@aws-sdk/lib-dynamodb'
import { getDocClient } from './client.js'

/**
 * Single class to swap DynamoDB for another store — override the protected methods here,
 * concrete repositories only contain domain logic.
 */
export abstract class BaseRepository<T extends object> {
  protected abstract readonly tableName: string

  protected get db() {
    return getDocClient()
  }

  protected async getItem(key: Record<string, unknown>): Promise<T | null> {
    const { Item } = await this.db.send(new GetCommand({ TableName: this.tableName, Key: key }))
    return (Item as T) ?? null
  }

  protected async putItem(item: T): Promise<void> {
    await this.db.send(new PutCommand({ TableName: this.tableName, Item: item }))
  }

  protected async deleteItem(key: Record<string, unknown>): Promise<void> {
    await this.db.send(new DeleteCommand({ TableName: this.tableName, Key: key }))
  }

  protected async scanItems(input?: Omit<ScanCommandInput, 'TableName'>): Promise<T[]> {
    const { Items } = await this.db.send(new ScanCommand({ ...input, TableName: this.tableName }))
    return (Items as T[]) ?? []
  }
}
