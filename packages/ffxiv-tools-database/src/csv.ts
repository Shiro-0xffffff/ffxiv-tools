/**
 * CSV 数据文件处理
 */
import { GameData, GameDataField, GameDataRecord, GameDataType } from './game-data'

/**
 * CSV 数据文件路径
 */
const csvDataFilePath = (version: string, path: string) => (
  `https://raw.githubusercontent.com/Shiro-0xffffff/ffxiv-data/${version}/data/${path}`
)

/**
 * 将可读流转化为可异步遍历的对象
 */
function readableStreamToAsyncIterable<R = any> (stream: ReadableStream<R>): AsyncIterable<R> {
  return {
    async * [Symbol.asyncIterator] () {
      const reader = stream.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) return
          yield value
        }
      } finally {
        reader.releaseLock()
      }
    }
  }
}

/**
 * 按块读取 CSV 数据文件
 */
function readCsvDataFile (version: string, path: string): AsyncIterable<string> {
  return {
    async * [Symbol.asyncIterator] () {
      const res = await fetch(csvDataFilePath(version, path))
      if (!res.body) throw new Error('read data failed')
      const asyncIterableResBody = readableStreamToAsyncIterable(res.body)
      const decoder = new TextDecoder()
      for await (const chunk of asyncIterableResBody) {
        yield decoder.decode(chunk)
      }
    }
  }
}

// Node 读本地版本，备用
// import { createReadStream } from 'fs'
// import { resolve, join } from 'path'
// function readCsvDataFile (version: string, path: string): AsyncIterable<string> {
//   const dataPath = resolve(__dirname, `../../../../ffxiv-data/${version}/data/${path}`)
//   return {
//     [Symbol.asyncIterator] () {
//       const stream = createReadStream(join(dataPath, version, path), { encoding: 'utf8' })
//       return stream[Symbol.asyncIterator]()
//     }
//   }
// }

// Node 读远端版本，备用
// 请求内容暂未缓存
// import { get } from 'https'
// import { Readable } from 'stream'
// function readCsvDataFile (version: string, path: string): AsyncIterable<string> {
//   return {
//     async * [Symbol.asyncIterator] () {
//       const stream = await new Promise<Readable>(resolve => {
//         get(csvDataFilePath(version, path), res => resolve(res))
//       })
//       yield* stream[Symbol.asyncIterator]()
//     }
//   }
// }

/**
 * 分割字符串，但是保留成对引号中的内容（即引号中间有分隔符也不会被截断）
 */
function splitStringWithQuotesPreserved (string: string, separator: string): string[] {
  return string.split(separator).reduce((segments, segment) => {
    const prevSegment = segments[segments.length - 1] ?? ''
    const quoteClosed = (prevSegment.match(/(?<!\\)"/g) ?? []).length % 2 === 0
    if (quoteClosed) {
      segments.push(segment)
    } else {
      segments[segments.length - 1] += separator + segment
    }
    return segments
  }, [] as string[])
}

/**
 * 按行读取 CSV 数据文件
 */
function readCsvDataFileByLine (version: string, path: string, lineSeparator: string = '\n'): AsyncIterable<string> {
  return {
    async * [Symbol.asyncIterator] () {
      const fileContent = await readCsvDataFile(version, path)
      let buffer = ''
      for await (const chunk of fileContent) {
        buffer += chunk
        const lines = splitStringWithQuotesPreserved(buffer, lineSeparator)
        for (const line of lines.slice(0, -1)) if (line) yield line
        buffer = lines[lines.length - 1]
      }
      if (buffer) yield buffer
    }
  }
}

/**
 * 解析 CSV 单元格数据
 */
function parseCsvCellContent (content: string): string | number | boolean | null {
  // 无内容，解析为 null
  if (!content) return null

  // 数字类型，出于性能考虑只有当内容长度少于 16 位，才考虑解析为数字数字类型
  if (content.length <= 16 && !isNaN(Number(content))) return Number(content)

  // 字符串类型，需要对转义过的字符进行解码
  if (content.match(/^"(.|\s)*"$/)) return content.slice(1, -1).replace(/\\./g, char => ({ '\\n': '\n' }[char] ?? char[1]))

  // 布尔类型，只存在 `True` 和 `False` 两种值
  if (content === 'True' || content === 'False') return content === 'True'
  
  // 其他未知的类型
  return null
}

/**
 * 从 CSV 读取游戏数据
 */
export async function loadGameDataFromCsv<N extends keyof GameDataType & string> (version: string, tableName: N): Promise<GameData<GameDataType[N]>> {
  type T = GameDataType[N]

  // 按行读取 CSV 数据文件的异步迭代器
  const lines = readCsvDataFileByLine(version, `rawexd/${tableName}.csv`)
  const linesIterator = lines[Symbol.asyncIterator]()

  // 读取数据表表头下标行
  const indicesHeaderLine = await linesIterator.next()
  if (indicesHeaderLine.done) throw new Error('indices missing')
  const fields: GameDataField<T>[] = indicesHeaderLine.value.split(',').slice(1).map(() => ({ key: '' as keyof T }))

  // 读取数据表表头字段行
  const keysHeaderLine = await linesIterator.next()
  if (keysHeaderLine.done) throw new Error('keys missing')
  keysHeaderLine.value.split(',').slice(1).forEach((cellContent, index) => {
    fields[index].key = cellContent as keyof T
  })

  // 读取数据表表头类型行
  const typesHeaderLine = await linesIterator.next()
  if (typesHeaderLine.done) throw new Error('types missing')
  typesHeaderLine.value.split(',').slice(1).forEach((cellContent, index) => {
    fields[index].type = cellContent
  })

  // 关闭异步迭代器以解除占用，以便后面读取数据行
  await linesIterator.return!()

  // 用于读取数据行的异步生成器
  const records: AsyncIterable<GameDataRecord<T>> = {
    async * [Symbol.asyncIterator] () {
      // 每次被遍历时重新获取异步迭代器，并跳过前 3 行的元数据行
      const linesIterator = lines[Symbol.asyncIterator]()
      for (let lineNumber = 0; lineNumber < 3; lineNumber++) await linesIterator.next()

      // 逐行解析剩下的数据行生成数据
      const restLines = { [Symbol.asyncIterator]: () => linesIterator }
      for await (const dataRowContent of restLines) {
        const dataRowCells = splitStringWithQuotesPreserved(dataRowContent, ',')
    
        const id = Number(dataRowCells[0])
        const fieldsData = dataRowCells.slice(1).map(cellContent => parseCsvCellContent(cellContent) as T[keyof T])
  
        const data: T = {}
        fieldsData.forEach((fieldData, index) => {
          const key = fields[index].key || `$${index}` as keyof T
          data[key] = fieldData
        })
    
        yield { id, data }
      }
    }
  }

  return { fields, records }
}
