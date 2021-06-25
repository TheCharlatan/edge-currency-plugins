import * as chai from 'chai'
import { expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { makeMemoryDisklet } from 'disklet'

import { EngineEmitter } from '../../../../src/common/plugin/makeEngineEmitter'
import {
  makeProcessor,
  Processor
} from '../../../../src/common/utxobased/db/makeProcessor'
import { IUTXO } from '../../../../src/common/utxobased/db/types'
import { ScriptTypeEnum } from '../../../../src/common/utxobased/keymanager/keymanager'

chai.should()
chai.use(chaiAsPromised)

describe('Processor', function () {
  const storage = {}
  const disklet = makeMemoryDisklet(storage)
  const emitter = new EngineEmitter()
  let processor: Processor

  beforeEach(async () => {
    processor = await makeProcessor({ disklet, emitter })
  })

  it('insert tx id by confirmation', async function () {
    const noEntry = await processor.fetchTxIdsByBlockHeight({
      blockHeightMin: 0
    })
    expect(noEntry).to.eql([])
    await processor.removeTxIdByBlockHeight({ blockHeight: 0, txid: 'test' })
    await processor.insertTxIdByBlockHeight({ blockHeight: 0, txid: 'this' })
    await processor.insertTxIdByBlockHeight({ blockHeight: 0, txid: 'that' })
    await processor.insertTxIdByBlockHeight({
      blockHeight: 1,
      txid: 'whatever'
    })

    let zeroConf = await processor.fetchTxIdsByBlockHeight({
      blockHeightMin: 0
    })
    zeroConf.should.include.members(['that', 'this'])

    const oneConf = await processor.fetchTxIdsByBlockHeight({
      blockHeightMin: 1
    })
    oneConf[0].should.equal('whatever')

    const allConf = await processor.fetchTxIdsByBlockHeight({
      blockHeightMin: 0,
      blockHeightMax: 1
    })
    allConf.should.include.members(['that', 'this', 'whatever'])

    await processor.removeTxIdByBlockHeight({ blockHeight: 0, txid: 'this' })
    zeroConf = await processor.fetchTxIdsByBlockHeight({ blockHeightMin: 0 })
    zeroConf.should.include.members(['that'])
  })

  it('insert and fetch multiple UTXOs', async function () {
    const utxos: IUTXO[] = [
      {
        id:
          'b3918bd33277dd615a2ce50297be40e6befbbde5bea123e54cb44cc9503b5027_0',
        txid:
          'b3918bd33277dd615a2ce50297be40e6befbbde5bea123e54cb44cc9503b5027',
        vout: 0,
        value: '1500',
        scriptPubkey: '76a9144fd5544b58c22548f8569ae6c335a5be6b4fe9e288ac',
        script:
          '0100000001d9e8c6086eda7be68475a84d7eb12a6dd55e5c41d254cf93eb8cb771e9fb9c0d010000006a473044022065616b4e0e51051e1959f99e54c302fb9879af607c0e6d75eede16b184b9bd3902202d6dd866b0b0df2f362dfee068956579ff81dd88b4928e456571a3e6d2c16f5d0121025a260c8f0da14e1528713f85ea93a1ddccc68ff90ba8c96dc5234f4d9cf90f7effffffff02dc050000000000001976a9144fd5544b58c22548f8569ae6c335a5be6b4fe9e288ac479e1100000000001976a914b4682f180b78cb48179d8574f89936bbc9fb84c688ac00000000',
        redeemScript: undefined,
        scriptType: ScriptTypeEnum.p2pkh,
        blockHeight: 518394
      },
      {
        id:
          '0d9cfbe971b78ceb93cf54d2415c5ed56d2ab17e4da87584e67bda6e08c6e8d9_0',
        txid:
          '0d9cfbe971b78ceb93cf54d2415c5ed56d2ab17e4da87584e67bda6e08c6e8d9',
        vout: 0,
        value: '1400',
        scriptPubkey: '76a9144fd5544b58c22548f8569ae6c335a5be6b4fe9e288ac',
        script:
          '01000000012409214fe125fc43001c0739d45d365a4b09ac538b1dc657a4a0d054d02e0534010000006a473044022055176986e096c146fdbe8dcaa37b28817732600486d1f86f707da275e48e283c0220543e9acedb8196970b0a9b724e55e8e5a4f3cba066061d7f2542c35beea619bd0121023ed5588081819c5e2ae434e3f11af08befeca52532b1f5285ac4540f51065d75ffffffff0278050000000000001976a9144fd5544b58c22548f8569ae6c335a5be6b4fe9e288ace4ad1100000000001976a9148b3b2cc36b79a91415fb07c027a3440cf9a8bf9f88ac00000000',
        redeemScript: undefined,
        scriptType: ScriptTypeEnum.p2pkh,
        blockHeight: 518394
      },
      {
        id:
          '34052ed054d0a0a457c61d8b53ac094b5a365dd439071c0043fc25e14f210924_0',
        txid:
          '34052ed054d0a0a457c61d8b53ac094b5a365dd439071c0043fc25e14f210924',
        vout: 0,
        value: '1100',
        scriptPubkey: '76a9144fd5544b58c22548f8569ae6c335a5be6b4fe9e288ac',
        script:
          '01000000017fbf6a3c3e90e5da3f8620bfce3e2fbaa9123c0701f8f5fe4ac27bf346534503000000006a473044022043a9d362641d984bf04c9e76b13d3a385900adf4fe9bacdb40b3940aefb15373022009832dfd68894a0008deca11911403c81731ebe9608ef5f69c261b066f864f88012102eca533d797b6f01f4c3c983c61e1c39482c51926e7e9246114ed7fd3c7f6a497ffffffff024c040000000000001976a9144fd5544b58c22548f8569ae6c335a5be6b4fe9e288ac1dbd1100000000001976a914ab1bed81a51fab0c5ab40e77f40acbf7981006b188ac00000000',
        redeemScript: undefined,
        scriptType: ScriptTypeEnum.p2pkh,
        blockHeight: 518394
      }
    ]
    const addPromise: Array<Promise<void>> = []
    for (const utxo of utxos) {
      addPromise.push(processor.saveUtxo(utxo).catch(() => console.log('lol!')))
    }
    await Promise.all(addPromise)
    const saveUtxos = await processor.fetchUtxosByScriptPubkey(
      '76a9144fd5544b58c22548f8569ae6c335a5be6b4fe9e288ac'
    )
    expect(saveUtxos).to.eqls(utxos)
  })

  it('test reset', async () => {
    await processor.saveAddress({
      lastQuery: 0,
      lastTouched: 0,
      used: false,
      balance: '0',
      scriptPubkey: 'justatest',
      networkQueryVal: 0,
      path: {
        format: 'bip32',
        changeIndex: 0,
        addressIndex: 0
      }
    })
    const testAddress = await processor.fetchAddressByScriptPubkey('justatest')
    let lastQuery: number
    if (testAddress != null) {
      lastQuery = testAddress.lastQuery
    } else {
      lastQuery = 0
    }
    expect(testAddress).to.eql({
      lastQuery,
      lastTouched: 0,
      used: false,
      balance: '0',
      scriptPubkey: 'justatest',
      networkQueryVal: 0,
      path: { format: 'bip32', changeIndex: 0, addressIndex: 0 }
    })
    await processor.clearAll()
    const emptyAddress = await processor.fetchAddressByScriptPubkey('justatest')
    expect(emptyAddress).to.equal(undefined)
  })
})
