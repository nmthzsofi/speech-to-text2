const express = require('express');
const multer = require('multer');
const { SpeechClient } = require('@google-cloud/speech');
const hubSpot = require ('@hubspot/api-client');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

// Serve static files
app.use(express.static(path.join(__dirname)));

// Initialize Google Cloud Speech-to-Text
const credentials = JSON.parse(process.env.KEY);

const speechClient = new SpeechClient({
    credentials
});

//initialize hubspot connection

const hubspotClient = new hubSpot.Client({
    accessToken: process.env.HUBSPOT_TOKEN,
});



// Handle audio file upload and transcription
app.post('/upload-audio', upload.single('file'), async (req, res) => {


    console.log("First step: communicate");

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

    console.log("Second step: loaded in");
    console.log("Request object:", request);
    console.log("Uploaded file path:", req.file.path);
    console.log("SpeechClient initialized:", speechClient !== undefined);

    fs.stat(filePath, (err, stats) => {
    if (err) {
        console.error('File path error:', err.message);
    } else if (stats.isFile()) {
        console.log('Path points to a valid file:', filePath);
    } else if (stats.isDirectory()) {
        console.log('Path points to a directory:', filePath);
    } else {
        console.error('Path is neither a file nor a directory:', filePath);
    }
});
//--------------------------Code for speech > 1 min
/*
 try {
        // Use longRunningRecognize for longer audio files
        const [operation] = await speechClient.longRunningRecognize(request);
        console.log("Operation started for long audio transcription.");

        // Wait for the transcription operation to complete
        const [response] = await operation.promise();
        console.log("Operation completed. Processing results...");

        // Process the transcription results
        const transcript = response.results
            .map(result => result.alternatives[0].transcript)
            .join('\n');
        console.log("Transcript: ", transcript);

        // Send the transcript back to the client
        res.json({ transcript });

    } catch (err) {
        console.error("Error during longRunningRecognize:", err);
        res.status(500).json({ error: 'Error processing audio file', details: err.message });
    }

*/

//--------------------------Code for speech < 1min 
    speechClient.recognize(request)
        .then(response => {
            const transcript = response[0].results
                .map(result => result.alternatives[0].transcript)
                .join('\n');
                console.log("Transcipt: ");
                console.log(transcript);
            
            res.json({ transcript });
            console.log("Third step: transcribed");
        })
        .catch(err => {
            console.log("Flag of Er");
            console.error("Error during speech recognition:", err);
            res.status(500).json({ error: 'Error processing audio file', details: err });
        });
});

// Handle saving all answers
app.post('/save-all-answers', (req, res) => {

console.log("Starting Hubspot proces--------------------");
console.log("Email adress: ", req.body.email);
    const answers = req.body.answers;

// Dynamically populate the properties for contactData
    const contactData = {
        properties: {
            email: req.body.email, // Include the email or any unique identifier
        },
    };


    console.log("Stop 1: creating package for Hubspot");
    // Loop through the answers object and populate the contactData properties
    for (const [questionNumber, answer] of Object.entries(answers)) {
        // Dynamically add the question and answer as key-value pairs in the properties object
        console.log("Question: ", questionNumber);
        console.log("Answer: ", answer);
        contactData.properties[`question_${questionNumber}`] = answer;
    }
    
//TRYING HUBSPORT CONNECTION
console.log("--------------------------------------Data to be sent: ");
console.log(contactData);
console.log("--------------------------------------");
console.log("Stop 2: creating dataset");

hubspotClient.crm.contacts.basicApi.create(contactData)
  .then(response => {
    console.log('Contact created:', response);
  })
  .catch(error => {
    console.error('Error creating contact:', error);
  });

console.log("Stop 3: Sending file back");


res.json({ file: 'Succeeded'});

//----------
    /*fs.writeFile(outputPath, fileContent, err => {
        if (err) {
            return res.status(500).json({ error: 'Error saving file' });
        }
        res.json({ file: fileName });
    });*/
    

});

console.log("starting server...");
const port = process.env.PORT || 3000;
console.log(port);
app.listen(port, () => {
    console.log('Server started on port!');
});
console.log("server started");
