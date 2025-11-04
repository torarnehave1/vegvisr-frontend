/**
 * Audio Chunking Utilities (Frontend)
 * Chunk audio files in the browser without FFmpeg
 */

/**
 * Chunk audio file using Web Audio API
 * Best quality, preserves audio characteristics
 *
 * @param {File|Blob} audioFile - Audio file to chunk
 * @param {number} chunkDurationSeconds - Duration per chunk (default: 15 minutes)
 * @returns {Promise<Array<AudioBuffer>>} Array of audio chunks
 */
export async function chunkAudioWithWebAudio(audioFile, chunkDurationSeconds = 900) {
  const arrayBuffer = await audioFile.arrayBuffer()
  const audioContext = new (window.AudioContext || window.webkitAudioContext)()
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

  const sampleRate = audioBuffer.sampleRate
  const chunkSamples = chunkDurationSeconds * sampleRate
  const chunks = []

  console.log('🔪 Chunking audio:', {
    duration: `${Math.floor(audioBuffer.duration / 60)}:${Math.floor(audioBuffer.duration % 60)}`,
    sampleRate,
    channels: audioBuffer.numberOfChannels,
    chunkDuration: `${chunkDurationSeconds}s`,
    estimatedChunks: Math.ceil(audioBuffer.length / chunkSamples)
  })

  for (let start = 0; start < audioBuffer.length; start += chunkSamples) {
    const end = Math.min(start + chunkSamples, audioBuffer.length)
    const chunkLength = end - start

    // Create new buffer for this chunk
    const chunkBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      chunkLength,
      sampleRate
    )

    // Copy audio data for each channel
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const sourceData = audioBuffer.getChannelData(channel)
      const chunkData = chunkBuffer.getChannelData(channel)

      // Copy samples
      for (let i = 0; i < chunkLength; i++) {
        chunkData[i] = sourceData[start + i]
      }
    }

    chunks.push(chunkBuffer)
  }

  console.log(`✅ Created ${chunks.length} chunks`)
  return chunks
}

/**
 * Convert AudioBuffer to WAV Blob with optional compression
 *
 * @param {AudioBuffer} audioBuffer - Audio buffer to convert
 * @param {Object} options - Conversion options
 * @returns {Blob} WAV file blob
 */
export function audioBufferToWav(audioBuffer, options = {}) {
  const {
    sampleRate = audioBuffer.sampleRate,
    bitDepth = 16,
    mono = false // Convert to mono to reduce size
  } = options

  // Resample if needed
  let resampledBuffer = audioBuffer
  if (sampleRate !== audioBuffer.sampleRate) {
    resampledBuffer = resampleAudioBuffer(audioBuffer, sampleRate)
  }

  // Convert to mono if requested
  const numberOfChannels = mono ? 1 : resampledBuffer.numberOfChannels
  const format = 1 // PCM
  const bytesPerSample = bitDepth / 8
  const blockAlign = numberOfChannels * bytesPerSample

  // Get channel data
  const channelData = []
  if (mono && resampledBuffer.numberOfChannels > 1) {
    // Mix down to mono
    const left = resampledBuffer.getChannelData(0)
    const right = resampledBuffer.numberOfChannels > 1
      ? resampledBuffer.getChannelData(1)
      : left
    const monoData = new Float32Array(left.length)
    for (let i = 0; i < left.length; i++) {
      monoData[i] = (left[i] + right[i]) / 2
    }
    channelData.push(monoData)
  } else {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      channelData.push(resampledBuffer.getChannelData(channel))
    }
  }

  const dataLength = resampledBuffer.length * blockAlign
  const buffer = new ArrayBuffer(44 + dataLength)
  const view = new DataView(buffer)

  // Helper to write string to buffer
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  // WAV header
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, format, true)
  view.setUint16(22, numberOfChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  writeString(36, 'data')
  view.setUint32(40, dataLength, true)

  // Interleave audio data
  let offset = 44
  for (let i = 0; i < resampledBuffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][i]))
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
      view.setInt16(offset, intSample, true)
      offset += 2
    }
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

