/**
 * CSV 数据文件处理
 */
import { DataType } from './data-type'

/**
 * CSV 数据文件路径
 */
const csvDataFilePath = (version: string, path: string) => (
  `https://raw.githubusercontent.com/Shiro-0xffffff/ffxiv-data/${version}/data/${path}`
)

/**
 * 按块读取 CSV 数据文件
 */
async function* readCsvDataFile (version: string, path: string): AsyncIterableIterator<string> {
  const res = await fetch(csvDataFilePath(version, path))
  if (!res.body) throw new Error('read data failed')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  while (true) {
    const { value, done } = await reader.read()
    if (done) return reader.releaseLock()
    yield decoder.decode(value)
  }
}

// Node 读本地版本，备用
// import { createReadStream } from 'fs'
// import { resolve, join } from 'path'
// async function* readCsvDataFile (version: string, path: string): AsyncIterableIterator<string> {
//   const dataPath = resolve(__dirname, '../../data')
//   const stream = createReadStream(join(dataPath, version, path), { encoding: 'utf8' })
//   yield* stream[Symbol.asyncIterator]() as AsyncIterableIterator<string>
// }

// Node 读远端版本，备用
// import { get } from 'https'
// import { Readable } from 'stream'
// async function* readCsvDataFile (version: string, path: string): AsyncIterableIterator<string> {
//   const stream = await new Promise<Readable>(resolve => {
//     get(csvDataFilePath(version, path), res => resolve(res))
//   })
//   yield* stream[Symbol.asyncIterator]() as AsyncIterableIterator<string>
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
async function* readCsvDataFileByLine (version: string, path: string, lineSeparator: string = '\n'): AsyncIterableIterator<string> {
  const fileContentIterator = readCsvDataFile(version, path)
  let buffer = ''
  for await (const chunk of fileContentIterator) {
    buffer += chunk
    const lines = splitStringWithQuotesPreserved(buffer, lineSeparator)
    for (const line of lines.slice(0, -1)) if (line) yield line
    buffer = lines[lines.length - 1]
  }
  if (buffer) yield buffer
}

/**
 * CSV 数据字段描述
 */
export interface CsvDataField<T> {
  key: keyof T
  type?: string
}

/**
 * CSV 数据记录
 */
export interface CsvDataRecord<T> {
  id: number
  data: T
}

/**
 * CSV 数据
 */
export interface CsvData<T> {
  fields: CsvDataField<T>[]
  records: AsyncIterable<CsvDataRecord<T>>
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
 * 读取 CSV 数据
 */
export async function loadCsvData<N extends keyof DataType & string> (version: string, tableName: N): Promise<CsvData<DataType[N]>> {
  type T = DataType[N]

  // 按行读取 CSV 数据文件的异步迭代器
  const lines = readCsvDataFileByLine(version, `rawexd/${tableName}.csv`)

  // 读取数据表表头下标行
  const indicesHeaderLine = await lines.next()
  if (indicesHeaderLine.done) throw new Error('indices missing')
  const fields: CsvDataField<T>[] = indicesHeaderLine.value.split(',').slice(1).map(() => ({ key: '' as keyof T }))

  // 读取数据表表头字段行
  const keysHeaderLine = await lines.next()
  if (keysHeaderLine.done) throw new Error('keys missing')
  keysHeaderLine.value.split(',').slice(1).forEach((cellContent, index) => {
    fields[index].key = cellContent as keyof T
  })

  // 读取数据表表头类型行
  const typesHeaderLine = await lines.next()
  if (typesHeaderLine.done) throw new Error('types missing')
  typesHeaderLine.value.split(',').slice(1).forEach((cellContent, index) => {
    fields[index].type = cellContent
  })

  // 之后行为数据行，包装成为能逐行解析生成数据的异步生成器
  async function* recordsGenerator (): AsyncIterable<CsvDataRecord<T>> {
    for await (const dataRowContent of lines) {
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

  return { fields, records: recordsGenerator() }
}
