import { Bee, Reference, Topic, Utils } from '@ethersphere/bee-js'
import { getCurrentTime } from '../../src/utils'
import { StreamingFeed } from '../../src/streaming-feed/index'
import { assertBytes, Bytes, bytesToHex, HexString, hexToBytes, makePrivateKeySigner } from '../../src/utils'
import { beeUrl, getPostageBatch, randomTopic, sleep } from '../utils'
jest.setTimeout(360 * 1000)
describe('streaming feed', () => {
  const testIdentity = {
    privateKey: '634fb5a872396d9693e5c9f9d7233cfa93f395c093371017ff44aa9ae6564cdd' as HexString,
    publicKey: '03c32bb011339667a487b6c1c35061f15f7edc36aa9a0f8648aba07a4b8bd741b4' as HexString,
    address: '8d3766440f0d7b949a5e32995d09619a7f86e632' as HexString,
  }
  const random = new Date().getTime().toString().padStart(64, '0')
  const topic = Utils.Hex.makeHexString(random) as Topic
  const owner = Utils.Hex.makeHexString(testIdentity.address, 40)
  const signer = makePrivateKeySigner(hexToBytes(testIdentity.privateKey) as Bytes<32>)
  const bee = new Bee(beeUrl())
  const batchId = getPostageBatch()
  const updatePeriod = 1000
  const streamingFeedFactory = (initialTime: number, updatePeriod: number) => {
    return new StreamingFeed(bee, initialTime, updatePeriod)
  }

  test('lookup for empty feed update', async () => {
    const streamingFeed = streamingFeedFactory(getCurrentTime(), updatePeriod)
    const emptyTopic = randomTopic(0)
    const feedR = streamingFeed.makeFeedR(emptyTopic, testIdentity.address)

    await expect(feedR.findLastUpdate()).rejects.toThrow('There is no update found in the feed')
  }, 40000)

  test('setLastupdate then lookup', async () => {
    const initialTime = getCurrentTime()
    const streamingFeed = streamingFeedFactory(initialTime, updatePeriod)
    const feedRw = streamingFeed.makeFeedRW(topic, signer)

    const testReference: Reference = '0000000000000000000000000000000000000000000000000000000000000126' as HexString<64>
    await feedRw.setLastUpdate(batchId, testReference)

    const feedUpdate = await feedRw.getUpdate(initialTime)

    expect(bytesToHex(feedUpdate.owner())).toEqual(owner)

    const feedUpdate2 = await feedRw.findLastUpdate()
    expect(feedUpdate.index).toEqual(feedUpdate2.index)
    expect(bytesToHex(feedUpdate.owner())).toEqual(owner)

    const index = feedRw.getLastIndex()
    expect(feedUpdate.index).toEqual(index)
  }, 21000)

  test('multiple updates using setUpdate and lookup', async () => {
    const streamingFeed = streamingFeedFactory(getCurrentTime(), updatePeriod)

    const reference = Utils.Hex.makeHexString(new Date().getTime().toString().padStart(64, '0'), 64)
    const referenceBytes = hexToBytes(reference)
    assertBytes(referenceBytes, 32)
    const multipleUpdateTopic = randomTopic(2)

    const feedRw = streamingFeed.makeFeedRW(multipleUpdateTopic, signer)

    const numUpdates = 5

    let lookupTime = getCurrentTime()
    for (let i = 0; i < numUpdates; i++) {
      const referenceI = new Uint8Array([i, ...referenceBytes.slice(1)]) as Bytes<32>
      await feedRw.setLastUpdate(batchId, Utils.Hex.bytesToHex(referenceI))
      await sleep(updatePeriod)
      await feedRw.getUpdate(lookupTime)
      lookupTime = getCurrentTime()
    }

    const feedUpdateResponse = await feedRw.getUpdates()
    expect(feedUpdateResponse.length).toEqual(numUpdates)
  }, 45000)
})