/**
 * Simple resampling (linear interpolation)
 */
function resampleAudioBuffer(audioBuffer, targetSampleRate) {
  const sourceSampleRate = audioBuffer.sampleRate
  const ratio = sourceSampleRate / targetSampleRate
  const newLength = Math.floor(audioBuffer.length / ratio)

  const audioContext = new (window.AudioContext || window.webkitAudioContext)()
  const resampled = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    newLength,
    targetSampleRate
  )

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const sourceData = audioBuffer.getChannelData(channel)
    const targetData = resampled.getChannelData(channel)

    for (let i = 0; i < newLength; i++) {
      const sourceIndex = i * ratio
      const index = Math.floor(sourceIndex)
      const fraction = sourceIndex - index

      const sample1 = sourceData[index] || 0
      const sample2 = sourceData[Math.min(index + 1, sourceData.length - 1)] || 0

      targetData[i] = sample1 + (sample2 - sample1) * fraction
    }
  }

  return resampled
}/**
 * Process large audio file with automatic chunking and diarization
 *
 * @param {File|Blob} audioFile - Audio file to process
 * @param {Object} options - Processing options
 * @returns {Promise<Array>} All diarization segments with adjusted timestamps
 */
export async function diarizeWithChunking(audioFile, options = {}) {
  const {
    chunkDuration = 900, // 15 minutes
    workerUrl = 'https://norwegian-transcription-worker.torarnehave.workers.dev',
    onProgress = null,
    onChunkComplete = null
  } = options

  // Chunk the audio
  const chunks = await chunkAudioWithWebAudio(audioFile, chunkDuration)
  const allSegments = []

  for (let i = 0; i < chunks.length; i++) {
    const chunkStartTime = i * chunkDuration

    if (onProgress) {
      onProgress({
        current: i + 1,
        total: chunks.length,
        percent: Math.round(((i + 1) / chunks.length) * 100)
      })
    }

    console.log(`🎤 Processing chunk ${i + 1}/${chunks.length}...`)

    // Convert chunk to compressed WAV blob (mono, 16kHz for speech)
    const chunkBlob = audioBufferToWav(chunks[i], {
      sampleRate: 16000, // Downsample to 16kHz (good for speech)
      bitDepth: 16,
      mono: true // Convert to mono
    })
    console.log(`📦 Chunk ${i + 1} size: ${(chunkBlob.size / 1024 / 1024).toFixed(2)} MB`)

    try {
      // Upload chunk to R2
      const uploadResponse = await fetch(`${workerUrl}/upload`, {
        method: 'POST',
        headers: {
          'X-File-Name': `chunk_${i}_${Date.now()}.wav`
        },
        body: chunkBlob
      })

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`)
      }

      const { audioUrl } = await uploadResponse.json()
      console.log(`✅ Chunk ${i + 1} uploaded`)

      // Diarize chunk
      const diarizeResponse = await fetch(`${workerUrl}/diarize-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ audioUrl })
      })

      if (!diarizeResponse.ok) {
        throw new Error(`Diarization failed: ${diarizeResponse.statusText}`)
      }

      const { segments } = await diarizeResponse.json()
      console.log(`✅ Chunk ${i + 1} diarized: ${segments.length} segments`)

      // Adjust timestamps to absolute time
      const adjustedSegments = segments.map(seg => ({
        ...seg,
        start: seg.start + chunkStartTime,
        end: seg.end + chunkStartTime,
        chunk: i // Use 'chunk' instead of 'chunkIndex' for UI consistency
      }))

      allSegments.push(...adjustedSegments)

      if (onChunkComplete) {
        onChunkComplete({
          chunkIndex: i,
          segments: adjustedSegments,
          totalSegments: allSegments.length
        })
      }

    } catch (error) {
      console.error(`❌ Chunk ${i + 1} failed:`, error)
      throw new Error(`Failed to process chunk ${i + 1}: ${error.message}`)
    }
  }

  console.log(`✅ All chunks processed: ${allSegments.length} total segments`)

  // Optional: Merge adjacent segments from same speaker
  return mergeAdjacentSegments(allSegments)
}

