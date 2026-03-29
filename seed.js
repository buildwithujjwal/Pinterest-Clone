require("dotenv").config();
const mongoose = require("mongoose");
const { faker } = require("@faker-js/faker");
const User = require("./routes/users");
const Post = require("./routes/posts");

mongoose.connect("mongodb://127.0.0.1:27017/app3");


const seedDb = async function(){
    await User.deleteMany({});
    await Post.deleteMany({});

    const response = await fetch(
      "https://api.unsplash.com/photos/random?count=30&client_id=" +
        process.env.UNSPLASH_ACCESS_KEY,
    );

    const data = await response.json();

    const imageUrls = data.map(function(photo){
      return photo.urls.regular;
    });
    console.log("Total images fetched:", imageUrls.length);

    for (let i = 0; i < 10; i++) {
      const user = await User.register(
        {
          username: faker.internet.username(),
          email: faker.internet.email(),
          fullname: faker.person.fullName(),
        },
        "test1234",
      );

      await user.save();

      for (let i = 0; i < 3; i++) {
        const post = new Post({
          user: user._id,
          image: imageUrls[Math.floor(Math.random() * imageUrls.length)],
          text: faker.lorem.sentence(),
        });

        await post.save();
        user.posts.push(post._id);
      }

      await user.save();
    }
    await mongoose.connection.close();
}

seedDb();

