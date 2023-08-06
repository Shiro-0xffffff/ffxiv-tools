/**
 * 本地键值存储
 */
import { GameDataMetaData } from './game-data'

/**
 * 游戏数据表对应的键值存储 Key
 */
const kvStorageKey = (version: string, tableName: string) => (
  `ffxiv-tools-database/ffxiv-data/${version}/${tableName}`
)

/**
 * 键值存储的内容结构
 */
interface KVStorageValue<T> {
  metadata: GameDataMetaData<T>
  cachingState: 'not-started' | 'started' | 'finished'
}

/**
 * 从键值存储读取内容
 */
function readFromKVStorage<T> (version: string, tableName: string): KVStorageValue<T> | null {
  const json = window.localStorage.getItem(kvStorageKey(version, tableName))
  let value: KVStorageValue<T> | null = null
  try { value = JSON.parse(json!) } catch {}
  return value
}

/**
 * 向键值存储写入内容
 */
function writeToKVStorage<T> (version: string, tableName: string, value: KVStorageValue<T>): void {
  const json = JSON.stringify(value)
  window.localStorage.setItem(kvStorageKey(version, tableName), json)
}

/**
 * 在键值存储中标记游戏数据开始写入缓存
 */
export function markCachingStartedInKVStorage<T> (version: string, tableName: string, metadata: GameDataMetaData<T>): void {
  writeToKVStorage(version, tableName, { metadata, cachingState: 'started' })
}

/**
 * 在键值存储中标记游戏数据已经写入缓存
 */
export function markCachingFinishedInKVStorage<T> (version: string, tableName: string): void {
  const kvStorageValue = readFromKVStorage<T>(version, tableName)
  if (!kvStorageValue || kvStorageValue.cachingState === 'not-started') throw new Error('caching not started')
  writeToKVStorage(version, tableName, { ...kvStorageValue, cachingState: 'finished' })
}

/**
 * 从键值存储获取游戏数据缓存写入状态
 */
export function getCachingStateFromKVStorage<T> (version: string, tableName: string): 'not-started' | 'started' | 'finished' {
  const kvStorageValue = readFromKVStorage<T>(version, tableName)
  if (!kvStorageValue) return 'not-started'
  return kvStorageValue.cachingState
}

/**
 * 从键值存储获取游戏数据的元数据
 */
export function getMetadataFromKVStorage<T> (version: string, tableName: string): GameDataMetaData<T> {
  const kvStorageValue = readFromKVStorage<T>(version, tableName)
  if (!kvStorageValue) throw new Error('caching not started')
  return kvStorageValue.metadata
}
