const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const fs = require('fs');
const path = require('path');
const say = require('say');

function testEdge() {
  return new Promise(async (resolve, reject) => {
    console.log("Testing Edge Neural TTS via stream...");
    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata("de-AT-IngridNeural", OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      
      const text = "Hallo, das ist eine natürlich klingende Stimme aus Österreich.";
      const outputFolder = path.join(__dirname, 'uploads', 'audio');
      if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
      }
      const outputPath = path.join(outputFolder, 'test_edge.mp3');
      
      console.log("Synthesizing stream to file:", outputPath);
      const { audioStream } = tts.toStream(text);
      const writeStream = fs.createWriteStream(outputPath);
      
      audioStream.pipe(writeStream);
      
      writeStream.on('finish', () => {
        console.log("Saved Edge TTS stream to:", outputPath);
        resolve();
      });
      
      writeStream.on('error', (err) => {
        console.error("WriteStream Error:", err);
        reject(err);
      });

      audioStream.on('error', (err) => {
        console.error("AudioStream Error:", err);
        reject(err);
      });
    } catch (e) {
      reject(e);
    }
  });
}

function testSay() {
  return new Promise((resolve, reject) => {
    console.log("Testing Local Say TTS...");
    const text = "Hello, this is a local fallback voice.";
    const outputFolder = path.join(__dirname, 'uploads', 'audio');
    const outputPath = path.join(outputFolder, 'test_say.wav');
    
    say.export(text, null, 1.0, outputPath, (err) => {
      if (err) {
        console.error("Local TTS Error:", err);
        reject(err);
      } else {
        console.log("Saved Local TTS to:", outputPath);
        resolve();
      }
    });
  });
}

async function run() {
  try {
    await testEdge();
    await testSay();
    console.log("Both tests passed!");
  } catch (err) {
    console.error("Test failed:", err);
  }
}

run();
