let express = require('express');
let app = express();
let path = require ('path');
let http = require('http').Server(app);
let port = process.env.PORT || 3100;

let parserRouter = require('./routes/parser');

app.use(express.static('public'));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use('/', parserRouter);


http.listen(port, function() {
    console.log('listening on *: ' + port);
});