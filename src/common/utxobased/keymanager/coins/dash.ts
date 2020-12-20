import { Coin } from '../coin'

export class Dash implements Coin {
  name = 'dash'
  segwit = false
  coinType = 5
  mainnetConstants = {
    messagePrefix: 'unused',
    wif: 0xcc,
    legacyXPriv: 0x02fe52f8,
    legacyXPub: 0x02fe52cc,
    pubkeyHash: 0x4c,
    scriptHash: 0x10,
  }

  legacyConstants = {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    wif: 0x80,
    legacyXPriv: 0x0488ade4,
    legacyXPub: 0x0488b21e,
    pubkeyHash: 0x00,
    scriptHash: 0x05,
  }

  testnetConstants = {
    messagePrefix: 'unused',
    wif: 0xef,
    legacyXPriv: 0x04358394,
    legacyXPub: 0x043587cf,
    pubkeyHash: 0x6f,
    scriptHash: 0xc4,
  }
}
