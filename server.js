const express = require('express');
const multer = require('multer');
const { SpeechClient } = require('@google-cloud/speech');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

// Serve static files
app.use(express.static(path.join(__dirname)));

// Initialize Google Cloud Speech-to-Text
const speechClient = new SpeechClient({
    keyFilename: process.enc.KEY
});

// Handle audio file upload and transcription
app.post('/upload-audio', upload.single('file'), (req, res) => {
    const filePath = req.file.path;

    const audio = { content: fs.readFileSync(filePath).toString('base64') };
    const request = {
        audio: audio,
        config: {
            encoding: 'WEBM_OPUS',
            sampleRateHertz: 48000,
            languageCode: 'en-US',
        },
    };

    speechClient.recognize(request)
        .then(response => {
            const transcript = response[0].results
                .map(result => result.alternatives[0].transcript)
                .join('\n');

            res.json({ transcript });
        })
        .catch(err => {
            res.status(500).json({ error: 'Error processing audio file', details: err });
        });
});

// Handle saving all answers
app.post('/save-all-answers', (req, res) => {
    const answers = req.body.answers;
    const fileName = `session_${Date.now()}.txt`;
    const outputPath = path.join(__dirname, 'transcripts', fileName);

    let fileContent = '';
    for (const [question, answer] of Object.entries(answers)) {
        fileContent += `Question ${question}:\n${answer}\n\n`;
    }

    fs.writeFile(outputPath, fileContent, err => {
        if (err) {
            return res.status(500).json({ error: 'Error saving file' });
        }
        res.json({ file: fileName });
    });
});

app.listen(3000, () => {
    console.log('Server started on port 3000');
});
