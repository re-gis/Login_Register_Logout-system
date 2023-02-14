const mysql = require('mysql')

// Connection to mysql database
const conn = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'Express_session'
})


module.exports = conn