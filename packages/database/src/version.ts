/**
 * 版本
 */
// TODO: 之后考虑做成平台能力

/**
 * 当前版本
 */
let currentVersion: string

/**
 * 设置当前版本
 * @param version 要设置的版本
 */
export function setCurrentVersion (version: string): void {
  currentVersion = version
}

/**
 * 获取当前版本
 * @returns 当前版本
 */
export function getCurrentVersion (): string {
  return currentVersion
}
