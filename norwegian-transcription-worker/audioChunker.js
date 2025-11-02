/**
 * Audio Chunking Utility for Cloudflare Workers
 * Chunks audio files without FFmpeg using pure JavaScript
 */

/**
 * Extract WAV header information
 */
function parseWavHeader(arrayBuffer) {
  const view = new DataView(arrayBuffer)
  
  // Check RIFF header
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))
  if (riff !== 'RIFF') {
    throw new Error('Not a valid WAV file')
  }
  
  const fileSize = view.getUint32(4, true)
  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11))
  
  if (wave !== 'WAVE') {
    throw new Error('Not a valid WAV file')
  }
  
  // Find fmt chunk
  let offset = 12
  while (offset < arrayBuffer.byteLength) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    )
    const chunkSize = view.getUint32(offset + 4, true)
    
    if (chunkId === 'fmt ') {
      return {
        audioFormat: view.getUint16(offset + 8, true),
        numChannels: view.getUint16(offset + 10, true),
        sampleRate: view.getUint32(offset + 12, true),
        byteRate: view.getUint32(offset + 16, true),
        blockAlign: view.getUint16(offset + 20, true),
        bitsPerSample: view.getUint16(offset + 22, true),
        dataOffset: offset + 8 + chunkSize + 8
      }
    }
    
    offset += 8 + chunkSize
  }
  
  throw new Error('fmt chunk not found')
}

/**
 * Create WAV header
 */
function createWavHeader(numChannels, sampleRate, bitsPerSample, dataLength) {
  const buffer = new ArrayBuffer(44)
  const view = new DataView(buffer)
  
  const byteRate = sampleRate * numChannels * bitsPerSample / 8
  const blockAlign = numChannels * bitsPerSample / 8
  
  // RIFF chunk descriptor
  view.setUint8(0, 'R'.charCodeAt(0))
  view.setUint8(1, 'I'.charCodeAt(0))
  view.setUint8(2, 'F'.charCodeAt(0))
  view.setUint8(3, 'F'.charCodeAt(0))
  view.setUint32(4, 36 + dataLength, true)
  view.setUint8(8, 'W'.charCodeAt(0))
  view.setUint8(9, 'A'.charCodeAt(0))
  view.setUint8(10, 'V'.charCodeAt(0))
  view.setUint8(11, 'E'.charCodeAt(0))
  
  // fmt sub-chunk
  view.setUint8(12, 'f'.charCodeAt(0))
  view.setUint8(13, 'm'.charCodeAt(0))
  view.setUint8(14, 't'.charCodeAt(0))
  view.setUint8(15, ' '.charCodeAt(0))
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  
  // data sub-chunk
  view.setUint8(36, 'd'.charCodeAt(0))
  view.setUint8(37, 'a'.charCodeAt(0))
  view.setUint8(38, 't'.charCodeAt(0))
  view.setUint8(39, 'a'.charCodeAt(0))
  view.setUint32(40, dataLength, true)
  
  return buffer
}

/**
 * Chunk audio file into smaller segments
 * 
 * @param {ArrayBuffer} audioArrayBuffer - Full audio file
 * @param {number} chunkDurationSeconds - Duration of each chunk in seconds
 * @returns {Array<ArrayBuffer>} Array of audio chunks
 */
export function chunkAudioFile(audioArrayBuffer, chunkDurationSeconds = 900) {
  try {
    // Parse WAV header
    const header = parseWavHeader(audioArrayBuffer)
    console.log('📋 WAV Info:', {
      channels: header.numChannels,
      sampleRate: header.sampleRate,
      bitsPerSample: header.bitsPerSample
    })
    
    // Calculate chunk size in bytes
    const bytesPerSample = header.bitsPerSample / 8
    const bytesPerSecond = header.sampleRate * header.numChannels * bytesPerSample
    const chunkSizeBytes = chunkDurationSeconds * bytesPerSecond
    
    // Ensure chunk size is aligned to block boundary
    const alignedChunkSize = Math.floor(chunkSizeBytes / header.blockAlign) * header.blockAlign
    
    // Extract audio data (after header)
    const audioData = audioArrayBuffer.slice(header.dataOffset)
    const totalDuration = audioData.byteLength / bytesPerSecond
    
    console.log('🔪 Chunking:', {
      totalSize: audioData.byteLength,
      totalDuration: `${Math.floor(totalDuration / 60)}:${Math.floor(totalDuration % 60)}`,
      chunkSize: alignedChunkSize,
      estimatedChunks: Math.ceil(audioData.byteLength / alignedChunkSize)
    })
    
    const chunks = []
    let offset = 0
    let chunkIndex = 0
    
    while (offset < audioData.byteLength) {
      const chunkDataSize = Math.min(alignedChunkSize, audioData.byteLength - offset)
      const chunkData = audioData.slice(offset, offset + chunkDataSize)
      
      // Create new WAV file with header
      const header = createWavHeader(
        header.numChannels,
        header.sampleRate,
        header.bitsPerSample,
        chunkDataSize
      )
      
      // Combine header + data
      const chunkBuffer = new Uint8Array(44 + chunkDataSize)
      chunkBuffer.set(new Uint8Array(header), 0)
      chunkBuffer.set(new Uint8Array(chunkData), 44)
      
      chunks.push(chunkBuffer.buffer)
      
      console.log(`📦 Chunk ${chunkIndex + 1}:`, {
        offset,
        size: chunkDataSize,
        duration: `${Math.floor(chunkDataSize / bytesPerSecond / 60)}:${Math.floor((chunkDataSize / bytesPerSecond) % 60)}`
      })
      
      offset += chunkDataSize
      chunkIndex++
    }
    
    return chunks
  } catch (error) {
    console.error('❌ Chunking error:', error)
    throw error
  }
}

/**
 * Merge diarization segments from multiple chunks
 * 
 * @param {Array<Array>} chunkSegments - Array of segment arrays from each chunk
 * @param {number} chunkDurationSeconds - Duration of each chunk
 * @returns {Array} Merged segments with adjusted timestamps
 */
export function mergeChunkSegments(chunkSegments, chunkDurationSeconds = 900) {
  const allSegments = []
  
  chunkSegments.forEach((segments, chunkIndex) => {
    const timeOffset = chunkIndex * chunkDurationSeconds
    
    const adjustedSegments = segments.map(seg => ({
      ...seg,
      start: seg.start + timeOffset,
      end: seg.end + timeOffset,
      chunkIndex
    }))
    
    allSegments.push(...adjustedSegments)
  })
  
  // Optional: Merge adjacent segments from same speaker
  const merged = []
  let current = null
  
  for (const seg of allSegments) {
    if (!current) {
      current = { ...seg }
    } else if (
      current.speaker === seg.speaker &&
      Math.abs(seg.start - current.end) < 1 // Within 1 second
    ) {
      // Extend current segment
      current.end = seg.end
    } else {
      merged.push(current)
      current = { ...seg }
    }
  }
  
  if (current) {
    merged.push(current)
  }
  
  return merged
}
