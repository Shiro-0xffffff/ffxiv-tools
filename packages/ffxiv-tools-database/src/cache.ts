/**
 * 数据本地缓存
 */
import { GameData } from './game-data'
import { getCachingStateFromKVStorage, getMetadataFromKVStorage, markCachingFinishedInKVStorage, markCachingStartedInKVStorage } from './kv-storage'
import { readRecordsFromDB, writeRecordsToDB } from './db'
import { duplicate } from './utils'

/**
 * 检查游戏数据是否已缓存
 */
async function isGameDataCached (version: string, tableName: string): Promise<boolean> {

  // 从键值存储中查询缓存状态
  const cachingState = getCachingStateFromKVStorage(version, tableName)

  // 如果尚未开始缓存或已完成缓存直接返回结果
  if (cachingState === 'not-started') return false
  if (cachingState === 'finished') return true

  // 如果缓存正在写入中，则等待写入完成，然后重新进行一次检查并返回结果
  // TODO: 暂时先写成 1 秒一次的轮询，需改成事件触发
  // TODO: 需考虑缓存到一半页面关闭等中断的情况，可记录开始缓存时间并检查是否超时
  await new Promise(resolve => setTimeout(resolve, 1000))
  return isGameDataCached(version, tableName)
}

/**
 * 带缓存机制读取游戏数据
 */
export async function loadGameDataWithCaching<T> (version: string, tableName: string, loadGameData: () => Promise<GameData<T>>): Promise<GameData<T>> {

  // 如果已有缓存，直接从缓存中读取数据
  if (await isGameDataCached(version, tableName)) {

    // 从键值存储中读取元数据
    const metadata = getMetadataFromKVStorage<T>(version, tableName)
  
    // 从数据库中里读取数据流
    const records = readRecordsFromDB<T>(version, tableName)
  
    return { metadata, records }

  // 如果没有缓存，从给定的数据源读取数据并存一份到缓存中
  } else {

    // 从数据源读数据，获取元数据和数据流
    const gameData = await loadGameData()
    const { metadata, records } = gameData
  
    // 将数据流拆分为两份副本，一份用来对外输出，一份用来写入缓存
    const [recordsForOutput, recordsForCaching] = duplicate(records)
  
    // 非阻塞地写入缓存
    ;(async () => {

      // 先在键值存储中标记该游戏数据开始写入缓存
      markCachingStartedInKVStorage(version, tableName, metadata)
    
      // 通过数据流将数据写入到数据库
      await writeRecordsToDB(version, tableName, recordsForCaching)
    
      // 最后在键值存储中标记该游戏数据已经写入缓存
      markCachingFinishedInKVStorage(version, tableName)
    })()
  
    return { metadata, records: recordsForOutput }
  }
}
