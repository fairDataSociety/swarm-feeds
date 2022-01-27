import { Bytes, keccak256Hash } from './utils'

export const marshalVersionValues = ['0.1'] as const

export type MarshalVersion = typeof marshalVersionValues[number]

export type MarshalVersionBytes = Bytes<4>

export const marshalVersionHash01 = serialiseVersion('0.1')

/**
 * The hash length has to be 31 instead of 32 that comes from the keccak hash function
 */
export function serialiseVersion(version: MarshalVersion): MarshalVersionBytes {
  const versionName = 'fdpJson'
  const versionSeparator = ':'
  const hashBytes = keccak256Hash(versionName + versionSeparator + version)

  return hashBytes.slice(0, 4) as MarshalVersionBytes
}

export function deserialiseJson<Metadata = any>(data: Uint8Array, marshalVersion: MarshalVersion): Metadata {
  if (!marshalVersionValues.includes(marshalVersion)) {
    throw new Error('Not supported JSON serialisation on deserialisation')
  }

  try {
    const jsonText = new TextDecoder().decode(data)

    return JSON.parse(jsonText)
  } catch (e) {
    throw new Error('Wrong json format at feed metadata serialisation')
  }
}

/**
 * Serialise JSON object always in the most recent serialisation version
 */
export function serialiseJson(data: unknown): Uint8Array {
  if (!data) return new Uint8Array()

  return new TextEncoder().encode(JSON.stringify(data))
}
