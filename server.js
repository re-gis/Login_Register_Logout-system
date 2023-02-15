const express = require("express");
const app = express();
const ejs = require("ejs");
const path = require("path");
const bodyParser = require("body-parser");
const asyncHandler = require("async-handler");
const conn = require("./config/db");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const nodeMailer = require("nodemailer");
const { sendEmail } = require("./email");
const { exit } = require("process");
const dotenv = require("dotenv").config();
const jwt=require('jsonwebtoken');
const session = require('express-session')
const cookieParser = require('cookie-parser')

app.use(cookieParser())
app.use(session({
  resave: true,
  saveUninitialized: true,
  secret: process.env.SECRET
}))

// View engine setup
app.set("view engine", "ejs");

// Body-parser stuff
app.use(bodyParser.urlencoded({ extended: false }));

// Static file
app.use(express.static(path.join(__dirname, "/views/styles")));

// Routes

// Home page
app.get("/", (req, res) => {
  res.render("index");
});

// Register page
app.get("/register", (req, res) => {
  res.render("register");
});

// Login page
app.get("/login", (req, res) => {
  if(req.session.length == 1) {
    res.send('Signup first!')
  } else {
    console.log(req.session);
    res.render("login");
  }
});

// Registering the user
app.post("/register", async (req, res) => {
  let name = req.body.name;
  let email = req.body.email;
  let password = req.body.password;

  // Check if all credentials are given
  if (!name || !email || !password) {
    res.render("register", { msg: 'Please all credentials required!'});
  } else {
    // Check if email already exists
    let sql = `SELECT * FROM users WHERE email = '${email}'`;
    conn.query(sql, async (err, data) => {
      if (err) {
        console.log(err);
      } else {
        // Check if the email doesn't exist
        if (data.length == 0) {
          // Hashing the password
          let hashedPassword = await bcrypt.hash(password, 10);
          let id = crypto.randomBytes(32).toString("hex");
          let token = crypto.randomBytes(32).toString("hex");
          let sql2 = `INSERT INTO users (id,name,email,password) VALUES ('${id}','${name}','${email}','${hashedPassword}')`;
          conn.query(sql2, (err) => {
            if (err) {
              console.log(err);
            } else {
              let query = `INSERT INTO token (id, token) VALUES ('${id}', '${token}')`;
              conn.query(query, (err) => {
                if (err) {
                  console.log("Token not saved!");
                } else {
                  const query2 = `SELECT * FROM token WHERE id = '${id}'`;
                  conn.query(query2, async (err, data) => {
                    if (err) {
                      console.log("Not getting the token user");
                    } else {
                      let userId = data[0].id;
                      let token = data[0].token;
                      const message = `${process.env.BASE_URL}/verify/${id}/${token}`;
                      await sendEmail(req.body.email, "Verify email", message);
                      res.render('login', { msg: 'Please verify email to continue!'})
                    }
                  });
                }
              });
            }
          });
        } else {
          res.render("register", { msg: `${email} already exists!`});
        }
      }
    });
  }
});

// Verify the user
app.get("/verify/:id/:token", async (req, res) => {
  let sql = `SELECT * FROM users WHERE id = '${req.params.id}'`;
  conn.query(sql, (err, data) => {
    if (err) {
      console.log(err);
      console.log("Error checking the user!");
    } else {
      if (!data) {
        console.log("Invalid link!");
        res.send("Invalid link!");
      } else {
        let sql3 = `SELECT * FROM token WHERE id = '${req.params.id}'`;
        conn.query(sql3, (err, data) => {
          if (err) {
            console.log(err);
          } else {
            if (!data) {
              console.log("Invalid link please!");
              res.send("Invalid link please!");
            } else {
              let sql4 = `UPDATE users SET verified = 'true' WHERE id = '${req.params.id}'`;
              conn.query(sql4, (err) => {
                if (err) {
                  console.log(err);
                } else {
                  let query3 = `DELETE FROM token WHERE id = '${req.params.id}'`;
                  conn.query(query3, (err) => {
                    if (err) {
                      console.log(err);
                    } else {
                      console.log("Email verified!");
                      console.log("Token deleted!");
                      res.render("login");
                    }
                  });
                }
              });
            }
          }
        });
      }
    }
  });
});

// Login the user
app.post("/login", (req, res) => {
  let email = req.body.email;
  let password = req.body.password;
  if (!email || !password) {
    res.render("login", { msg: 'Input all credentials!'});
  } else {
    // Check if the user exists in the database using email
    let sql = `SELECT * FROM users WHERE email = '${email}'`;
    conn.query(sql, async (err, data) => {
      if (err) {
        console.log(err);
      } else {
        if (data.length === 1) {
          let loginPass = data[0].password;
          // Check if the password matches
          let passExists = await bcrypt.compare(password, loginPass);
          if (!passExists) {
            res.render("login", { msg: 'Email or Password not matching!'});
          } else {
            if (data[0].verified == 'true') {

              //jsonwebtoken,
              const token=jwt.sign(data[0].id,process.env.SECRET_KEY);
              //setting token into browser
              // return res.status(200).json({
              //   token
              // })
              // const user = {
              //   id: data[0].id,
              //   name: data[0].name,
              //   email: data[0].email
              // }
              res.cookie('jwt',token);
              // console.log(req.cookies.jwt);
              // req.session.user = user
              // req.session.save()
              res.render("index", { msg: `Logged in as ${data[0].name}` });
            } else {
                res.render('login', { msg: 'Please verify your email!' })
            }
          }
        } else {
          res.render("login", { msg: 'Email or Password not matching!' });
        }
      }
    });
  }
});


app.get('/logout', (req, res) => {
  // req.session.user = user
  // req.session.destroy()
  // req.cookies.jwt=null;
  res.render('login')
})

// const user = {
//   name: 'Regis',
//   email: 'irumvaregisdmc@gmail.com'
// }

// // Session
// app.get('/log', (req, res) => {
//   req.session.user = user
//   req.session.save()
//   return res.send('logged in!')
// })


// app.get('/user', (req, res) => {
//   return res.send(req.session.user)
// })


// app.get('/logout', (req, res) => {
//   req.session.destroy()
//   res.send('Logged out!')
// })


app.listen(3000, () => {
  console.log(`Server listening port 3000...`);
});
