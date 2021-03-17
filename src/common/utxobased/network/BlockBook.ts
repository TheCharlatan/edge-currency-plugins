import { EdgeTransaction } from 'edge-core-js'

import { Emitter, EmitterEvent } from '../../plugin/types'
import {
  addressMessage,
  addressUtxosMessage,
  broadcastTxMessage,
  infoMessage,
  PartialTask,
  pingMessage,
  subscribeAddressesMessage,
  subscribeNewBlockMessage,
  transactionMessage
} from './BlockBookAPI'
import { makeSocket, potentialWsTask, WsTask } from './Socket'

export interface INewTransactionResponse {
  address: string
  tx: ITransaction
}

export interface INewBlockResponse {
  height: number
  hash: string
}

export interface IAccountDetailsBasic {
  address: string
  balance: string
  totalReceived: string
  totalSent: string
  txs: number
  unconfirmedBalance: string
  unconfirmedTxs: number
}

interface ITransactionPaginationResponse {
  page: number
  totalPages: number
  itemsOnPage: number
}

interface ITransactionIdPaginationResponse
  extends ITransactionPaginationResponse {
  txids: string[]
}

interface ITransactionDetailsPaginationResponse
  extends ITransactionPaginationResponse {
  transactions?: ITransaction[]
}

interface IAccountOpts {
  details?: string
  from?: number
  to?: number
  page?: number
  perPage?: number
}

export interface ITransaction {
  txid: string
  hex: string
  blockHeight: number
  confirmations: number
  blockTime: number
  fees: string
  vin: Array<{
    txid: string
    vout: number
    value: string
    addresses: string[]
    hex?: string
  }>
  vout: Array<{
    n: number
    value: string
    addresses: string[]
    hex?: string
  }>
}

interface IUTXO {
  txid: string
  vout: number
  value: string
  height?: number
  confirmations?: number
  lockTime?: number
}

interface IAccountUTXO extends IUTXO {
  address?: string
  path?: string
}

interface IServerInfo {
  name: string
  shortcut: string
  decimals: number
  version: string
  bestHeight: number
  bestHash: string
  block0Hash: string
  testnet: boolean
}

type Callback = () => void | Promise<void>

export interface BlockBook {
  isConnected: boolean

  connect: () => Promise<void>

  disconnect: () => Promise<void>

  fetchInfo: () => Promise<IServerInfo>

  fetchAddress: ((
    address: string,
    opts?: IAccountOpts & {
      details?: 'basic'
    }
  ) => Promise<IAccountDetailsBasic>) &
    ((
      address: string,
      opts: IAccountOpts & {
        details: 'txids'
      }
    ) => Promise<IAccountDetailsBasic & ITransactionIdPaginationResponse>) &
    ((
      address: string,
      opts: IAccountOpts & {
        details: 'txs'
      }
    ) => Promise<
      IAccountDetailsBasic & ITransactionDetailsPaginationResponse
    >) &
    ((address: string, opts?: IAccountOpts) => Promise<IAccountDetailsBasic>)

  watchAddresses: (
    addresses: string[],
    cb: (response: INewTransactionResponse) => void
  ) => void

  watchBlocks: (cb: () => void | Promise<void>) => void

  fetchAddressUtxos: (account: string) => Promise<IAccountUTXO[]>

  fetchTransaction: (hash: string) => Promise<ITransaction>

  broadcastTx: (transaction: EdgeTransaction) => Promise<void>
}

export interface BlockHeightEmitter {
  emit: (event: EmitterEvent.BLOCK_HEIGHT_CHANGED, blockHeight: number) => this
}

interface BlockBookConfig {
  emitter: Emitter
  wsAddress?: string
}

const baseUri = 'btc1.trezor.io'

export function makeBlockBook(config: BlockBookConfig): BlockBook {
  const emitter = config.emitter
  const baseWSAddress = config.wsAddress ?? `wss://${baseUri}/websocket`

  const instance: BlockBook = {
    isConnected: false,
    connect,
    disconnect,
    fetchInfo,
    fetchAddress,
    watchAddresses,
    watchBlocks,
    fetchAddressUtxos,
    fetchTransaction,
    broadcastTx
  }

  emitter.on(EmitterEvent.CONNECTION_OPEN, () => {})
  emitter.on(EmitterEvent.CONNECTION_CLOSE, (error?: Error) => {
    console.log(error)
  })
  emitter.on(EmitterEvent.CONNECTION_TIMER, (queryTime: number) => {})
  const onQueueSpace = (): potentialWsTask => {
    return {}
  }

  const socket = makeSocket(baseWSAddress, {
    healthCheck: ping,
    onQueueSpace,
    emitter
  })

  async function connect(): Promise<void> {
    if (instance.isConnected) return

    await socket.connect()
    instance.isConnected = socket.isConnected()
  }

  async function disconnect(): Promise<void> {
    if (!instance.isConnected) return

    socket.disconnect()
    instance.isConnected = false
  }

  async function promisifyWsMessage<T>(message: PartialTask): Promise<T> {
    return await new Promise((resolve, reject) => {
      sendWsMessage({ ...message, resolve, reject })
    })
  }

  function sendWsMessage(task: WsTask): void {
    socket.submitTask(task)
  }

  async function ping(): Promise<object> {
    return await promisifyWsMessage(pingMessage())
  }

  async function fetchInfo(): Promise<IServerInfo> {
    return await promisifyWsMessage(infoMessage())
  }

  async function fetchAddress(
    address: string,
    opts: IAccountOpts = {}
  ): Promise<any> {
    return await promisifyWsMessage(addressMessage(address, opts))
  }

  async function watchBlocks(cb: Callback): Promise<void> {
    const socketCb = async (value: INewBlockResponse): Promise<void> => {
      // eslint-disable-next-line no-void
      await cb()
      emitter.emit(EmitterEvent.BLOCK_HEIGHT_CHANGED, value.height)
    }
    socket.subscribe({
      ...subscribeNewBlockMessage(),
      cb: socketCb
    })
  }

  function watchAddresses(
    addresses: string[],
    cb: (response: INewTransactionResponse) => void
  ): void {
    socket.subscribe({
      ...subscribeAddressesMessage(addresses),
      cb
    })
  }

  async function fetchAddressUtxos(account: string): Promise<IAccountUTXO[]> {
    return await promisifyWsMessage(addressUtxosMessage(account))
  }

  async function fetchTransaction(hash: string): Promise<ITransaction> {
    return await promisifyWsMessage(transactionMessage(hash))
  }

  async function broadcastTx(transaction: EdgeTransaction): Promise<void> {
    await promisifyWsMessage(broadcastTxMessage(transaction))
  }

  return instance
}
