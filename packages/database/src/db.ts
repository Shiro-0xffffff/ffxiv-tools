/**
 * 本地数据库存储
 */
import { type GameDataRecord } from './game-data'
import { buffer } from './utils'

/**
 * 游戏数据表对应的数据库名
 */
const dbName = (version: string, tableName: string): string => (
  `ffxiv-tools-database/ffxiv-data/${version}/${tableName}`
)

/**
 * 检查数据库是否存在
 */
async function isDBExists (dbName: string): Promise<boolean> {
  const dbs = await window.indexedDB.databases()
  return dbs.some(({ name }) => name === dbName)
}

/**
 * 打开数据库
 */
async function openDB (dbName: string): Promise<IDBDatabase> {
  const dbOpenRequest = window.indexedDB.open(dbName)

  dbOpenRequest.addEventListener('upgradeneeded', () => {
    const db = dbOpenRequest.result
    db.createObjectStore('data')
  })

  return await doOperation(dbOpenRequest)
}

/**
 * 删除数据库
 */
async function deleteDB (dbName: string): Promise<void> {
  const dbOpenRequest = window.indexedDB.deleteDatabase(dbName)
  await doOperation(dbOpenRequest)
}

/**
 * 封装数据库事务为 Promise
 */
async function transaction<R> (db: IDBDatabase, mode: 'readonly' | 'readwrite', operations: (objectStore: IDBObjectStore) => Promise<R>): Promise<R> {
  const transaction = db.transaction('data', mode)

  const transactionPromise = new Promise<void>((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve())
    transaction.addEventListener('error', () => reject(transaction.error))
  })

  const result = await operations(transaction.objectStore('data'))
  await transactionPromise
  return result
}

/**
 * 封装对数据库的操作为 Promise
 */
async function doOperation<T> (request: IDBRequest<T>): Promise<T> {
  return await new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result))
    request.addEventListener('error', () => reject(request.error))
  })
}

/**
 * 封装对数据集进行全遍历的异步迭代器
 */
async function * objectStoreToAsyncIterable<K extends IDBValidKey, V> (objectStore: IDBObjectStore): AsyncIterableIterator<{ key: K, value: V }> {
  let onSuccess: ((cursor: IDBCursorWithValue | null) => void) | undefined
  let onError: ((err: DOMException) => void) | undefined

  const cursorOpenRequest = objectStore.openCursor()

  cursorOpenRequest.addEventListener('success', () => {
    onSuccess?.(cursorOpenRequest.result)
  })
  cursorOpenRequest.addEventListener('error', () => {
    onError?.(cursorOpenRequest.error!)
  })

  while (true) {
    const cursor = await new Promise<IDBCursorWithValue | null>((resolve, reject) => {
      onSuccess = cursor => resolve(cursor)
      onError = err => reject(err)
    })
    if (cursor === null) return
    const { key, value } = cursor
    yield { key: key as K, value }
    cursor.continue()
  }
}

/**
 * 从数据库读取游戏数据的数据流
 */
export async function * readRecordsFromDB<T> (version: string, tableName: string): AsyncIterableIterator<GameDataRecord<T>> {

  // 打开数据库
  const db = await openDB(dbName(version, tableName))

  // 逐条读数据库内数据并生产异步迭代器
  const bufferedRecords = await transaction(db, 'readonly', async objectStore => {
    const records = (async function * (): AsyncIterableIterator<GameDataRecord<T>> {
      for await (const { key, value } of objectStoreToAsyncIterable<number, T>(objectStore)) {
        yield { id: key, data: value }
      }
    })()

    // 对异步迭代器进行缓冲
    // 这里需要将数据一次性遍历完，因为如果遍历过程不能在一个 tick 内完成，会由于 DB 事务过期导致报错
    const bufferedRecords = await buffer(records)
    return bufferedRecords
  })

  yield * bufferedRecords
}

/**
 * 向数据库写入游戏数据的数据流
 */
export async function writeRecordsToDB<T> (version: string, tableName: string, records: AsyncIterableIterator<GameDataRecord<T>>): Promise<void> {

  // 如果数据库存在，删掉重新建
  if (await isDBExists(dbName(version, tableName))) {
    await deleteDB(dbName(version, tableName))
  }

  // 打开数据库
  const db = await openDB(dbName(version, tableName))

  // 对异步迭代器进行缓冲
  // 这里需要将数据一次性写完，因为如果写数据过程不能在一个 tick 内完成，会由于 DB 事务过期导致报错
  const bufferedRecords = await buffer(records)

  // 逐条将数据写入数据库
  await transaction(db, 'readwrite', async objectStore => {
    for (const { id, data } of bufferedRecords) {
      await doOperation(objectStore.put(data, id))
    }
  })
}
