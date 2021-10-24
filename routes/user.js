const express = require("express");
const router = express.Router();
const User = require("../src/models/User");
const authorization = require("../src/middleware/auth");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const path = require("path");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const Tracks = require("../src/models/Tracks");
const Note = require("../src/models/Note");

router.get("/login", (req, res) => {
  res.render("login");
});
router.get("/signup", async (req, res) => {
  var token = req.cookies.authorization;
  const finduser = await User.find({ active: true }, null, {
    sort: { name: 1 },
  });
  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) console.log(err);
      else req.user = user;
      // console.log(user);
      res.render("signup", { user: user, found: finduser });
    });
  } else res.render("signup", { user: req.user, found: finduser });
});

router.post("/signup", async (req, res) => {
  try {
    const password = req.body.password;
    const cpassword = req.body.confirmpassword;
    const userExists = await User.findOne({ email: req.body.email });
    if (userExists) {
      console.log("Email already registered");
      res.redirect("/user/signup");
      return;
    }
    if (password == cpassword) {
      const hashedPassword = await bcrypt.hash(req.body.password, 10);
      console.log(hashedPassword);
      const newUser = new User({
        email: req.body.email,
        name: req.body.name,
        password: hashedPassword,
        active: true,
      });

      const newuser = await newUser.save();
      if (!newUser) {
        console.log("Unable to signup");
        res.redirect("/user/signup");
        return;
      }
      console.log("user registered");
      res.redirect("/user/login");
    } else {
      console.log("password not matching");
    }
  } catch (error) {
    console.log(error);
    res.status(400).send(error);
  }
});

router.post("/login", async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  const user = await User.findOne({ email: email });
  if (!user) {
    console.log("User with email doesnt exist");
    return;
  }
  const checkPassword = await bcrypt.compare(req.body.password, user.password);
  if (!checkPassword) {
    console.log("password doesnt match");
    res.redirect("/user/login");
    return;
  }
  const token = jwt.sign(
    {
      name: user.name,
      email: user.email,
      userId: user._id,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1d",
    }
  );
  res.cookie("authorization", token, {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: false,
  });
  console.log("user logged in");
  res.redirect("/");
});

//get route for logging out user
router.get("/logout", function (req, res) {
  res.clearCookie("authorization");
  console.log("You are successfully logged out");
  res.redirect("/");
});

router.get("/add-track", authorization, async (req, res) => {
  res.render("track-form");
});

router.get("/tracks", authorization, async (req, res) => {
  try {
    let user = req.user;
    const founduser = await User.findOne({ email: user.email });
    await founduser.populate("tracks");
    console.log(founduser);
    res.render("track_page", {
      tracks: founduser.tracks,
    });
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

router.post("/tracks", authorization, async (req, res) => {
  try {
    let user = await User.findById(req.user.userId);
    // console.log(req.body);
    let newtrack = req.body;
    let saved = await new Tracks({
      title: req.body.title,
      author: req.user.userId,
      tracktitle: req.body.tracktitle,
      trackdescription: req.body.trackdescription,
      trackresource: req.body.trackresource,
      visibility: req.body.visibility,
    }).save();
    if (user.tracks) {
      user.tracks.push(saved);
    } else {
      user.tracks = [saved];
    }
    // console.log(saved);
    // console.log(user);
    await user.save();
    res.redirect("/user/tracks");
  } catch (err) {
    console.log(err);
  }
});

router.get("/profile", authorization, async (req, res) => {
  try {
    const finduser = await User.find({ active: true }, null, {
      sort: { name: 1 },
    });
    let user = await User.findById(req.user.userId);
    await user.populate("tracks");
    await user.populate("notes");
    console.log(user);
    res.render("profile", {
      user: user,
      found: finduser,
    });
  } catch (error) {
    console.error("Error getting the profile", error);
    // req.flash("error", "Error in getting the profile");
    // res.redirect("/");
  }
});

router.get("/edit-profile", authorization, async (req, res) => {
  let user = req.user;
  const founduser = await User.findOne({ email: user.email });
  res.render("edit_profile_form", {
    user: founduser,
  });
});

router.post("/edit-profile/:id", authorization, async (req, res) => {
  let id = req.params.id;
  // console.log(req.body);
  const saved = await User.findByIdAndUpdate(id, {
    description: req.body.description,
    goals: req.body.goals,
    location: req.body.location,
    skills: req.body.skills,
  });
  await saved.save();
  // console.log(saved);
  res.redirect("/user/profile");
});

router.get("/public-profile/:name", async (req, res) => {
  try {
    // const token = req.cookies.authorization;
    const finduser = await User.find({ active: true }, null, {
      sort: { name: 1 },
    });
    // const userBlog = await Blog.find();
    // req.dbUser = await (await User.findOne({ dscHandle: req.params.handle }))
    const token = req.cookies.authorization;
    let user;
    if (token) {
      const decodedData = await jwt.verify(token, process.env.JWT_SECRET);
      if (decodedData) user = await User.findById(decodedData.userId);
    }
    let searchedUser = await User.findOne({
      name: req.params.name,
    });
    console.log(searchedUser);
    await searchedUser.populate("tracks");
    await searchedUser.populate("skills");
    await searchedUser.populate("friends");
    if (searchedUser) {
      //   res.render("public-profile", {
      //     searchedUser,
      //     user,
      //     found: finduser,
      //   });
      res.send(searchedUser);
    } else {
      //   res.render("404-page");
      console.log("error");
    }
  } catch (error) {
    console.error(error);
    // res.render("404-page");
  }
});

router.get("/notes", authorization, async (req, res) => {
  try {
    let user = req.user;
    const founduser = await User.findOne({ email: user.email }).populate(
      "notes"
    );
    // console.log(founduser);
    res.render("notes", {
      user: founduser,
    });
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

router.post("/notes", authorization, async (req, res) => {
  try {
    let user = await User.findById(req.user.userId);
    let newnote = req.body;
    let saved = await new Note({
      title: newnote.title,
      author: req.user.userId,
      description: newnote.description,
      url: newnote.url,
    }).save();
    if (user.notes) {
      user.notes.push(saved);
    } else {
      user.notes = [saved];
    }
    console.log(saved);
    console.log(user);
    await user.save();
    res.redirect("/user/profile");
  } catch (err) {
    console.log(err);
  }
});

router.get("/friends", authorization, async (req, res) => {
  try {
    let user = req.user;
    const founduser = await User.find({ email: user.email }).populate(
      "friends"
    );
    res.send(founduser.friends);
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

//Export
module.exports = router;
