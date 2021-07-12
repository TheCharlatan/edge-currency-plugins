import * as chai from 'chai'
import { expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { makeMemoryDisklet } from 'disklet'

import { EngineEmitter } from '../../../../src/common/plugin/makeEngineEmitter'
import {
  makeProcessor,
  Processor
} from '../../../../src/common/utxobased/db/makeProcessor'

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

  it('transactions', async () => {
    const tx = {
      txid: 'f17ec60b29080121fa2071a6ac6316bcb504a2664a86578a4dbe8c4c542cf012',
      hex:
        '0100000006983e600f7e699dc1b9fd5c9ef353cfd111bfffffb3ec0f103760430008408492000000006b483045022100bd441f5f9b3316eea91897c199db6f8a9a215dd28044ea4b72f9dd284962b3d302203654f97093f71f017d8e543d24284e2e37d5acfc5e07cfdd85b5d57b8ef9806d0121031970ce92d269123c476e966f81c75953475d6974e320f5a7c892720aca82aaa5ffffffffe9686d85a394cbbe38e42deacb620471186ee917b9ff1ae780086607f0bfdf78000000006b483045022100c0360d9f397b3f8d00533744266b50ccf9cc7c3bd43936a1e8e1bcf821c300d50220397f911f949a27b35a563e274efa73074e20fc03197effcf9da0cdcde482620b012103b8b327cb19ec5fa49594fe60ac4fac65f7d07dedba72bf80fbcd833ade30c759ffffffff3b43b29ef028f1c341be24d3f34c93b1a8a8a0495274c4df3b8556aa21daa0a3000000006a47304402200660a95c66eb3ef3211d69f544b3af81c50170f8a0b063b0be5c3174060d5f4302202d19d761cacec003b8721dd3ed4ea17beaed31565d833f3acbf58ff3bc49223b01210363208f4e166b032a13b3e3276ae28735f58ceb867bf3fd1a129678ae248df132ffffffffdaaf0a134664edcc6460a9fee852d5461fa05e9047fa0ccafaa29d9f8e0e9ba4000000006a47304402205602e71d8e4006614cbcb8ab1e479ec62a499c8b11a0c960803c1b92fdadc448022076d0df56c733f9541c6f87f11e953b52d719743814fd405fa6b0f1674ab13c6b0121032e691167e7cdb1aa67e7d02ba0153f53957f18f049b1f95837f5d069aa08bcdeffffffff946149e2d691b653cbe161012e2258b4b5ae3c5d170c995bb5dd037552a88ee5000000006a4730440220144052fb4a72710a3744640937d32ef26d1a50154b4dc8f4d94761a17ca76c2c02202ace714ff62c9655750b92bf0237436c262e181342182f31e86090f8260608290121029472a9ab5fce7f6e11e93a648b56a7d0ce071b103b5030252f3b719a828bf85cffffffffd3c463f0517ffdd548d2e783201ec636044186ad949326a9b2439ffda1847065000000006a473044022076cbd2f0c6a9cef637af950591c9d533e722beaa5b960d10754e3551b428626302203097e3f868218e7a68fa883bd079d228e1af8bdad6be523a4187a6a9480ba56c012102f29634fb3ed95cc18635333f37b5f33e297d3730241f30a166ceed3e43a56ad5ffffffff0267070000000000001976a9144e9b0ff28006dbd102fdcf49c37530d6a2e00fab88ac78370000000000001976a914ecc95a54ffcf095a9fa34e73f119052004ea031888ac00000000',
      blockHeight: 361039,
      date: 1434361544,
      fees: '1000',
      inputs: [
        {
          txId:
            '9284400800436037100fecb3ffffbf11d1cf53f39e5cfdb9c19d697e0f603e98',
          outputIndex: 0,
          scriptPubkey: '76a91475e508d512082333a03118c6702e26fbcfbc7d9288ac',
          amount: '3000'
        },
        {
          txId:
            '78dfbff007660880e71affb917e96e18710462cbea2de438becb94a3856d68e9',
          outputIndex: 1,
          scriptPubkey: '76a9143e1be172e25f0eb28a6f7392aef3e57038558ba688ac',
          amount: '3000'
        },
        {
          txId:
            'a3a0da21aa56853bdfc4745249a0a8a8b1934cf3d324be41c3f128f09eb2433b',
          outputIndex: 3,
          scriptPubkey: '76a914048d0d2aef1a2bcfe35b70d88c6f9765b0e13b7588ac',
          amount: '3000'
        },
        {
          txId:
            'a49b0e8e9f9da2faca0cfa47905ea01f46d552e8fea96064cced6446130aafda',
          outputIndex: 4,
          scriptPubkey: '76a914a19791c30deb952ed0a1a4f09896165db0f0e56c88ac',
          amount: '2856'
        },
        {
          txId:
            'e58ea8527503ddb55b990c175d3caeb5b458222e0161e1cb53b691d6e2496194',
          outputIndex: 5,
          scriptPubkey: '76a9143e5c12d8b706a09c0a44e6ef88c3dc10b50e511088ac',
          amount: '2796'
        },
        {
          txId:
            '657084a1fd9f43b2a9269394ad86410436c61e2083e7d248d5fd7f51f063c4d3',
          outputIndex: 6,
          scriptPubkey: '76a9147571436256270482acf290bfba2019f4d4723f8a88ac',
          amount: '2443'
        }
      ],
      outputs: [
        {
          index: 0,
          scriptPubkey: '76a9144e9b0ff28006dbd102fdcf49c37530d6a2e00fab88ac',
          amount: '1895'
        },
        {
          index: 1,
          scriptPubkey: '76a914ecc95a54ffcf095a9fa34e73f119052004ea031888ac',
          amount: '14200'
        }
      ],
      ourIns: [],
      ourOuts: [],
      ourAmount: '0'
    }
    await processor.saveTransaction(tx)
    await processor.saveTransaction(tx)
    await processor.saveTransaction(tx)
    await processor.saveTransaction(tx)

    const txs = await processor.fetchTransactions({})
    expect(txs.length).to.eql(1)
  })
})
