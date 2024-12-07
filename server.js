
//Necessary calls of API functions

const express = require('express');
const multer = require('multer');
const { SpeechClient } = require('@google-cloud/speech');
const { Storage } = require('@google-cloud/storage');
const hubSpot = require ('@hubspot/api-client');
const fs = require('fs');
const path = require('path');

//App to handle server communication

const app = express();
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

// Serve static files

app.use(express.static(path.join(__dirname)));

// Get necessary key to access the Google speech transcription

const credentials = JSON.parse(process.env.KEY);

// Initialize transcriber connection

const speechClient = new SpeechClient({
    credentials
});

//initialize hubspot connection

const hubspotClient = new hubSpot.Client({
    accessToken: process.env.HUBSPOT_TOKEN,
});

// Initializing Google Cloud Storage for the files longer than 1 minute

const storage = new Storage({ 
    credentials 
});



// Handle audio file upload and transcription
app.post('/upload-audio', upload.single('file'), async (req, res) => {

    //First flag: Communicate with the client input
    console.log("First step: communicate");

    //get the path to the file
    const filePath = req.file.path;

/* ---------------------------------------------------------------------------- For speech < 1 min
    //create audio file through the path where the client side input is
    const audio = { content: fs.readFileSync(filePath).toString('base64') };

    // wrap audio file into a request that will be sent for transcription
    const request = {
        audio: audio,
        config: {
            encoding: 'WEBM_OPUS',
            sampleRateHertz: 48000,
            languageCode: 'en-US',
        },
    };

    //Second flag: Making sure request has been correctly created. Putting out the path to the client side input. 
    //Verify that the transcriber has been correctly set up.

    console.log("Second step: loaded in");
    console.log("Request object:", request);
    console.log("Uploaded file path:", req.file.path);
    console.log("SpeechClient initialized:", speechClient !== undefined);

    //Catching errors for later evaluation. If the path is invalid, should be fixed.
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
----------------------------------------------- For speech < 1
*/

//--------------------------Code for speech > 1 min
console.log("CASE: LONG RUNNING SPEECH");
    // Finding proper bucket
    const bucketName = 'speech-to-text-client-storage';

    //Finding the file name to upload, we don't need to load it here
    const fileName = path.basename(filePath);
    
    //Code goes through if it has been uploaded
    console.log("Upload trying...");
    await storage.bucket(bucketName).upload(filePath, {
        destination: fileName,
    });
    //Verify that it has been uploaded
    console.log(`${filePath} uploaded to ${bucketName}`);


//REFERRING TO ITEM IN BUCKET
const audio = { uri: `gs://${bucketName}/${fileName}` };
const request = {
        audio: audio,
        config: {
            encoding: 'WEBM_OPUS',
            sampleRateHertz: 48000,
            languageCode: 'en-US',
        },
    };

console.log("Request is:", request);


//if the code fails, send back the error.
try {

        // Use longRunningRecognize for longer audio files
        const [operation] = await speechClient.longRunningRecognize(request);
        console.log("Operation started for long audio transcription.");

        // Wait for the transcription operation to complete. The code will not proceed as long as the transcription has been finished
        console.log("Transcription started. Processing results...");
        const [response] = await operation.promise();
        console.log("Operation completed: ", response);

        // Process the transcription results
        if (!response.results || response.results.length === 0) {
            console.error("No transcription results found.");
            return res.status(400).json({ error: 'No transcription results found' });
            }
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
});






// Handle saving all answers

app.post('/save-all-answers', async (req, res) => {


const answers = req.body.answers;
const contactData = {
        properties: {
           email: req.body.email,
      },
    };
   
console.log("Stop 1: creating package for Hubspot");
    for (const [questionNumber, answer] of Object.entries(answers)) {
        console.log("Question: ", questionNumber);
        console.log("Answer: ", answer);
        contactData.properties[`question_${questionNumber}`] = answer;
    }
    
//Package to be sent to HubSpot
console.log("--------------------------------------Data to be sent: ");
console.log(contactData);
console.log("--------------------------------------");
console.log("Stop 2: creating dataset");

//----------------------------------------------------------------HUBSPOT API UPDATE
try {
        await findAndUpdateContact(req.body.email, contactData);

        console.log("HubSpot process completed successfully.");
        res.json({ message: 'Contact updated successfully!' });
    } catch (error) {
        console.error("Error updating HubSpot contact:", error);
        res.status(500).json({ error: 'Failed to update contact', details: error.message });
    }
});
/*
-------------------------------------------------------------------HUBSPOT API CREATION
hubspotClient.crm.contacts.basicApi.create(contactData)
  .then(response => {
    console.log('Contact created:', response);
  })
  .catch(error => {
    console.error('Error creating contact:', error);
  });

console.log("Stop 3: Sending file back");


res.json({ file: 'Succeeded'});
*/

async function findAndUpdateContact(email, updateData) {
try {
        // Step 1: Search for the contact by email
        const searchResponse = await hubspotClient.crm.contacts.searchApi.doSearch({
            filterGroups: [
                {
                    filters: [
                        {
                            propertyName: 'email',
                            operator: 'EQ',
                            value: email,
                        },
                    ],
                },
            ],
            properties: ['email'], // Specify properties to retrieve
        });
        if (searchResponse.results.length > 0) {
            const contactId = searchResponse.results[0].id;
            const updateResponse = await hubspotClient.crm.contacts.basicApi.update(contactId, updateData);
            console.log('Contact updated successfully:', updateResponse);
        } else {
            console.log('Contact not found with email:', email);
        }
   
    } catch (error) {
        console.error('Error finding or updating contact:', error.message);
    }
}



console.log("starting server...");
const port = process.env.PORT || 3000;
console.log(port);
app.listen(port, () => {
    console.log('Server started on port!');
});
console.log("server started");
