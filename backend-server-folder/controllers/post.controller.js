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

router.get("/all", async (req, res) => {
  try {
    const getAllPosts = await Posts.find().populate('likes.user', 'username');
    if (getAllPosts.length > 0) {
      res.status(200).json({
        result: getAllPosts,
      });
    } else {
      res.status(404).json({ message: "No posts found" });
    }
  } catch (err) {
    console.error("Error fetching all posts:", err);
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
      res.send("Message does not exist");
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

    // Check if the post exists
    const post = await Posts.findById(id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Fetch the user's username
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if the user has already liked the post
    const existingLike = post.likes.find(
      (like) => like.user.toString() === userId
    );

    if (!existingLike) {
      // Add the like with user's username to the likes array
      post.likes.push({ user: userId, username: user.userName });
      post.likesCount += 1;
      await post.save();

      // Check if a notification already exists for this like action
      const existingNotification = await Notification.findOne({
        type: "like",
        actionBy: userId,
        postId: id,
      });

      if (!existingNotification) {
        // Create a new notification
        const notificationMessage = `${user.userName} liked your post!\n ${post.title}`;

        const newNotification = new Notification({
          type: "like",
          actionBy: userId,
          postId: id,
          message: notificationMessage,
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
