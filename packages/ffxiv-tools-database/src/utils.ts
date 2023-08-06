/**
 * 工具函数
 */

/**
 * 将异步迭代器缓冲为同步迭代器
 */
export async function buffer<T> (iterator: AsyncIterableIterator<T>): Promise<IterableIterator<T>> {
  const buffer: T[] = []
  for await (const value of iterator) buffer.push(value)
  return buffer.values()
}

/**
 * 复制异步迭代器
 */
export function duplicate<T> (iterator: AsyncIterableIterator<T>, count: number = 2): AsyncIterableIterator<T>[] {

  // 对原迭代器输出结果的缓存
  const resultBuffer: IteratorResult<T>[] = []

  // 复制产生的每个迭代器的状态
  const iteratorsState = Array.from({ length: count }, () => ({
    iterationIndex: 0,
    returned: false,
  }))

  // 按所需复制个数生成多个新的异步迭代器
  const duplicatedIterators = Array.from({ length: count }, (_, index) => {
    const iteratorState = iteratorsState[index]
    const duplicatedIterator: AsyncIterableIterator<T> = {

      // 对于新迭代器每次迭代请求，尝试从缓存获取结果，如果没有缓存中没有则从原迭代器请求，最后清理已被所有新迭代器读取过的缓存部分
      async next () {
        if (!resultBuffer[iteratorState.iterationIndex]) {
          resultBuffer.push(await iterator.next())
        }
        const result = resultBuffer[iteratorState.iterationIndex]
        iteratorState.iterationIndex++
        if (iteratorState.iterationIndex === 1 && iteratorsState.every(({ iterationIndex }) => iterationIndex > 0)) {
          resultBuffer.shift()
          iteratorsState.forEach(iteratorState => iteratorState.iterationIndex--)
        }
        return result
      },

      // 所有新迭代器都迭代结束时才结束原迭代器的迭代
      async return () {
        iteratorState.returned = true
        if (iteratorsState.every(({ returned }) => returned)) {
          iterator.return?.()
        }
        return { done: true, value: undefined }
      },

      // 任何一个新迭代器抛出异常则向原迭代器转发异常
      async throw (err) {
        iterator.throw?.(err)
        return { done: true, value: undefined }
      },

      [Symbol.asyncIterator]: () => duplicatedIterator,
    }
    return duplicatedIterator
  })
  return duplicatedIterators
}
