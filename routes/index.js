var express = require('express');
var router = express.Router();
const userModel = require("./users");
const postModel = require("./posts");
const passport = require('passport');
const upload = require("./multer");
// const seed = require("../seed");

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const localStrategy = require("passport-local");
passport.use(new localStrategy(userModel.authenticate()));

router.get('/', function(req, res, next) {
  res.render('LoggedOutfeed', { title: 'Express' });
});

router.get("/LoggedInfeed", async function (req, res) {

  const posts = await postModel.find({}).populate("user");
  posts.sort(() => Math.random() - 0.5);
  res.render("LoggedInfeed", { title: "express" , posts});
});

router.get('/register', function(req, res) {
  res.render("index", { title: "Express" });
})

router.post("/upload", isLoggedIn, upload.single("file"), async function(req, res) {
  if(!req.file){
    return res.status(404).send('No files were uploaded.');
  }
  const user = await userModel.findOne({username: req.session.passport.user});
  const post = await postModel.create({
    image: req.file.filename,
    text: req.body.filecaption,
    user: user._id
  })

  user.posts.push(post._id);
  await user.save();
  res.redirect("/profile");

  
});

router.get('/profile', isLoggedIn, async function(req, res, next) {
  const user = await userModel.findOne({
    username: req.session.passport.user
  })
  .populate("posts");
  
  res.render('profile', {user});
});

router.get('/login', function(req, res, next) {
  res.render('login', {error: req.flash('error')});
});

router.get('/forgot-password', function(req, res, next){
  res.render("forgot-password", {error: req.flash("error")});
})

router.get("/verify-otp", function (req, res) {
  res.render("verify-otp", { messages: req.flash() });
});

router.get("/reset-password", function (req, res) {
  res.render("reset-password");
});

router.post("/reset-password", async function (req, res) {
  if (req.body.password !== req.body.confirmPassword) {
    req.flash("error", "Passwords do not match");
    return res.redirect("/reset-password");
  }

  const user = await userModel.findOne({ email: req.session.resetEmail });

  if (!user) {
    req.flash("error", "Session expired");
    return res.redirect("/forgot-password");
  }

  await user.setPassword(req.body.password);
  user.otp = undefined;
  user.otpExpiry = undefined;
  await user.save();

  req.session.resetEmail = undefined;
  req.flash("success", "Password reset successfully");
  res.redirect("/login");
});

router.post("/verify-otp", async function (req, res) {
  const user = await userModel.findOne({ email: req.session.resetEmail });

  if (!user) {
    req.flash("error", "Session expired");
    return res.redirect("/forgot-password");
  }

  if (Date.now() > user.otpExpiry) {
    req.flash("error", "OTP expired");
    return res.redirect("/forgot-password");
  }

  if (parseInt(req.body.otp) !== user.otp) {
    req.flash("error", "Invalid OTP");
    return res.redirect("/verify-otp");
  }

  res.redirect("/reset-password");
});

router.post("/forgot-password", async function (req, res) {
  const email = req.body.email;
  const user = await userModel.findOne({ email: email });

  if (!user) {
    req.flash("error", "No account found with this email");
    return res.redirect("/forgot-password");
  }

  const otp = Math.floor(100000 + Math.random() * 900000);
  console.log("OTP:", otp);

  user.otp = otp;
  user.otpExpiry = Date.now() + 5 * 60 * 1000; 
  await user.save();

  await transporter.sendMail({
    from: process.env.EMAIL,
    to: user.email,
    subject: "Password Reset OTP",
    text: `Your OTP is ${otp}. It expires in 5 minutes.`,
  });

  req.session.resetEmail = user.email;

  res.redirect("/verify-otp");
});

router.post("/register", function(req, res){
  const { username, email, fullname } = req.body;

  const userData = new userModel({ username, email, fullname });

  userModel.register(userData, req.body.password).then(function(){
    passport.authenticate("local")(req, res, function(){
      res.redirect("/LoggedInfeed");
    })
  })
})

router.post("/login", passport.authenticate("local", {
  successRedirect: "/LoggedInfeed",
  failureRedirect: "/login",
  failureFlash: true
}), function(req, res){

})

router.get("/logout", function(req, res){
  req.logout(function(err){
    if (err) {return next(err);}
    res.redirect('/');
  });
})

function isLoggedIn(req, res, next){
  if(req.isAuthenticated()) return next();
  res.redirect("/login");
}

module.exports = router;
