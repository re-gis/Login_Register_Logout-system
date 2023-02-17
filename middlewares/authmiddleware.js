const conn = require('../config/db')
const jwt = require('jsonwebtoken')


const protect = async(req, res, next) => {
    let token;
    token = req.cookies.User
    const decoded = await jwt.verify(token, process.env.SECRET_KEY, (err, data) => {
        if(err) {
            // res.render('login', { msg: 'First Login Please!'})
            console.log('No JWT provided!');
        } else {
            next()
        }
    })

    if(!token) {
        res.render('login', { msg: 'First Login Please!'})
    }
}

module.exports = { 
    protect,
 }


