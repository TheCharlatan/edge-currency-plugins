import { Mutex } from 'async-mutex'
import * as bs from 'biggystring'
import { Disklet } from 'disklet'
import { makeMemlet, Memlet } from 'memlet'

import { EngineEmitter, EngineEvent } from './makeEngineEmitter'
import { LocalWalletMetadata } from './types'

const metadataPath = `metadata.json`

interface MetadataConfig {
  disklet: Disklet
  emitter: EngineEmitter
}

export interface Metadata extends LocalWalletMetadata {
  clear: () => Promise<void>
}

export const makeMetadata = async (
  config: MetadataConfig
): Promise<Metadata> => {
  const { disklet, emitter } = config
  const memlet = makeMemlet(disklet)

  const mutex = new Mutex()

  const setMetadata = async (
    memlet: Memlet,
    data: LocalWalletMetadata
  ): Promise<void> => {
    mutex
      .runExclusive(async () => {
        await memlet.setJson(metadataPath, JSON.stringify(data))
      })
      .catch(e => {
        throw e
      })
  }

  const fetchMetadata = async (): Promise<LocalWalletMetadata> => {
    try {
      const dataStr = await memlet.getJson(metadataPath)
      return JSON.parse(dataStr)
    } catch {
      const data: LocalWalletMetadata = {
        balance: '0',
        lastSeenBlockHeight: 0
      }
      await setMetadata(memlet, data)
      return data
    }
  }

  let cache: LocalWalletMetadata = await fetchMetadata()

  emitter.on(
    EngineEvent.ADDRESS_BALANCE_CHANGED,
    (currencyCode: string, balanceDiff: string) => {
      cache.balance = bs.add(cache.balance, balanceDiff)
      emitter.emit(
        EngineEvent.WALLET_BALANCE_CHANGED,
        currencyCode,
        cache.balance
      )
      setMetadata(memlet, cache).catch(e => {
        throw e
      })
    }
  )

  emitter.on(EngineEvent.BLOCK_HEIGHT_CHANGED, (height: number) => {
    if (height > cache.lastSeenBlockHeight) {
      cache.lastSeenBlockHeight = height
      setMetadata(memlet, cache).catch(e => {
        throw e
      })
    }
  })

  return {
    get balance() {
      return cache.balance
    },
    get lastSeenBlockHeight() {
      return cache.lastSeenBlockHeight
    },
    clear: async () => {
      await memlet.delete(metadataPath)
      cache = await fetchMetadata()
    }
  }
}
