/**
 * 数据表
 */
import { type GameDataType } from './game-data'
import { getCurrentVersion } from './version'
import { loadGameDataFromCsv } from './csv'
import { loadGameDataWithCaching } from './cache'

/**
 * 数据记录
 */
export type Record<T> = T & {
  $id: number
}

/**
 * 查询条件
 */
export type Query<T> = {
  [K in keyof T]?: T[K] // TODO: 逐步完善
}

/**
 * 数据表
 */
export interface Table<T> {
  /**
   * 查询单条记录
   * @param query 查询条件
   */
  find(query?: Query<T>): Promise<Record<T> | undefined>

  /**
   * 根据 ID 查询单条记录
   * @param id 要查询的 ID
   */
  findById(id: number): Promise<Record<T> | undefined>

  /**
   * 查询所有满足条件的记录
   * @param query 查询条件
   */
  findAll(query?: Query<T>): Promise<Record<T>[]>

  /**
   * 查询所有满足条件的记录数量
   * @param query 查询条件
   */
  count(query?: Query<T>): Promise<number>
}

/**
 * 将数据查询解析为判断函数
 * @param query 查询条件
 * @returns 解析得到的判断函数
 */
function parseQuery<T> (query?: Query<T>): (record: Record<T>) => boolean {
  return (record: Record<T>) => {
    if (query === undefined) return true
    for (const key in query) {
      if (record[key] !== query[key]) return false // TODO: 逐步完善
    }
    return true
  }
}

/**
 * 加载数据表
 * @param tableName 数据表名
 * @returns 数据表
 */
export function loadTable<N extends keyof GameDataType & string> (tableName: N): Table<GameDataType[N]> {
  type T = GameDataType[N]

  const version = getCurrentVersion()

  const memStore = new Map<number, Record<T>>()

  const loadingPromise = (async () => {
    const { records: gameDataRecords } = await loadGameDataWithCaching(version, tableName, async () => await loadGameDataFromCsv(version, tableName))
    for await (const { id, data } of gameDataRecords) {
      memStore.set(id, { ...data, $id: id })
    }
  })()

  async function find (query?: Query<T>): Promise<Record<T> | undefined> {
    await loadingPromise
    const filterFunc = parseQuery(query)
    for (const [, record] of memStore) {
      if (filterFunc(record)) return record
    }
    return undefined
  }

  async function findById (id: number): Promise<Record<T> | undefined> {
    await loadingPromise
    const record = memStore.get(id)
    return record
  }

  async function findAll (query?: Query<T>): Promise<Record<T>[]> {
    await loadingPromise
    const filterFunc = parseQuery(query)
    const records: Record<T>[] = []
    for (const [, record] of memStore) {
      if (filterFunc(record)) records.push(record)
    }
    return records
  }

  async function count (query?: Query<T>): Promise<number> {
    await loadingPromise
    const filterFunc = parseQuery(query)
    let count: number = 0
    for (const [, record] of memStore) {
      if (filterFunc(record)) count++
    }
    return count
  }

  return {
    find,
    findById,
    findAll,
    count,
  }
}
