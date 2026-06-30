let mediaRecorder;
let audioChunks = [];
let collectedAnswers = {};
let activeStream = null;

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
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            activeStream = stream;
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : 'audio/webm';
            mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorder.start();
            console.log('Recording started, mimeType:', mimeType);
            audioChunks = [];

            mediaRecorder.addEventListener("dataavailable", event => {
                audioChunks.push(event.data);
            });

            mediaRecorder.addEventListener("stop", () => {
                const audioBlob = new Blob(audioChunks, { type: mimeType });
                console.log('Audio blob size:', audioBlob.size, 'type:', audioBlob.type);
                activeStream.getTracks().forEach(track => track.stop());
                activeStream = null;
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

    fetch('/upload-audio', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        const transcript = data.transcript || 'No transcript available';
        collectedAnswers[questionNumber] = transcript;
        document.getElementById(`result-${questionNumber}`).innerText = transcript;
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
        console.log('Recording stopped');
    }
}

// Save all answers
function saveAllAnswers() {
    fetch('/save-all-answers', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
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
function clearAnswer(questionNumber) {
    const resultElement = document.getElementById(`result-${questionNumber}`);
    resultElement.innerText = ''; // Clear the result for the specified question
}
