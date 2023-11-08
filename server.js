var connect = require('connect');
var serveStatic = require('serve-static');
var cors = require('cors'); // require the CORS package

// Create a Connect app
var app = connect();

// Use the CORS middleware
app.use(cors());

// ... other requires ...
var corsOptions = {
	origin: '*', // or use '*' to allow all origins
	methods: 'GET,PUT,POST,DELETE',
	allowedHeaders: 'Content-Type,Authorization',
	optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions)); // Use CORS with options
// ... serveStatic and listen ...

// Serve static files
app.use(serveStatic(__dirname));

// Start the server
app.listen(8080, function() {
	"use strict";
	console.log("Server running on 8080...");
});
