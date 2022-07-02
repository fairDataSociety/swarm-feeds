import { Bee, Reference, Topic, Utils } from '@ethersphere/bee-js'
import type { HexString } from '@ethersphere/bee-js/dist/src/utils/hex'
import { StreamingFeed } from '../../src/streaming-feed'
import { assertBytes, Bytes, bytesToHex, hexToBytes, makePrivateKeySigner } from '../../src/utils'
import { beeUrl, getPostageBatch } from '../utils'

describe('streaming feed', () => {
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
  const streamingFeed = new StreamingFeed(bee)
  const getCurrentTimeInSeconds = () => new Date().getTime() / 1000
  test('lookup for empty feed update', async () => {
    const emptyTopic = '1200000000000000000000000000000000000000000000000000000000000001' as Topic
    const feedR = streamingFeed.makeFeedR(emptyTopic, testIdentity.address)
    const lastIndex = await feedR.getIndexForArbitraryTime(getCurrentTimeInSeconds())

    expect(lastIndex).toBe(-1)
  }, 40000)

  test('setLastupdate then lookup', async () => {
    const feedRw = streamingFeed.makeFeedRW(topic, signer)

    const initialTime = getCurrentTimeInSeconds()
    const updatePeriod = 5
    const testReference: Reference = '0000000000000000000000000000000000000000000000000000000000000126' as HexString<64>
    const feedReference = await feedRw.setLastUpdate(batchId, testReference, initialTime, updatePeriod)

    const feedUpdate = await feedRw.getUpdate(initialTime, updatePeriod)
    const lastIndex = await feedRw.getIndexForArbitraryTime(getCurrentTimeInSeconds(), initialTime, updatePeriod)

    expect(feedUpdate?.index).toEqual(lastIndex)
    expect(bytesToHex(feedUpdate?.owner())).toEqual(owner)
  }, 21000)

  // test('multiple updates using setUpdate and lookup', async () => {
  //   const reference = Utils.Hex.makeHexString('0000000000000000000000000000000000000000000000000000000000000000', 64)
  //   const referenceBytes = hexToBytes(reference)
  //   assertBytes(referenceBytes, 32)
  //   const multipleUpdateTopic = '3000000000000000000000000000000000000000000000000000000000000000' as Topic
  //   const feedRw = streamingFeed.makeFeedRW(multipleUpdateTopic, signer)
  //   const lastIndex = await feedRw.getIndexForArbitraryTime()
  //   const nextIndex = lastIndex === -1 ? 0 : lastIndex + 1

  //   const numUpdates = 5

  //   for (let i = nextIndex; i < nextIndex + numUpdates; i++) {
  //     const referenceI = new Uint8Array([i, ...referenceBytes.slice(1)]) as Bytes<32>
  //     await feedRw.setUpdate(i, batchId, Utils.Hex.bytesToHex(referenceI))
  //   }

  //   for (let i = nextIndex; i < nextIndex + numUpdates; i++) {
  //     const referenceI = new Uint8Array([i, ...referenceBytes.slice(1)]) as Bytes<32>
  //     const feedUpdateResponse = await feedRw.getUpdate(i)
  //     expect(feedUpdateResponse.reference).toEqual(bytesToHex(referenceI))
  //   }
  // }, 15000)
})
