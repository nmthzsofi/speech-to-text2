let mediaRecorder;
let audioChunks = [];
let collectedAnswers = {};

//Show current question div
function showQuestion(questionNumber) {
    // Hide all question containers
    const allQuestions = document.querySelectorAll('.question-container');
    allQuestions.forEach(question => {
        question.style.display = 'none';
    });

    // Show the selected question
    const selectedQuestion = document.getElementById(`question-${questionNumber}`);
    if (selectedQuestion) {
        selectedQuestion.style.display = 'block';
    }
}
// Start recording for a specific question
function startRecording(questionNumber) {
    const constraints = {
        audio: {
            sampleRate: 48000,
            echoCancellation: true
        }
    };

    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.start();
            console.log('Recording started');
            audioChunks = [];

            mediaRecorder.addEventListener("dataavailable", event => {
                audioChunks.push(event.data);
                console.log('Pushed data: ', event.data);
            });

            mediaRecorder.addEventListener("stop", () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

                // Send recording to the server
                sendToServer(audioBlob, questionNumber);
            });
        })
        .catch(error => {
            console.error('Microphone access failed:', error);
            alert('Error accessing microphone. Check browser permissions.');
        });
}

// Send audio to the server
function sendToServer(audioBlob, questionNumber) {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm'); 
    console.log("trying server");

    fetch('/upload-audio', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        const transcript = data.transcript || 'No transcript available';
        console.log("Data to be output: ", transcript);
        collectedAnswers[questionNumber] = transcript;
         document.getElementById(`result-editable-${questionNumber}`).classList.remove("hidden-field");
        document.getElementById(`result-editable-${questionNumber}`).classList.add("show-element");
         document.getElementById(`result-editable-${questionNumber}`).value = transcript;
    })
    .catch(error => {
        console.error('Error uploading file:', error);
        alert('Failed to upload file to server: ' + error.message);
    });
}

// Stop recording
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
        const tracks = mediaRecorder.stream.getTracks(); // Get all tracks from the stream
        tracks.forEach(track => track.stop()); // Stop each track
        console.log('Microphone stream stopped.');
        console.log('Recording stopped');
    }
}

// Save all answers
function saveAllAnswers() {
    //control for email address
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(document.getElementById("email-input").value)) {
    alert('Invalid email format!');
    //scrool back to view
         document.getElementById("email-input").scrollIntoView({ behavior: 'smooth', block: 'center' });
    //Add focus to the email field
       document.getElementById("email-input").focus();

    return res.status(400).json({ error: 'Invalid email format' });

    
} else {

    
    fetch('/save-all-answers', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            email: document.getElementById("email-input").value,
            answers: collectedAnswers 
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log('All answers saved:', data);
        alert('All answers saved successfully!');
    })
    .catch(error => {
        console.error('Error saving answers:', error);
        alert('Failed to save answers.');
    });
}
}

function clearAnswer(questionNumber) {
    const resultElement = document.getElementById(`result-${questionNumber}`);
    resultElement.innerText = ''; // Clear the result for the specified question
}
