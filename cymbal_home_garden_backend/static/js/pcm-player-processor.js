/**
 * An audio worklet processor that stores the PCM audio data sent from the main thread
 * to a buffer and plays it.
 */
class PCMPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // Init buffer
    this.bufferSize = 24000 * 180;  // 24kHz x 180 seconds
    this.buffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
    this.readIndex = 0;

    // Handle incoming messages from main thread
    this.port.onmessage = (event) => {
      // Reset the buffer when 'endOfAudio' message received
      if (event.data.command === 'endOfAudio') {
        this.readIndex = this.writeIndex; // Clear the buffer
        console.log("PCMPlayerProcessor: endOfAudio received, clearing the buffer.");
        return;
      }

      // Assuming event.data is an ArrayBuffer containing Int16 PCM data
      const int16Samples = new Int16Array(event.data);

      // Add the audio data to the buffer
      this._enqueue(int16Samples);
    };
  }

  // Push incoming Int16 data into our ring buffer.
  _enqueue(int16Samples) {
    for (let i = 0; i < int16Samples.length; i++) {
      // Convert 16-bit integer to float in [-1, 1]
      const floatVal = int16Samples[i] / 32768;

      // Store in ring buffer for left channel only (mono)
      this.buffer[this.writeIndex] = floatVal;
      this.writeIndex = (this.writeIndex + 1) % this.bufferSize;

      // Overflow handling (overwrite oldest samples)
      if (this.writeIndex === this.readIndex) {
        this.readIndex = (this.readIndex + 1) % this.bufferSize;
        // console.warn("PCMPlayerProcessor: Buffer overflow, overwriting oldest samples.");
      }
    }
  }

  // The system calls `process()` ~128 samples at a time (depending on the browser).
  // We fill the output buffers from our ring buffer.
  process(inputs, outputs, parameters) {
    // Write a frame to the output
    const output = outputs[0]; // Assuming mono or taking the first channel group
    const framesPerBlock = output[0].length; // Number of samples in a frame for one channel

    for (let frame = 0; frame < framesPerBlock; frame++) {
      if (this.readIndex !== this.writeIndex) {
        // Write the sample(s) into the output buffer
        const sample = this.buffer[this.readIndex];
        for (let channel = 0; channel < output.length; channel++) {
          output[channel][frame] = sample; // Write same sample to all output channels
        }
        this.readIndex = (this.readIndex + 1) % this.bufferSize;
      } else {
        // Buffer is empty, output silence
        for (let channel = 0; channel < output.length; channel++) {
          output[channel][frame] = 0;
        }
      }
    }

    // Returning true tells the system to keep the processor alive
    return true;
  }
}

registerProcessor('pcm-player-processor', PCMPlayerProcessor);
