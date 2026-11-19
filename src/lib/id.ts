let counter = 0

/** Creates a unique id such as "prd_lq3x9a1k2f8d". */
export function createId(prefix: string): string {
  counter += 1
  const time = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 7)
  return `${prefix}_${time}${counter.toString(36)}${random}`
}
