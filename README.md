[![Tests](https://github.com/fairDataSociety/swarm-feeds/actions/workflows/test.yml/badge.svg)](https://github.com/fairDataSociety/swarm-feeds/actions/workflows/test.yml)
![](https://img.shields.io/badge/Node.js-%3E%3D12.0.0-orange.svg?style=flat-square)
![](https://img.shields.io/badge/runs%20in-browser%20%7C%20node%20%7C%20webworker%20%7C%20electron-orange)

# Swarm Feeds

The current Feed implementations only let you fetch the latest update and append a new one.

This library gives you more freedom for Swarm Feed reading and manipulation by specifying indices on actions and add additional payload.

For new feed implementations, there are interfaces to implement in order to facilitate the integrations and make interoperability between Feed types.

# API

## Sequential feeds

## Feed Reader

## makeFeedR

Creates a new Feed reader

### Arguments 

| Name | Type | Description |
| ---- | ---- | ----------- |
| `topic` | `Topic \| Uint8Array \| string` |  The feeds topic |
| `owner` | `EthAddress \| Uint8Array \| string` | Address of signer |
| `options` | `any ` | Options |

### Returns

Returns a feed reader object of type SwarmFeedR<T>

### Example

```typescript
import { Bee, Reference, Topic, Utils } from '@ethersphere/bee-js'
import type { HexString } from '@ethersphere/bee-js/dist/src/utils/hex'
import { SequentialFeed } from 'swarm-feeds'
import { assertBytes, Bytes, bytesToHex, hexToBytes, makePrivateKeySigner } from 'swarm-feeds/dist/src/utils'

const myIdentity = {
    address: '8d3766440f0d7b949a5e32995d09619a7f86e632' as HexString,
}
const topic = '0000000000000000000000000000000000000000000000000000000000000000' as Topic
const sequentialFeed = new SequentialFeed(new Bee('http://localhost:1633'))

// Feed Reader
const emptyTopic = '1200000000000000000000000000000000000000000000000000000000000001' as Topic
const feedR = sequentialFeed.makeFeedR(emptyTopic, myIdentity.address)

```

## getLastIndex

Gets the last index of the feed

### Arguments 

None

### Returns

A number


##  findLastUpdate

Gets the last chunk

### Arguments 

| Name | Type | Description |
| ---- | ---- | ----------- |
| `options` | `any ` | Options |


### Returns

A FeedChunk<Index> object


##  getUpdate

Gets the chunk update the given index

### Arguments 

| Name | Type | Description |
| ---- | ---- | ----------- |
| `index` | `Index` | Options |


### Returns

A FeedChunk<Index> object


##  getUpdates

Gets a set of chunks

### Arguments 

| Name | Type | Description |
| ---- | ---- | ----------- |
| `indices` | `Index[] ` | Options |


### Returns

A FeedChunk<Index>[] array


## Feed Writer

## makeFeedRW

Creates a new Feed read-writer

### Arguments 

| Name | Type | Description |
| ---- | ---- | ----------- |
| `topic` | `Topic | Uint8Array | string` |  The feeds topic |
| `signer` | `Signer | Uint8Array | string` | Address of signer |
| `options` | `any ` | Options |

### Returns

Returns a feed reader-writer object of type SwarmFeedRW<T>

### Example

```typescript

import { Bee, Reference, Topic, Utils } from '@ethersphere/bee-js'
import type { HexString } from '@ethersphere/bee-js/dist/src/utils/hex'
import { SequentialFeed } from 'swarm-feeds'
import { assertBytes, Bytes, bytesToHex, hexToBytes, makePrivateKeySigner } from 'swarm-feeds/dist/src/utils'

const myIdentity = {
    privateKey: '634fb5a872396d9693e5c9f9d7233cfa93f395c093371017ff44aa9ae6564cdd' as HexString,
    publicKey: '03c32bb011339667a487b6c1c35061f15f7edc36aa9a0f8648aba07a4b8bd741b4' as HexString,
    address: '8d3766440f0d7b949a5e32995d09619a7f86e632' as HexString,
}
const signer = makePrivateKeySigner(hexToBytes(myIdentity.privateKey) as Bytes<32>)
const topic = '0000000000000000000000000000000000000000000000000000000000000000' as Topic
const sequentialFeed = new SequentialFeed(new Bee('http://localhost:1633'))

// Feed Reader/Writer
const feedRw = sequentialFeed.makeFeedRW(topic, signer)
const currentIndex = await feedRw.getLastIndex()

```

##  setLastUpdate

Appends a new chunk to a feed

### Arguments 

| Name | Type | Description |
| ---- | ---- | ----------- |
| `postageBatchId` | `string | BatchId ` | postage batch id |
| `reference` | `Reference` | reference |


### Returns

A Reference object


##  setUpdate

Inserts a new chunk to a feed at a specified index position

### Arguments 

| Name | Type | Description |
| ---- | ---- | ----------- |
| `index` | `Index ` | index |
| `postageBatchId` | `string | BatchId ` | postage batch id |
| `reference` | `Reference` | reference |


### Returns

A Reference object


## Streaming feeds

### Arguments 

| Name | Type | Description |
| ---- | ---- | ----------- |
| `bee` | `Bee` | Bee instance |
| `initialTime` | `number ` | initial time of streaming feed |
| `updatePeriod` | `number ` | feed update frequency |

## Feed Reader

## makeFeedR

Creates a new StreamingFeed reader

### Arguments 

| Name | Type | Description |
| ---- | ---- | ----------- |
| `topic` | `Topic | Uint8Array | string` |  The feeds topic |
| `owner` | `EthAddress | Uint8Array | string` | Address of signer |
| `options` | `any ` | Options |

### Returns

Returns a feed reader object of type SwarmStreamingFeedR<T>

### Example

```typescript
import { Bee, Reference, Topic, Utils } from '@ethersphere/bee-js'
import type { HexString } from '@ethersphere/bee-js/dist/src/utils/hex'
import { StreamingFeed } from 'swarm-feeds'
import { assertBytes, Bytes, bytesToHex, hexToBytes, makePrivateKeySigner } from 'swarm-feeds/dist/src/utils'

const myIdentity = {
    address: '8d3766440f0d7b949a5e32995d09619a7f86e632' as HexString,
}
const topic = '0000000000000000000000000000000000000000000000000000000000000000' as Topic
const initialTime = Date.now()
const period = 5000 // ms
const streamingFeed = new StreamingFeed(new Bee('http://localhost:1633'), initialTime, period)

// Feed Reader
const emptyTopic = '1200000000000000000000000000000000000000000000000000000000000001' as Topic
const feedR = streamingFeed.makeFeedR(emptyTopic, myIdentity.address)
 ```

## getIndexForArbitraryTime

Gets an index from an arbitrary time

### Arguments 

| Name | Type | Description |
| ---- | ---- | ----------- |
| `lookupTime` | `number ` | Time position to lookup |

### Returns

An Index object


##  getUpdate

Gets a chunk update from an arbitrary time, if lookup time is empty, it will return the latest update

### Arguments 

| Name | Type | Description |
| ---- | ---- | ----------- |
| `lookupTime` | `number ` | Time position to lookup (optional) |


### Returns

A StreamingFeedChunk<Index> object


##  getUpdates

Gets a set of chunks from an arbitray time


### Returns

A StreamingFeedChunk array


## Feed Writer

## makeFeedRW

Creates a new Feed read-writer

### Arguments 

| Name | Type | Description |
| ---- | ---- | ----------- |
| `topic` | `Topic | Uint8Array | string` |  The feeds topic |
| `signer` | `Signer | Uint8Array | string` | Address of signer |
| `options` | `any ` | Options |

### Returns

Returns a feed reader-writer object of type SwarmFeedRW<T>

### Example

```typescript
import { Bee, Reference, Topic, Utils } from '@ethersphere/bee-js'
import type { HexString } from '@ethersphere/bee-js/dist/src/utils/hex'
import { StreamingFeed } from 'swarm-feeds'
import { assertBytes, Bytes, bytesToHex, hexToBytes, makePrivateKeySigner } from 'swarm-feeds/dist/src/utils'

const myIdentity = {
    privateKey: '634fb5a872396d9693e5c9f9d7233cfa93f395c093371017ff44aa9ae6564cdd' as HexString,
    publicKey: '03c32bb011339667a487b6c1c35061f15f7edc36aa9a0f8648aba07a4b8bd741b4' as HexString,
    address: '8d3766440f0d7b949a5e32995d09619a7f86e632' as HexString,
}
const signer = makePrivateKeySigner(hexToBytes(myIdentity.privateKey) as Bytes<32>)
const topic = '0000000000000000000000000000000000000000000000000000000000000000' as Topic
const initialTime = Date.now()
const period = 5000 // ms
const streamingFeed = new StreamingFeed(new Bee('http://localhost:1633'), initialTime, period)

// Feed Reader/Writer
const feedRw = streamingFeed.makeFeedRW(topic, signer)

```
##  setLastUpdate

Appends a new chunk to a feed, if the lookup time is empty, it will be added to the end

### Arguments 

| Name | Type | Description |
| ---- | ---- | ----------- |
| `postageBatchId` | `string | BatchId ` | postage batch id |
| `reference` | `Reference` | reference |

### Returns

A Reference object


##  setUpdate

Sets a chunk to a feed at an index number

### Arguments 

| Name | Type | Description |
| ---- | ---- | ----------- |
| `index` | `number` | index |
| `postageBatchId` | `string \| BatchId` | postage batch id |
| `reference` | `Reference` | wrapped chunk reference |

### Returns

A Reference of the Feed chunk
