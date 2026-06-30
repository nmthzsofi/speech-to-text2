const express = require('express');
const multer = require('multer');
const { SpeechClient } = require('@google-cloud/speech');
const fs = require('fs');

const app = express();
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

if (!process.env.GOOGLE_CREDENTIALS) {
    throw new Error('GOOGLE_CREDENTIALS environment variable is not set');
}

const speechClient = new SpeechClient({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS)
});

app.post('/upload-audio', upload.single('file'), (req, res) => {
    const audio = { content: req.file.buffer.toString('base64') };
    const request = {
        audio,
        config: {
            encoding: 'WEBM_OPUS',
            languageCode: 'en-US',
        },
    };

    speechClient.recognize(request)
        .then(response => {
            console.log('Google response:', JSON.stringify(response[0], null, 2));
            const results = response[0].results;
            if (!results || results.length === 0) {
                return res.json({ transcript: '' });
            }
            const transcript = results
                .map(result => result.alternatives[0].transcript)
                .join('\n');
            res.json({ transcript });
        })
        .catch(err => {
            console.error('Speech API error:', err);
            res.status(500).json({ error: 'Error processing audio file', details: err.message });
        });
});

app.post('/save-all-answers', (req, res) => {
    const answers = req.body.answers;
    const fileName = `session_${Date.now()}.txt`;
    const outputPath = path.join('/tmp', fileName);

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

module.exports = app;
