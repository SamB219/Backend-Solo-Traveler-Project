const router = require("express").Router();
const Posts = require("../models/post.model");
const User = require("../models/users.model");
const uploadImage = require("../middleware/uploadImage");
const Notification = require("../models/notifications.model");
const validateSession = require("../middleware/validate.session");

// ENDPOINT: Create New Post
router.post("/new", validateSession, async (req, res) => {
  try {
    const { title, description, location, tags, image, eventDate } = req.body;
    const userId = req.userId;

    // Utilizes middleware to upload base64 image to cloudinary, returns secure URL
    const imgUrl = await uploadImage(image);
    console.log(`Link to Uploaded Image: ${imgUrl}`);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const post = new Posts({
      title,
      date: new Date(),
      description,
      location,
      tags,
      eventDate,
      imgUrl,
      username: user.userName,
    });

    const newPost = await post.save();
    res.status(200).json({
      result: newPost,
    });
  } catch (err) {
    res.status(500).json({
      ERROR: err.message,
    });
  }
});

//ENDPOINT: Return Filtered Posts
router.post("/filter", async (req, res) => {
  try {
    const { xCoord, yCoord, tags } = await req.body;
    const getFilteredPosts = await Posts.find();
    const evenMoreFiltered = [];
    const mostFiltered = [];
    let result = null;

    //Filter posts by location
    getFilteredPosts.forEach((post) => {
      let locationArray = [post.location[2], post.location[3]];
      //Javascript version of pythagorean's theorem
      let a = Math.abs(Math.abs(yCoord) - Math.abs(locationArray[0]));
      console.log(`X(c): ${yCoord}`);
      console.log(`X(p): ${locationArray[0]}`);
      console.log(`A: ${a}`);
      //   console.log(`a = ${a}`);
      let b = Math.abs(Math.abs(xCoord) - Math.abs(locationArray[1]));
      console.log(`Y(c): ${xCoord}`);
      console.log(`Y(p): ${locationArray[1]}`);
      console.log(`B: ${b}`);
      //   console.log(`b = ${b}`);
      //   console.log(`c = ${Math.sqrt(a * a + b * a)}`);
      //Range here indicates the cutoff distance for returning a post
      let aSqrd = a * a;
      let bSqrd = b * b;
      let cSqrd = aSqrd + bSqrd;
      let range = 10;
      let distance = Math.sqrt(cSqrd);
      console.log(`A SQUARED${aSqrd}`);
      console.log(`B SQUARED${bSqrd}`);
      console.log(`POST TITLE: ${post.title}`);
      console.log(`POST LOCATION: ${post.location}`);
      console.log(`CENTER: ${xCoord}, ${yCoord}`);
      console.log(`DISTANCE: ${distance}`);
      console.log(` ACCEPTABLE DISTANCE: ${range}`);
      console.log(`------------------------------`);

      if (distance < range) {
        evenMoreFiltered.push(post);
      }
    });

    //Filter posts by tags
    if (tags.length > 0 && xCoord) {
      evenMoreFiltered.forEach((post) => {
        tags.forEach((tag) => {
          if (post.tags.includes(tag)) {
            mostFiltered.push(post);
          }
        });
        result = mostFiltered;
      });
    }

    if (tags.length > 0 && !xCoord) {
      getFilteredPosts.forEach((post) => {
        tags.forEach((tag) => {
          if (post.tags.includes(tag)) {
            mostFiltered.push(post);
          }
        });
        result = mostFiltered;
      });
    }

    if (tags.length < 1) {
      result = evenMoreFiltered;
    }

    if (getFilteredPosts.length > 0) {
      res.status(200).json({
        result: result,
      });
    }
  } catch (err) {
    res.status(500).json({
      ERROR: err.message,
    });
  }
});

//ENDPOINT: Get All Posts
router.get("/all", async (req, res) => {
  try {
    const getAllPosts = await Posts.find();
    if (getAllPosts.length > 0) {
      res.status(200).json({
        result: getAllPosts,
      });
    }
  } catch (err) {
    res.status(500).json({
      ERROR: err.message,
    });
  }
});

//ENDPOINT: Get Posts by Tag
router.get("/:tag", async (req, res) => {
  try {
    const { tag } = req.params;
    console.log(tag);
    const getTaggedPost = await Posts.find({ tags: tag });
    res.status(200).json({
      result: getTaggedPost,
    });
  } catch (err) {
    res.status(500).json({
      ERROR: err.message,
    });
  }
});

//ENDPOINT: Update Post
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const info = req.body;

    const patchPost = await Posts.findOneAndUpdate({ _id: id }, info, {
      new: true,
    });
    res.status(200).json({
      message: patchPost,
    });
  } catch (err) {
    res.status(500).json({
      ERROR: err.message,
    });
  }
});

//ENDPOINT: Delete Post
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const delPost = await Posts.deleteOne({ _id: id });

    if (delPost.deletedCount) {
      res.status(200).json({
        message: "removed",
      });
    } else {
      res.send("Post does not exist");
    }
  } catch (err) {
    res.status(500).json({
      ERROR: err.message,
    });
  }
});

// ENDPOINT: Like Post
router.patch("/:id/like", validateSession, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const post = await Posts.findById(id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const existingLike = post.likes.find(
      (like) => like.user.toString() === userId
    );

    if (!existingLike) {
      post.likes.push({ user: userId, username: user.userName });
      post.likesCount += 1;
      await post.save();

      const existingNotification = await Notification.findOne({
        type: "like",
        actionBy: userId,
        postId: id,
      });

      if (!existingNotification) {
        const notificationMessage = `${user.userName} is Interested in your event!\n ${post.title}`;

        const newNotification = new Notification({
          type: "like",
          actionBy: userId,
          postId: id,
          message: notificationMessage,
          userId: post.username,
        });
        await newNotification.save();
      }
    }

    res.status(200).json({
      message: "Post liked successfully",
      likesCount: post.likesCount,
    });
  } catch (err) {
    console.error("Error in like endpoint:", err);
    res.status(500).json({ ERROR: err.message });
  }
});

// ENDPOINT: Unlike Post
router.patch("/:id/unlike", validateSession, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    // Check if the post exists
    const post = await Posts.findById(id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    // Find the index of the like associated with the user
    const likeIndex = post.likes.findIndex(
      (like) => like.user.toString() === userId
    );
    if (likeIndex === -1) {
      console.log("User has not liked the post");
      return res.status(400).json({ message: "User has not liked the post" });
    }
    post.likes.splice(likeIndex, 1); // Remove the like from the likes array
    post.likesCount -= 1;
    await post.save();

    res.status(200).json({
      message: "Post unliked successfully",
      likesCount: post.likesCount,
    });
  } catch (err) {
    console.error("Error in unlike endpoint:", err);
    res.status(500).json({ ERROR: err.message });
  }
});

router.get("/status/:id", async (req, res) => {
  try {
    const postId = req.params.id;

    const post = await Posts.findById(postId).populate({
      path: "likes",
      populate: {
        path: "user",
        select: "username",
      },
    });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.status(200).json(post);
  } catch (err) {
    console.error("Error in /status endpoint:", err);
    res.status(500).json({ ERROR: err.message });
  }
});

module.exports = router;
