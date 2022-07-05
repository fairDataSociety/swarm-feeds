import { BatchId, Bee, Reference, Signer, Topic, Utils } from '@ethersphere/bee-js'
import { FeedType } from './feed'
import {
  assembleSocPayload,
  makeTopic,
  mapSocToFeed,
  StreamingFeedChunk,
  SwarmStreamingFeed,
  SwarmStreamingFeedR,
  SwarmStreamingFeedRW,
} from './streaming'
import { ChunkReference, makeSigner, writeUint64BigEndian } from './utils'

const { Hex } = Utils
const { hexToBytes } = Hex
export const getCurrentTime = (d = new Date()) => d.getTime()
export class StreamingFeed implements SwarmStreamingFeed<number> {
  public readonly type: FeedType

  public constructor(public readonly bee: Bee) {
    this.type = 'fault-tolerant-stream'
  }

  public makeFeedR(
    topic: Topic | Uint8Array | string,
    owner: Utils.Eth.EthAddress | Uint8Array | string,
  ): SwarmStreamingFeedR<number> {
    const socReader = this.bee.makeSOCReader(owner)
    const topicHex = makeTopic(topic)
    const topicBytes = hexToBytes<32>(topicHex)
    const ownerHex = Utils.Eth.makeHexEthAddress(owner)

    const getIndexForArbitraryTime = async (
      lookupTime: number,
      initialTime: number,
      updatePeriod: number,
    ): Promise<number> => {
      const currentTime = getCurrentTime() // Tp
      try {
        //  the nearest last index to an arbitrary time (Tx) where T0 <= Tx <= Tn <= Tp
        if (currentTime >= initialTime && lookupTime >= initialTime) {
          return Math.floor((lookupTime - initialTime) / updatePeriod)
        }
      } catch (e) {
        // no-op
      }

      return -1
    }

    // Download Feed Chunk at Specific Time
    const getUpdate = async (
      initialTime: number,
      updatePeriod: number,
      lookupTime?: number,
    ): Promise<StreamingFeedChunk> => {
      lookupTime = lookupTime ?? getCurrentTime()
      const index = await getIndexForArbitraryTime(lookupTime, initialTime, updatePeriod)
      const socChunk = await socReader.download(this.getIdentifier(topicBytes, index))

      return mapSocToFeed(socChunk)
    }

    //  Download Feed Stream
    const getUpdates = async (initialTime: number, updatePeriod: number): Promise<StreamingFeedChunk[]> => {
      const feeds: StreamingFeedChunk[] = []
      // while from last to first, use lookupTime = chunk.timestamp + 1

      const index = await getIndexForArbitraryTime(getCurrentTime(), initialTime, updatePeriod)
      const socChunk = await socReader.download(this.getIdentifier(topicBytes, index - 1))

      let feed = await mapSocToFeed(socChunk)
      let i = 1
      feeds.push(feed)
      while (i < index) {
        feed = await getUpdate(initialTime, updatePeriod, feed.timestamp + updatePeriod + 1)
        i++
        feeds.push(feed)
      }

      return feeds.reverse()
    }

    return {
      type: 'fault-tolerant-stream',
      owner: ownerHex,
      topic: topicHex,
      getIndexForArbitraryTime,
      getUpdate,
      getUpdates,
    }
  }

  public makeFeedRW(
    topic: string | Topic | Uint8Array,
    signer: string | Uint8Array | Signer,
  ): SwarmStreamingFeedRW<number> {
    const canonicalSigner = makeSigner(signer)
    const topicHex = makeTopic(topic)
    const topicBytes = hexToBytes<32>(topicHex)
    const feedR = this.makeFeedR(topic, canonicalSigner.address)
    const socWriter = this.bee.makeSOCWriter(canonicalSigner)

    const _setUpdate = async (
      index: number,
      postageBatchId: string | BatchId,
      reference: Reference,
      initialTime: number,
      updatePeriod: number,
    ): Promise<Reference> => {
      const identifier = this.getIdentifier(topicBytes, index)

      return socWriter.upload(
        postageBatchId,
        identifier,
        assembleSocPayload(hexToBytes(reference) as ChunkReference, {
          at: initialTime,
          updatePeriod,
          index,
        }),
      )
    }

    const setLastUpdate = async (
      postageBatchId: string | BatchId,
      reference: Reference,
      initialTime: number,
      updatePeriod: number,
      lookupTime: number,
    ): Promise<Reference> => {
      lookupTime = lookupTime ?? getCurrentTime()
      const lastIndex = await feedR.getIndexForArbitraryTime(lookupTime, initialTime, updatePeriod)

      return _setUpdate(lastIndex, postageBatchId, reference, initialTime, updatePeriod)
    }

    return {
      ...feedR,
      setLastUpdate,
    }
  }

  /** Get Single Owner Chunk identifier */
  public getIdentifier(topic: Utils.Bytes.Bytes<32>, index: number): Utils.Bytes.Bytes<32> {
    const indexBytes = writeUint64BigEndian(index)

    return Utils.keccak256Hash(topic, indexBytes)
  }
}
