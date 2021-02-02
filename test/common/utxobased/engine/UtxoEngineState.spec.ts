import * as chai from 'chai'
import { Disklet, makeMemoryDisklet } from 'disklet'
import {
  EdgeEncodeUri,
  EdgeMetaToken,
  EdgeParsedUri,
  EdgeTransaction,
  EdgeTxidMap,
  EdgeWalletInfo,
  JsonObject,
  makeFakeIo
} from 'edge-core-js'
import { EventEmitter } from 'events'
import WS from 'ws'

import {
  AddressPath,
  CurrencyFormat,
  EngineCurrencyType,
  LocalWalletMetadata,
  NetworkEnum
} from '../../../../src/common/plugin/types'
import {
  makeProcessor,
  Processor
} from '../../../../src/common/utxobased/db/Processor'
import {
  makeUtxoEngineState,
  UtxoEngineState,
  UtxoEngineStateConfig
} from '../../../../src/common/utxobased/engine/makeUtxoEngineState'
import {
  makeUtxoWalletTools,
  WalletToolsConfig
} from '../../../../src/common/utxobased/engine/makeUtxoWalletTools'
import {
  BlockBook,
  makeBlockBook
} from '../../../../src/common/utxobased/network/BlockBook'

chai.should()

describe('UtxoEngineState functional test with dummy server', function () {
  let websocketServer: WS.Server
  let blockBook: BlockBook
  let websocketClient: WebSocket
  let utxoEngineState: UtxoEngineState

  let disklet: Disklet
  let processor: Processor
  let metadata: LocalWalletMetadata

  beforeEach(async () => {
    disklet = makeMemoryDisklet({})
    const emitter = new EventEmitter() as any
    processor = await makeProcessor({ disklet, emitter })
    metadata = {
      balance: '0',
      lastSeenBlockHeight: 0
    }

    const format: CurrencyFormat = 'bip44'
    const walletToolsConfig: WalletToolsConfig = {
      keys: {
        bitcoinKey:
          'xprv9xpXFhFpqdQK3TmytPBqXtGSwS3DLjojFhTGht8gwAAii8py5X6pxeBnQ6ehJiyJ6nDjWGJfZ95WxByFXVkDxHXrqu53WCRGypk2ttuqncb',
        format,
        coinType: 0
      },
      coin: 'bitcoin',
      network: NetworkEnum.Mainnet
    }
    const walletTools = makeUtxoWalletTools(walletToolsConfig)
    const addressPath: AddressPath = {
      format: 'bip44',
      changeIndex: 0,
      addressIndex: 0
    }

    const blockHeightEmitter = new EventEmitter() as any
    blockBook = makeBlockBook({
      emitter: blockHeightEmitter,
      wsAddress: 'ws://localhost:8080'
    })

    websocketServer = new WS.Server({ port: 8080 })
    websocketServer.on('connection', (ws: WebSocket) => {
      websocketClient = ws
      websocketClient.onmessage = event => {
        const data = JSON.parse(event.data)
        switch (data.method) {
          case 'ping':
            websocketClient.send(
              JSON.stringify({
                id: data.id,
                data: {}
              })
            )
            break
          case 'subscribeAddress':
          case 'subscribeNewBlock':
            websocketClient.send(
              JSON.stringify({
                id: data.id,
                data: { subscribed: true }
              })
            )
            break
        }
      }
    })
    websocketServer.on('error', error => {
      console.log(error)
    })

    await blockBook.connect()
    blockBook.isConnected.should.be.true

    const mockUtxoEngineStateConfig: UtxoEngineStateConfig = {
      walletTools,
      processor,
      blockBook,
      metadata,
      network: NetworkEnum.Mainnet,
      walletInfo: {
        id: '',
        type: '',
        keys: {}
      },
      currencyInfo: {
        coinType: 0,
        currencyType: EngineCurrencyType.UTXO,
        network: 'mainnet',
        gapLimit: 0,
        defaultFee: 0,
        feeUpdateInterval: 1,
        customFeeSettings: [''],
        simpleFeeSettings: {
          highFee: '',
          lowFee: '',
          standardFeeLow: '',
          standardFeeHigh: '',
          standardFeeLowAmount: '',
          standardFeeHighAmount: ''
        },
        pluginId: '',
        displayName: '',
        walletType: 'bip44',
        currencyCode: '',
        denominations: [{ name: '', multiplier: '' }],
        defaultSettings: {},
        metaTokens: [
          {
            currencyCode: '',
            currencyName: '',
            denominations: [{ name: '', multiplier: '' }]
          }
        ],
        addressExplorer: '',
        transactionExplorer: ''
      },
      currencyTools: {
        createPrivateKey: async (
          walletType: string,
          opts?: JsonObject
        ): Promise<JsonObject> => {
          return {}
        },
        derivePublicKey: async (
          walletInfo: EdgeWalletInfo
        ): Promise<JsonObject> => {
          return {}
        },
        parseUri: async (
          uri: string,
          currencyCode?: string,
          customTokens?: EdgeMetaToken[]
        ): Promise<EdgeParsedUri> => {
          return {}
        },
        encodeUri: async (
          obj: EdgeEncodeUri,
          customTokens?: EdgeMetaToken[]
        ): Promise<string> => {
          return ''
        }
      },
      options: {
        emitter: new EventEmitter() as any,
        callbacks: {
          onBlockHeightChanged: (blockHeight: number): void => {},
          onTransactionsChanged: (transactions: EdgeTransaction[]): void => {},
          onBalanceChanged: (
            currencyCode: string,
            nativeBalance: string
          ): void => {},
          onAddressesChecked: (progressRatio: number): void => {},
          onAddressChanged: (): void => {},
          onTxidsChanged: (txids: EdgeTxidMap): void => {}
        },
        log: {
          warn: (...args: any[]): void => {},
          error: (...args: any[]): void => {}
        },
        walletLocalDisklet: makeMemoryDisklet({}),
        walletLocalEncryptedDisklet: makeMemoryDisklet({}),
        userSettings: {}
      },
      io: makeFakeIo()
    }

    utxoEngineState = makeUtxoEngineState(mockUtxoEngineStateConfig)
    utxoEngineState.processAddress({
      scriptPubkey: walletTools.getScriptPubKey(addressPath),
      networkQueryVal: 0,
      path: addressPath
    })

    console.log(walletTools.getAddress(addressPath))
  })

  afterEach(async () => {
    websocketServer.close()
  })

  it('Test Utxo Engine subscribe, processing and queueing functionality', async () => {
    websocketClient.send(
      '{"id":"WATCH_ADDRESS_TX_EVENT_ID","data":{"address":"tb1q8uc93239etekcywh2l0t7aklxwywhaw0xlexld","tx":{"txid":"cfd4c31709bd48026c6c1027c47cef305c47947d73248129fee3f4b63ca1af43","version":1,"vin":[{"txid":"e0965d6df36a4ba811fb29819beeae0203fe68e48143344908146a58c5333996","vout":1,"sequence":4294967295,"n":0,"addresses":["tb1qrps90para9l48lydp2xga0p5yyckuj5l7vsu6t"],"isAddress":true,"value":"81581580"}],"vout":[{"value":"100000","n":0,"hex":"00143f3058aa25caf36c11d757debf76df3388ebf5cf","addresses":["tb1q8uc93239etekcywh2l0t7aklxwywhaw0xlexld"],"isAddress":true},{"value":"81463900","n":1,"hex":"0014be4df3d4535bd56f4d35dc1ffdb58408b084ebaa","addresses":["tb1qhexl84znt02k7nf4ms0lmdvypzcgf6a2c9zduk"],"isAddress":true}],"blockHeight":0,"confirmations":0,"blockTime":1612198107,"value":"81563900","valueIn":"81581580","fees":"17680","hex":"01000000000101963933c5586a140849344381e468fe0302aeee9b8129fb11a84b6af36d5d96e00100000000ffffffff02a0860100000000001600143f3058aa25caf36c11d757debf76df3388ebf5cf5c0adb0400000000160014be4df3d4535bd56f4d35dc1ffdb58408b084ebaa0247304402201e7f25a03517d932b2df5d099da597132047f5b7bb5cff43252ba0113fc161d2022003b80682bf7f32e685b21a6f28abc494dcc73c34bc62233f918b54afbbaca36c0121029eea7dac242382a543f6288023ac5a62064bea27349d25fc93180b14d5dd117400000000"}}}'
    )
    await new Promise(resolve => setTimeout(resolve, 100))

    websocketClient.send(
      '{"id":"WATCH_NEW_BLOCK_EVENT_ID","data":{"height":1916453,"hash":"0000000000000e0444fa7c1540a96e5658898a59733311d08f01292e114e8d5b"}}'
    )
    await new Promise(resolve => setTimeout(resolve, 100))
  })
})
