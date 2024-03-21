const express = require("express");
const app = express();
const path = require("path");
const bodyParser = require("body-parser");
const conn = require("./config/db");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { sendEmail } = require("./email");
const { exit } = require("process");
const jwt = require("jsonwebtoken");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const { protect } = require('./middlewares/authmiddleware')

app.use(cookieParser());
app.use(
  session({
    resave: true,
    saveUninitialized: true,
    secret: process.env.SECRET,
  })
);

// View engine setup
app.set("view engine", "ejs");

// Body-parser stuff
app.use(bodyParser.urlencoded({ extended: false }));

// Static file
app.use(express.static(path.join(__dirname, "/views/styles")));

// Routes

// Register page
app.get("/register", (req, res) => {
  res.render("register");
});

// Login page
app.get("/login", (req, res) => {
  res.render("login");
});

// Registering the user
app.post("/register", async (req, res) => {
  let name = req.body.name;
  let email = req.body.email;
  let password = req.body.password;

  // Check if all credentials are given
  if (!name || !email || !password) {
    res.render("register", { msg: "Please all credentials required!" });
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
                      let token = data[0].token;
                      const message = `Click here to verify ${process.env.BASE_URL}/verify/${id}/${token}`;
                      await sendEmail(req.body.email, "Verify email", message);
                      res.render("login", {
                        msg: "Please verify email to continue!",
                      });
                    }
                  });
                }
              });
            }
          });
        } else {
          res.render("register", { msg: `${email} already exists!` });
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
        const uname = data[0].name
        const email = data[0].email
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
                      res.render("verify", { msg: `Hello ${uname} verification of ${email} successful!`});
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
    res.render("login", { msg: "Input all credentials!" });
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
            res.render("login", { msg: "Email or Password not matching!" });
          } else {
            if (data[0].verified == "true") {
              // jsonwebtoken
              const token = jwt.sign(
                { id: data[0].id },
                process.env.SECRET_KEY
              );
              res.cookie("User", token);
              res.render("index", { msg: `Logged in as ${data[0].name}` });
            } else {
              res.render("login", { msg: "Please verify your email!" });
            }
          }
        } else {
          res.render("login", { msg: "Email or Password not matching!" });
        }
      }
    });
  }
});


// Cookie middleware
const validateCookie = (req, res, next) => {
  const { cookies } = req;
  if ("User" in cookies) {
    jwt.verify(req.cookies.User, process.env.SECRET_KEY, (error, decoded) => {
      if (error) console.log(error);
      const id = decoded.id;
      const sql5 = `SELECT * FROM USERS WHERE id = '${id}'`;
      conn.query(sql5, (error, data) => {
        if (error) console.log(error);
        if (data) {
          res.render("index");
          next()
        } else{
        res.render("login");
        next()
        }
      });
    });
  } else {
    res.render("login");
  }
};

// Home page
app.get("/", validateCookie, (req, res) => {
  res.render("index");
});



// Logout route
app.get("/logout", (req, res) => {
  // Destroying the cookie
  res.clearCookie('User')
  res.render('login')
  console.log('Cookie cleared!');
});


// Post page
app.get('/create', protect, (req, res) => {
  res.render('post')
})



// Create a post
app.post('/create', protect, (req, res) => {
  // res.send('Creating post')
  const text = req.body.text
  res.render('post', { msg: text })
})



// Delete a user
app.post('/delete:id', (req) => {
  let { id } = req.params.id
  // let deleteUser = await <User></User>
})


// Update a user
app.post('/update:id', (req, res) => {
  res.send('Update a post')
})

app.listen(3000, () => {
  console.log(`Server listening port 3000...`);
});
