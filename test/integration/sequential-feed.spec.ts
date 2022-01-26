import { Bee, Reference, Topic, Utils } from '@ethersphere/bee-js'
import type { HexString } from '@ethersphere/bee-js/dist/src/utils/hex'
import { SequentialFeed } from '../../src/sequential-feed'
import { assertBytes, Bytes, bytesToHex, hexToBytes, makePrivateKeySigner } from '../../src/utils'
import { beeUrl, getPostageBatch } from '../utils'

describe('feed', () => {
  const testIdentity = {
    privateKey: '634fb5a872396d9693e5c9f9d7233cfa93f395c093371017ff44aa9ae6564cdd' as HexString,
    publicKey: '03c32bb011339667a487b6c1c35061f15f7edc36aa9a0f8648aba07a4b8bd741b4' as HexString,
    address: '8d3766440f0d7b949a5e32995d09619a7f86e632' as HexString,
  }
  const owner = Utils.Hex.makeHexString(testIdentity.address, 40)
  const signer = makePrivateKeySigner(hexToBytes(testIdentity.privateKey) as Bytes<32>)
  const topic = '0000000000000000000000000000000000000000000000000000000000000000' as Topic
  const bee = new Bee(beeUrl())
  const batchId = getPostageBatch()
  const sequentialFeed = new SequentialFeed(bee)

  test('lookup for empty feed update', async () => {
    const emptyTopic = '1200000000000000000000000000000000000000000000000000000000000001' as Topic
    const feedR = sequentialFeed.makeFeedR(emptyTopic, testIdentity.address)
    const lastIndex = await feedR.getLastIndex()

    expect(lastIndex).toBe(-1)
  }, 40000)

  test('setLastupdate then lookup', async () => {
    const feedRw = sequentialFeed.makeFeedRW(topic, signer)
    const currentIndex = await feedRw.getLastIndex()

    const testReference: Reference = '0000000000000000000000000000000000000000000000000000000000000124' as HexString<64>
    const feedReference = await feedRw.setLastUpdate(batchId, testReference)

    const feedUpdate = await feedRw.findLastUpdate()

    expect(feedUpdate.index).toEqual(currentIndex + 1)
    expect(bytesToHex(feedUpdate.owner())).toEqual(owner)
  }, 21000)

  test('multiple updates using setUpdate and lookup', async () => {
    const reference = Utils.Hex.makeHexString('0000000000000000000000000000000000000000000000000000000000000000', 64)
    const referenceBytes = hexToBytes(reference)
    assertBytes(referenceBytes, 32)
    const multipleUpdateTopic = '3000000000000000000000000000000000000000000000000000000000000000' as Topic
    const feedRw = sequentialFeed.makeFeedRW(multipleUpdateTopic, signer)
    const lastIndex = await feedRw.getLastIndex()
    const nextIndex = lastIndex === -1 ? 0 : lastIndex + 1

    const numUpdates = 5

    for (let i = nextIndex; i < nextIndex + numUpdates; i++) {
      const referenceI = new Uint8Array([i, ...referenceBytes.slice(1)]) as Bytes<32>
      await feedRw.setUpdate(i, batchId, Utils.Hex.bytesToHex(referenceI))
    }

    for (let i = nextIndex; i < nextIndex + numUpdates; i++) {
      const referenceI = new Uint8Array([i, ...referenceBytes.slice(1)]) as Bytes<32>
      const feedUpdateResponse = await feedRw.getUpdate(i)
      expect(feedUpdateResponse.reference).toEqual(bytesToHex(referenceI))
    }
  }, 15000)
})
