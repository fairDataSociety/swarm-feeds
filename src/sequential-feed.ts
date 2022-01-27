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

  public makeFeedR(
    topic: Topic | Uint8Array | string,
    owner: Utils.Eth.EthAddress | Uint8Array | string,
  ): SwarmFeedR<number> {
    const socReader = this.bee.makeSOCReader(owner)
    const topicHex = makeTopic(topic)
    const topicBytes = hexToBytes<32>(topicHex)
    const ownerHex = Utils.Eth.makeHexEthAddress(owner)

    const getLastIndex = async (): Promise<number> => {
      // It fetches the latest feed on bee-side, because it is faster than lookup for the last index by individual API calls.
      const feedReader = this.bee.makeFeedReader('sequence', topic, owner)
      try {
        const lastUpdate = await feedReader.download()
        const { feedIndex } = lastUpdate

        return fetchIndexToInt(feedIndex)
      } catch (e: any) {
        if (e.message === 'Not Found: lookup failed') return -1

        throw e
      }
    }

    const findLastUpdate = async (): Promise<FeedChunk> => {
      const index = await getLastIndex()
      const socChunk = await socReader.download(this.getIdentifier(topicBytes, index))

      return mapSocToFeed(socChunk, index)
    }

    const getUpdate = async (index: number): Promise<FeedChunk> => {
      const socChunk = await socReader.download(this.getIdentifier(topicBytes, index))

      return mapSocToFeed(socChunk, index)
    }

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

  public makeFeedRW(topic: string | Topic | Uint8Array, signer: string | Uint8Array | Signer): SwarmFeedRW<number> {
    const canonicalSigner = makeSigner(signer)
    const topicHex = makeTopic(topic)
    const topicBytes = hexToBytes<32>(topicHex)
    const feedR = this.makeFeedR(topic, canonicalSigner.address)
    const socWriter = this.bee.makeSOCWriter(canonicalSigner)

    const setUpdate = async (
      index: number,
      postageBatchId: string | BatchId,
      reference: Reference,
      options?: { metadata?: unknown },
    ): Promise<Reference> => {
      const identifier = this.getIdentifier(topicBytes, index)

      return socWriter.upload(
        postageBatchId,
        identifier,
        assembleSocPayload(hexToBytes(reference) as ChunkReference, { metadata: options?.metadata }),
      )
    }

    const setLastUpdate = async (
      postageBatchId: string | BatchId,
      reference: Reference,
      options?: { metadata?: unknown },
    ): Promise<Reference> => {
      let index: number
      try {
        const lastIndex = await feedR.getLastIndex()
        // eslint-disable-next-line no-console
        console.log('lastIndex', lastIndex)
        index = lastIndex + 1
      } catch (e) {
        index = 0
      }

      return setUpdate(index, postageBatchId, reference, { metadata: options?.metadata })
    }

    return {
      ...feedR,
      setUpdate,
      setLastUpdate,
    }
  }

  /** Get Single Owner Chunk identifier */
  public getIdentifier(topic: Utils.Bytes.Bytes<32>, index: number): Utils.Bytes.Bytes<32> {
    const indexBytes = writeUint64BigEndian(index)

    return Utils.keccak256Hash(topic, indexBytes)
  }
}
