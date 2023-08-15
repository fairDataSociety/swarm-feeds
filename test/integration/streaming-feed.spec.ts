import { Bee, Reference, Topic, Utils } from '@ethersphere/bee-js'
import { getCurrentTime } from '../../src/utils'
import { StreamingFeed } from '../../src/streaming-feed/index'
import { assertBytes, Bytes, bytesToHex, HexString, hexToBytes, makePrivateKeySigner } from '../../src/utils'
import { beeUrl, getPostageBatch } from '../utils'
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
  const streamingFeed = new StreamingFeed(bee)

  test('lookup for empty feed update', () => {
    const emptyTopic = '1200000000000000000000000000000000000000000000000000000000000001' as Topic
    const feedR = streamingFeed.makeFeedR(emptyTopic, testIdentity.address)
    const lastIndex = feedR.getIndexForArbitraryTime(getCurrentTime())

    expect(lastIndex).toBe(-1)
  }, 40000)

  test('setLastupdate then lookup', async () => {
    const feedRw = streamingFeed.makeFeedRW(topic, signer)

    const initialTime = getCurrentTime()
    const updatePeriod = 5
    const testReference: Reference = '0000000000000000000000000000000000000000000000000000000000000126' as HexString<64>
    await feedRw.setLastUpdate(batchId, testReference, initialTime, updatePeriod)

    const feedUpdate = await feedRw.getUpdate(initialTime, updatePeriod)
    const lastIndex = feedRw.getIndexForArbitraryTime(getCurrentTime(), initialTime, updatePeriod)

    expect(feedUpdate.index).toEqual(lastIndex)
    expect(bytesToHex(feedUpdate.owner())).toEqual(owner)
  }, 21000)

  test('findLastUpdate should return last chunk', async () => {
    const feedRw = streamingFeed.makeFeedRW(topic, signer)

    const initialTime = getCurrentTime()
    const updatePeriod = 5

    const feedUpdate = await feedRw.findLastUpdate(initialTime, updatePeriod)

    expect(bytesToHex(feedUpdate.owner())).toEqual(owner)
  }, 21000)

  test('getLastIndex should return last index', async () => {
    const feedRw = streamingFeed.makeFeedRW(topic, signer)

    const initialTime = getCurrentTime()
    const updatePeriod = 5000

    const index = await feedRw.getLastIndex(initialTime, updatePeriod)
    const feedUpdate = await feedRw.findLastUpdate(initialTime, updatePeriod)

    expect(feedUpdate.index).toEqual(index)
  }, 21000)

  test('multiple updates using setUpdate and lookup', async () => {
    const reference = Utils.Hex.makeHexString(new Date().getTime().toString().padStart(64, '0'), 64)
    const referenceBytes = hexToBytes(reference)
    assertBytes(referenceBytes, 32)
    const random = new Date().getTime().toString().padStart(64, '0')
    const multipleUpdateTopic = Utils.Hex.makeHexString(random) as Topic

    const updatePeriod = 5
    const feedRw = streamingFeed.makeFeedRW(multipleUpdateTopic, signer)

    const numUpdates = 5

    const initialTime = getCurrentTime()

    const sleep = async (seconds: number) =>
      new Promise(resolve => {
        setTimeout(() => resolve(true), seconds * 1000)
      })
    let lookupTime = getCurrentTime()
    for (let i = 0; i < 0 + numUpdates; i++) {
      const referenceI = new Uint8Array([i, ...referenceBytes.slice(1)]) as Bytes<32>

      await feedRw.setLastUpdate(batchId, Utils.Hex.bytesToHex(referenceI), initialTime, updatePeriod, lookupTime)
      await sleep(5)
      await feedRw.getUpdate(initialTime, updatePeriod, lookupTime)
      lookupTime = getCurrentTime()
    }

    const feedUpdateResponse = await feedRw.getUpdates(initialTime, updatePeriod)
    expect(feedUpdateResponse.length).toEqual(numUpdates)
    expect(feedUpdateResponse[0].updatePeriod).toEqual(updatePeriod)
    expect(feedUpdateResponse[1].updatePeriod).toEqual(updatePeriod)
    expect(feedUpdateResponse[2].updatePeriod).toEqual(updatePeriod)
    expect(feedUpdateResponse[3].updatePeriod).toEqual(updatePeriod)
    expect(feedUpdateResponse[4].updatePeriod).toEqual(updatePeriod)
  }, 45000)
})
