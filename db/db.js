let mysql = require('mysql');

let connection = mysql.createConnection({
    host: "mastersv.ru",
    user: "64dbu",
    password: "Unhj86*2",
    port: 3306,
    database: '64db'
});
connection.connect(function(err){
    if(!err) {
        console.log("Database is connected");
    } else {
        console.log("Error while connecting with database");
    }
});
module.exports = connection;