import { BatchId, Bee, Reference, Signer, Topic, Utils } from '@ethersphere/bee-js'
import { assembleSocPayload, FeedChunk, makeTopic, mapSocToFeed, SwarmFeed } from '../feed'
import { getIndexForArbitraryTime, SwarmStreamingFeedRW, FaultTolerantStreamType, SwarmStreamingFeedR } from './utils'
import { ChunkReference, makeSigner, writeUint64BigEndian, getCurrentTime } from '../utils'

const { Hex } = Utils
const { hexToBytes } = Hex

export class StreamingFeed implements SwarmFeed<number> {
  public readonly type: FaultTolerantStreamType = 'fault-tolerant-stream'

  /**
   * @param bee initialized BeeJS Bee instance
   * @param initialTime initial time of streaming feed
   * @param updatePeriod streaming feed frequency in milliseconds
   */
  public constructor(public readonly bee: Bee, private initialTime: number, private updatePeriod: number) {}

  /**
   * Creates a streaming feed reader
   * @param topic a swarm topic
   * @param owner owner
   * @returns a streaming feed reader
   */
  public makeFeedR(
    topic: Topic | Uint8Array | string,
    owner: Utils.Eth.EthAddress | Uint8Array | string,
  ): SwarmStreamingFeedR {
    const socReader = this.bee.makeSOCReader(owner)
    const topicHex = makeTopic(topic)
    const topicBytes = hexToBytes<32>(topicHex)
    const ownerHex = Utils.Eth.makeHexEthAddress(owner)

    /**
     * Gets the last index in the feed
     * @returns An index number
     */
    const getLastIndex = (): number => {
      const lookupTime = getCurrentTime()

      return getIndexForArbitraryTime(lookupTime, this.initialTime, this.updatePeriod)
    }

    /**
     * Gets the last appended chunk in the feed
     * @returns A feed chunk
     */
    const findLastUpdate = async (): Promise<FeedChunk> => {
      return getUpdate()
    }

    /**
     * Download Feed Chunk at Specific Time
     * @param lookupTime lookup time
     * @param discover indicates whether the algorithm will look for the closest successful hit
     * @returns a FeedChunk object
     */
    const getUpdate = async (lookupTime?: number, discover = true): Promise<FeedChunk> => {
      lookupTime = lookupTime ?? getCurrentTime()
      let index = getIndexForArbitraryTime(lookupTime, this.initialTime, this.updatePeriod)
      while (index >= 0) {
        try {
          const socChunk = await socReader.download(this.getIdentifier(topicBytes, index))

          return mapSocToFeed(socChunk, index)
        } catch (e) {
          if (!discover) throw e

          index--
        }
      }

      throw new Error(`There is no update found in the feed`)
    }

    /**
     * Download all feed chunks
     *
     * @returns a StreamingFeedChunk array object
     */
    const getUpdates = async (): Promise<FeedChunk[]> => {
      const feeds: FeedChunk[] = []

      let index = getIndexForArbitraryTime(getCurrentTime(), this.initialTime, this.updatePeriod)

      let feed: FeedChunk
      while (index >= 0) {
        try {
          const socChunk = await socReader.download(this.getIdentifier(topicBytes, index))
          feed = mapSocToFeed(socChunk, index)
          feeds.push(feed)
        } catch (e) {
          // NOOP
        }
        index--
      }

      return feeds
    }

    const getIndexForArbitraryTimeWrapper = (lookupTime: number) => {
      return getIndexForArbitraryTime(lookupTime, this.initialTime, this.updatePeriod)
    }

    return {
      type: 'fault-tolerant-stream',
      owner: ownerHex,
      topic: topicHex,
      getIndexForArbitraryTime: getIndexForArbitraryTimeWrapper,
      getUpdate,
      getUpdates,
      findLastUpdate,
      getLastIndex,
    }
  }

  /**
   * Creates a streaming feed reader / writer
   * @param topic a swarm topic
   * @param signer signer
   * @returns a streaming feed reader / writer
   */
  public makeFeedRW(topic: string | Topic | Uint8Array, signer: string | Uint8Array | Signer): SwarmStreamingFeedRW {
    const canonicalSigner = makeSigner(signer)
    const topicHex = makeTopic(topic)
    const topicBytes = hexToBytes<32>(topicHex)
    const feedR = this.makeFeedR(topic, canonicalSigner.address)
    const socWriter = this.bee.makeSOCWriter(canonicalSigner)

    /**
     * Sets the upload chunk to update
     * @param lookupTime lookup time in ms
     * @param postageBatchId swarm postage batch id
     * @param reference chunk reference
     * @returns a chunk reference
     */
    const setUpdate = async (
      lookupTime: number,
      postageBatchId: string | BatchId,
      reference: Reference,
    ): Promise<Reference> => {
      const index = feedR.getIndexForArbitraryTime(lookupTime)
      const identifier = this.getIdentifier(topicBytes, index)

      return socWriter.upload(postageBatchId, identifier, assembleSocPayload(hexToBytes(reference) as ChunkReference))
    }

    /**
     * Sets the next upload chunk
     *
     * @param lookupTime lookup time in millisec
     * @param postageBatchId swarm postage batch id
     * @param reference chunk reference
     * @returns a chunk reference
     */
    const setLastUpdate = async (postageBatchId: string | BatchId, reference: Reference): Promise<Reference> => {
      return setUpdate(getCurrentTime(), postageBatchId, reference)
    }

    return {
      ...feedR,
      setLastUpdate,
      setUpdate,
    }
  }

  /**
   * Get Single Owner Chunk identifier
   * @param topic a swarm topic, bytes 32 length
   * @param index the chunk index
   * @returns a bytes 32
   */
  public getIdentifier(topic: Utils.Bytes.Bytes<32>, index: number): Utils.Bytes.Bytes<32> {
    const indexBytes = writeUint64BigEndian(index)

    return Utils.keccak256Hash(topic, indexBytes)
  }
}
