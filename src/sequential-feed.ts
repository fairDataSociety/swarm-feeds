import { BatchId, Bee, Reference, Signer, Topic, Utils } from '@ethersphere/bee-js'
import type { SingleOwnerChunk } from '@ethersphere/bee-js/dist/src/chunk/soc'
import {
  assembleSocPayload,
  FeedChunk,
  FeedType,
  fetchIndexToInt,
  makeTopic,
  mapSocToFeed,
  SwarmFeed,
  SwarmFeedR,
  SwarmFeedRW,
} from './feed'
import { ChunkReference, makeSigner, writeUint64BigEndian } from './utils'

const { Hex } = Utils
const { hexToBytes } = Hex

export class SequentialFeed implements SwarmFeed<number> {
  public readonly type: FeedType

  public constructor(public readonly bee: Bee) {
    this.type = 'sequential'
  }

  /**
   * Creates a sequential feed reader
   * @param topic a swarm topic
   * @param owner owner
   * @returns a sequential feed reader
   */
  public makeFeedR(
    topic: Topic | Uint8Array | string,
    owner: Utils.Eth.EthAddress | Uint8Array | string,
  ): SwarmFeedR<number> {
    const socReader = this.bee.makeSOCReader(owner)
    const topicHex = makeTopic(topic)
    const topicBytes = hexToBytes<32>(topicHex)
    const ownerHex = Utils.Eth.makeHexEthAddress(owner)

    /**
     * Gets the last index in the feed
     * @returns An index number
     */
    const getLastIndex = async (): Promise<number> => {
      // It fetches the latest feed on bee-side, because it is faster than lookup for the last index by individual API calls.
      const feedReader = this.bee.makeFeedReader('sequence', topic, owner)
      let index: number
      try {
        const lastUpdate = await feedReader.download()
        const { feedIndex } = lastUpdate

        index = fetchIndexToInt(feedIndex)
      } catch (e) {
        index = -1
      }

      return index
    }

    /**
     * Gets the last appended chunk in the feed
     * @returns A feed chunk
     */
    const findLastUpdate = async (): Promise<FeedChunk> => {
      const index = await getLastIndex()
      const socChunk = await socReader.download(this.getIdentifier(topicBytes, index))

      return mapSocToFeed(socChunk, index)
    }

    /**
     * Downloads a chunk by index number
     * @param index index number
     * @returns A feed chunk
     */
    const getUpdate = async (index: number): Promise<FeedChunk> => {
      const socChunk = await socReader.download(this.getIdentifier(topicBytes, index))

      return mapSocToFeed(socChunk, index)
    }

    /**
     * Download all chunk by indices
     * @param indices an array of index numbers
     * @returns An array of chunks
     */
    const getUpdates = async (indices: number[]): Promise<FeedChunk[]> => {
      const promises: Promise<SingleOwnerChunk>[] = []
      for (const index of indices) {
        promises.push(socReader.download(this.getIdentifier(topic as Utils.Bytes.Bytes<32>, index)))
      }
      const socs = await Promise.all(promises)
      const feeds: FeedChunk[] = socs.map((soc, orderIndex) => {
        return mapSocToFeed(soc, indices[orderIndex])
      })

      return feeds
    }

    return {
      type: 'sequential',
      owner: ownerHex,
      topic: topicHex,
      findLastUpdate,
      getUpdate,
      getUpdates,
      getLastIndex,
    }
  }

  /**
   * Creates a sequential feed reader / writer
   * @param topic a swarm topic
   * @param signer signer
   * @returns a sequential feed reader / writer
   */
  public makeFeedRW(topic: string | Topic | Uint8Array, signer: string | Uint8Array | Signer): SwarmFeedRW<number> {
    const canonicalSigner = makeSigner(signer)
    const topicHex = makeTopic(topic)
    const topicBytes = hexToBytes<32>(topicHex)
    const feedR = this.makeFeedR(topic, canonicalSigner.address)
    const socWriter = this.bee.makeSOCWriter(canonicalSigner)

    /**
     * Sets the upload chunk to update
     * @param index the chunk index to update
     * @param postageBatchId swarm postage batch id
     * @param reference chunk reference
     * @returns a chunk reference
     */
    const setUpdate = async (
      index: number,
      postageBatchId: string | BatchId,
      reference: Reference,
    ): Promise<Reference> => {
      const identifier = this.getIdentifier(topicBytes, index)

      return socWriter.upload(
        postageBatchId,
        identifier,
        assembleSocPayload(hexToBytes(reference) as ChunkReference), //TODO metadata
      )
    }

    /**
     * Sets the next upload chunk
     * @param postageBatchId swarm postage batch id
     * @param reference chunk reference
     * @returns a chunk reference
     */
    const setLastUpdate = async (postageBatchId: string | BatchId, reference: Reference): Promise<Reference> => {
      let index: number
      try {
        const lastIndex = await feedR.getLastIndex()
        index = lastIndex + 1
      } catch (e) {
        index = 0
      }

      return setUpdate(index, postageBatchId, reference)
    }

    return {
      ...feedR,
      setUpdate,
      setLastUpdate,
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
