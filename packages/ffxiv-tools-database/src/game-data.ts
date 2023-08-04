/**
 * 游戏数据相关类型定义
 */

/**
 * 游戏数据字段描述
 */
export interface GameDataField<T> {
  key: keyof T
  type?: string
}

/**
 * 游戏数据记录
 */
export interface GameDataRecord<T> {
  id: number
  data: T
}

/**
 * 游戏数据
 */
export interface GameData<T> {
  fields: GameDataField<T>[]
  records: AsyncIterableIterator<GameDataRecord<T>>
}

/**
 * 部分游戏数据的类型定义
 */
export type GameDataType = {
  /**
   * 物品
   */
  'Item': {
    'Name': string
  }

  // 其他未定义的数据类型
  [key: string]: { [key: string]: any }
}
