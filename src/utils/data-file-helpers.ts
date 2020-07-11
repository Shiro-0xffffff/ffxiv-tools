/**
 * 数据文件处理
 */

// 数据文件根路径
const dataFilePath = (version: string, path: string) => `https://raw.githubusercontent.com/Shiro-0xffffff/ffxiv-data/${version}/data/${path}`

/**
 * 读取数据文件
 */
export async function* readDataFile (version: string, path: string) {
  const res = await fetch(dataFilePath(version, path))
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  while (true) {
    const { value, done } = await reader.read()
    if (done) return reader.releaseLock()
    yield value && decoder.decode(value)
  }
}

// Node 版本, 备用
// import { createReadStream } from 'fs'
// import { resolve, join } from 'path'
// export async function* readDataFile (version: string, path: string) {
//   const dataPath = resolve(__dirname, '../../data')
//   const stream = createReadStream(join(dataPath, version, path), { encoding: 'utf8' })
//   yield* stream[Symbol.asyncIterator]() as AsyncIterableIterator<string>
// }

/**
 * 分割字符串, 但是保留成对引号中的内容 (即引号中间有分隔符也不会被截断)
 */
export function splitStringWithQuotesPreserved (string: string, separator: string) {
  return string.split(separator).reduce((segments, segment) => {
    const prevSegment = segments[segments.length - 1] || ''
    const quoteClosed = (prevSegment.match(/(?<!\\)"/g) || []).length % 2 === 0
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
export async function* readCsvDataFileByLine (version: string, path: string, lineSeparator: string = '\n') {
  const fileContentIterator = readDataFile(version, path)
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
 * 解析 CSV 单元格数据
 */
export function parseCsvCellContent (content: string) {
  // 无内容, 解析为 null
  if (!content) return null

  // 数字类型, 出于性能考虑只有当内容长度少于 16 位, 才考虑解析为数字数字类型
  if (content.length <= 16 && !isNaN(Number(content))) return Number(content)

  // 字符串类型, 需要对转义过的字符进行解码
  if (content.match(/^"(.|\s)*"$/)) return content.slice(1, -1).replace(/\\(.)/g, (_, char) => ({ 'n': '\n' }[char] || char))

  // 布尔类型, 只存在 `True` 和 `False` 两种值
  if (content === 'True' || content === 'False') return content === 'True'
  
  // 其他未知的类型
  return null
}

/**
 * CSV 数据字段描述
 */
interface CsvDataField {
  key?: string
  type?: string
}

/**
 * 读取 CSV 数据
 */
export async function loadCsvData (version: string, tableName: string) {

  // 按行读取 CSV 数据文件的异步迭代器
  const lines = readCsvDataFileByLine(version, `rawexd/${tableName}.csv`)

  // 读取数据表表头下标行
  const { value: indicesHeaderLine } = await lines.next()
  if (!indicesHeaderLine) throw new Error('表头下标行缺失')
  const fields: CsvDataField[] = indicesHeaderLine.split(',').slice(1).map(() => ({}))

  // 读取数据表表头字段行
  const { value: keysHeaderLine } = await lines.next()
  if (!keysHeaderLine) throw new Error('表头字段行缺失')
  keysHeaderLine.split(',').slice(1).forEach((cellContent, index) => {
    fields[index].key = cellContent
  })

  // 读取数据表表头类型行
  const { value: typesHeaderLine } = await lines.next()
  if (!typesHeaderLine) throw new Error('表头类型行缺失')
  typesHeaderLine.split(',').slice(1).forEach((cellContent, index) => {
    fields[index].type = cellContent
  })

  // 之后行为数据行, 包装成为能逐行解析生成数据的异步生成器
  async function* recordsGenerator () {
    for await (const dataRowContent of lines) {
      const dataRowCells = splitStringWithQuotesPreserved(dataRowContent, ',')
  
      const id = Number(dataRowCells[0])
      const record: { [key: string]: any } = {}
      dataRowCells.slice(1).forEach((cellContent, index) => {
        const key = fields[index].key || `$${index}`
        record[key] = parseCsvCellContent(cellContent)
      })
  
      yield { id, record }
    }
  }

  return { fields, records: recordsGenerator() }
}