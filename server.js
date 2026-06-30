require('dotenv').config();
const app = require('./api/index');

app.listen(3000, () => {
    console.log('Server started on port 3000');
});
