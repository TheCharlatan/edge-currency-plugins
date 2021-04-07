import { Mutex } from 'async-mutex'
import { Disklet } from 'disklet'
import { makeMemlet, Memlet } from 'memlet'

const taskCachePath = 'taskcache.json'

interface TaskCacheConfig {
  disklet: Disklet
}

export interface TaskCache<T extends TaskEntry> {
  clear: () => Promise<void>
  fetchTaskCache: () => Promise<Task<T>>
  setTaskCache: (data: Task<T>) => Promise<void>
}

interface TaskEntry {
  fetching: boolean
}

interface Task<T extends TaskEntry> {
  [entry: string]: T
}

export async function makeTaskCache<T extends TaskEntry>(
  config: TaskCacheConfig
): Promise<TaskCache<T>> {
  const { disklet } = config
  const memlet: Memlet = makeMemlet(disklet)
  const mutex = new Mutex()

  async function fetchTaskCache(): Promise<Task<T>> {
    try {
      const dataStr = await memlet.getJson(taskCachePath)
      return JSON.parse(dataStr)
    } catch {
      console.log('caught exception!')
      await setTaskCache({})
      return {}
    }
  }

  async function setTaskCache(data: Task<T>): Promise<void> {
    void mutex.runExclusive(async () => {
      await memlet.setJson(taskCachePath, JSON.stringify(data))
    })
  }

  async function clear(): Promise<void> {
    await memlet.delete(taskCachePath)
  }

  return {
    clear,
    setTaskCache,
    fetchTaskCache
  }
}
