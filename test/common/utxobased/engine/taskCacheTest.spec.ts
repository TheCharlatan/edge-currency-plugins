import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { makeMemoryDisklet } from 'disklet'

import { makeTaskCache } from '../../../../src/common/utxobased/engine/taskCache'

chai.should()
chai.use(chaiAsPromised)

interface AddressTransactionCacheState {
  page: number
  networkQueryVal: number
  fetching: boolean
  path: string
}

interface TransactionTask {
  [entry: string]: AddressTransactionCacheState
}

describe('TaskCache', function () {
  const transactionCache: TransactionTask = {
    lol: {
      page: 1,
      networkQueryVal: 0,
      fetching: false,
      path: 'lol'
    }
  }
  it('test task cache', async function () {
    const disklet = makeMemoryDisklet()
    const taskCache = await makeTaskCache<AddressTransactionCacheState>({
      disklet
    })
    await taskCache.setTaskCache(transactionCache)
    console.log('look at this entry:', await taskCache.fetchTaskCache())
  })
})
