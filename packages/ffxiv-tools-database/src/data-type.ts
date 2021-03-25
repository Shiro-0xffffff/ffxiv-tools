/**
 * 部分数据表的数据类型定义
 */
export type DataType = {
  /**
   * 物品
   */
  'Item': {
    'Name': string
  }

  // 其他未定义的数据表数据类型
  [key: string]: { [key: string]: any }
}