/**
 * Merge adjacent segments from the same speaker
 *
 * @param {Array} segments - Diarization segments
 * @param {number} maxGap - Maximum gap in seconds to merge (default: 1s)
 * @returns {Array} Merged segments
 */
export function mergeAdjacentSegments(segments, maxGap = 1) {
  if (!segments || segments.length === 0) return []

  // Sort by start time
  const sorted = [...segments].sort((a, b) => a.start - b.start)

  const merged = []
  let current = { ...sorted[0] }

  for (let i = 1; i < sorted.length; i++) {
    const seg = sorted[i]

    // Same speaker and close in time?
    if (
      current.speaker === seg.speaker &&
      seg.start - current.end <= maxGap
    ) {
      // Extend current segment
      current.end = seg.end
    } else {
      // Push current and start new segment
      merged.push(current)
      current = { ...seg }
    }
  }

  // Push last segment
  merged.push(current)

  console.log(`🔗 Merged ${segments.length} → ${merged.length} segments`)
  return merged
}

/**
 * Format duration in seconds to MM:SS
 */
export function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Process large audio file from URL with automatic chunking
 * Downloads audio, chunks it, and processes each chunk
 *
 * @param {string} audioUrl - URL of audio file (from R2)
 * @param {Object} options - Processing options
 * @returns {Promise<Array>} All diarization segments with adjusted timestamps
 */
export async function diarizeWithChunkingFromUrl(audioUrl, options = {}) {
  const {
    chunkDuration = 900, // 15 minutes
    totalDuration = null,
    workerUrl = 'https://norwegian-transcription-worker.torarnehave.workers.dev',
    onProgress = null
  } = options

  console.log('🎵 Downloading audio from URL for chunking...')

  // Download the audio file
  const response = await fetch(audioUrl)
  if (!response.ok) {
    throw new Error(`Failed to download audio: ${response.statusText}`)
  }

  const audioBlob = await response.blob()
  console.log(`📦 Downloaded: ${(audioBlob.size / 1024 / 1024).toFixed(2)} MB`)

  // Use the main chunking function
  return await diarizeWithChunking(audioBlob, {
    chunkDuration,
    workerUrl,
    onProgress
  })
}

/**
 * Check if audio file is too large for direct processing
 *
 * @param {File} audioFile - Audio file
 * @param {number} maxSize - Max size in MB (default: 30)
 * @param {number} maxDuration - Max duration in seconds (default: 1800 = 30 min)
 * @returns {Promise<Object>} { needsChunking, size, duration, estimatedChunks }
 */
export async function checkIfNeedsChunking(audioFile, maxSize = 30, maxDuration = 1800) {
  const sizeMB = audioFile.size / 1024 / 1024

  // Quick size check
  if (sizeMB > maxSize) {
    const estimatedChunks = Math.ceil(sizeMB / maxSize)
    return {
      needsChunking: true,
      reason: 'file_size',
      size: sizeMB,
      estimatedChunks
    }
  }

  // Check duration (requires decoding)
  try {
    const arrayBuffer = await audioFile.arrayBuffer()
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    if (audioBuffer.duration > maxDuration) {
      const estimatedChunks = Math.ceil(audioBuffer.duration / maxDuration)
      return {
        needsChunking: true,
        reason: 'duration',
        duration: audioBuffer.duration,
        estimatedChunks
      }
    }

    return {
      needsChunking: false,
      size: sizeMB,
      duration: audioBuffer.duration
    }
  } catch (error) {
    console.error('Could not decode audio:', error)
    // Assume chunking needed if we can't decode
    return {
      needsChunking: sizeMB > maxSize,
      reason: 'unknown',
      size: sizeMB
    }
  }
}
