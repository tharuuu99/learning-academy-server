const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET);
const jwt = require("jsonwebtoken");
const port = process.env.POST || 5000;
//console.log("Db user name",process.env.DB_USER)

//middleware
app.use(cors());
app.use(express.json());

// Routes
// SET TOKEN .
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: "Unauthorize access" });
  }
  const token = authorization?.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(403)
        .send({ error: true, message: "forbidden user or token has expired" });
    }
    req.decoded = decoded;
    next();
  });
};

//mongodb connection

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// MONGO DB ROUTES

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@learning-master-new.cxkt1.mongodb.net/?retryWrites=true&w=majority&appName=learning-master-new`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)

    //Create a database and collections
    const database = client.db("learning-master-new");
    const userCollection = database.collection("users");
    const classesCollection = database.collection("classes");
    const cartCollection = database.collection("cart");
    const paymentCollection = database.collection("payment");
    const enrolledCollection = database.collection("enrolled");
    const appliedCollection = database.collection("applied");
    client.connect();

    //routes for users
    app.post("/api/set-token", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_SECRET, {
        expiresIn: "24h",
      });
      res.send({ token });
    });

    //middleware for admin and instructor
    // Verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user.role === "admin") {
        next();
      } else {
        return res
          .status(401)
          .send({ error: true, message: "Unauthorize access" });
      }
    };

    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user.role === "instructor" || user.role === "admin") {
        next();
      } else {
        return res
          .status(401)
          .send({ error: true, message: "Unauthorize access" });
      }
    };

    app.post("/new-user", async (req, res) => {
      const { name, email, photoUrl, gender, phone, address } = req.body; // Destructure req.body
      const query = { email }; // Check by email
    
      try {
        // Check if the user already exists
        const existingUser = await userCollection.findOne(query);
    
        if (existingUser) {
          // User already exists, no need to insert
          res.status(200).send({
            success: false,
            message: "User already exists.",
          });
        } else {
          // Prepare the new user data
          const newUser = {
            name,
            email,
            photoUrl,
            gender,
            phone,
            address,
            role: "user", // Default role
          };
    
          // Insert new user
          const result = await userCollection.insertOne(newUser);
          res.status(201).send({
            success: true,
            message: "User added successfully.",
            result,
          });
        }
      } catch (error) {
        console.error("Error adding new user:", error);
        res.status(500).send({
          success: false,
          message: "Internal server error.",
        });
      }
    });
    

    // GET ALL USERS
    app.get("/users", async (req, res) => {
      const users = await userCollection.find({}).toArray();
      res.send(users);
    });

    // GET USER BY ID
    app.get("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const user = await userCollection.findOne(query);
      res.send(user);
    });

    // GET USER BY EMAIL
    app.get("/user/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // Delete a user

    app.delete("/delete-user/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // UPDATE USER
    app.put("/update-userbyAdmin/:id", verifyJWT,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const updatedUser = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.option,
          address: updatedUser.address,
          phone: updatedUser.phone,
          about: updatedUser.about,
          photoUrl: updatedUser.photoUrl,
          
          skills: updatedUser.skills ? updatedUser.skills : null,
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    });


    app.put("/update-profile/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const updatedUser = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          name: updatedUser.name,
          address: updatedUser.address,
          phone: updatedUser.phone,
          photoUrl: updatedUser.photoUrl,
          gender: updatedUser.gender,
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    });

    //classes routes here
    app.post("/new-class", verifyJWT, verifyInstructor, async (req, res) => {
      const newClass = req.body;
      newClass.availableSeats = parseInt(newClass.availableSeats);
      const result = await classesCollection.insertOne(newClass);
      res.send(result);
    });

    app.get("/classes", async (req, res) => {
      const query = { status: "approved" };
      const result = await classesCollection.find().toArray();
      res.send(result);
    });

    // GET ALL CLASSES
    app.get("/classes", async (req, res) => {
      const query = { status: "approved" };
      const result = await classesCollection.find(query).toArray();
      res.send(result);
    });

    // GET ALL CLASSES ADDED BY INSTRUCTOR
    app.get(
      "/classes/:email",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const email = req.params.email;
        const query = { instructorEmail: email };
        const result = await classesCollection.find(query).toArray();
        res.send(result);
      }
    );

    // GET ALL CLASSES ADDED BY INSTRUCTOR with status is pending
    app.get(
      "/classesPending/:email",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const email = req.params.email;
        const query = {
          instructorEmail: email,
          status: "pending", // Filter by status 'pending'
        };
        try {
          const result = await classesCollection.find(query).toArray();
          res.send(result);
        } catch (error) {
          console.error("Error fetching classes:", error);
          res.status(500).send({ message: "Failed to fetch classes" });
        }
      }
    );

    // GET ALL CLASSES ADDED BY INSTRUCTOR with status is approved
    app.get(
      "/classesApproved/:email",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const email = req.params.email;
        const query = {
          instructorEmail: email,
          status: "approved", // Filter by status 'approved'
        };
        try {
          const result = await classesCollection.find(query).toArray();
          res.send(result);
        } catch (error) {
          console.error("Error fetching classes:", error);
          res.status(500).send({ message: "Failed to fetch classes" });
        }
      }
    );

    // GET ALL CLASSES
    app.get("/classes", async (req, res) => {
      const query = { status: "approved" };
      const result = await classesCollection.find(query).toArray();
      res.send(result);
    });

    //manage classes
    app.get("/classes-manage", async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });

    // Change status of a class
    app.put("/change-status/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const status = req.body.status;
      console.log(req.body);
      const reason = req.body.reason;
      const filter = { _id: new ObjectId(id) };
      console.log("🚀 ~ file: index.js:180 ~ app.put ~ reason:", reason);
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          status: status,
          reason: reason,
        },
      };
      const result = await classesCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    app.put("/change-reason/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const reason = req.body.reason; // Extract only the reason from the request body
      const filter = { _id: new ObjectId(id) };

      console.log("Updating reason for:", id);
      console.log("Reason provided:", reason);

      const updateDoc = {
        $set: {
          reason: reason, // Update only the reason field
        },
      };

      try {
        const result = await classesCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        console.error("Error updating reason:", error);
        res.status(500).send({ message: "Failed to update reason", error });
      }
    });

    //get approved classes
    app.get("/approved-classes", async (req, res) => {
      const query = { status: "approved" };
      const result = await classesCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/approved-classes", async (req, res) => {
      try {
        const query = { status: "approved" }; // Only get classes with status 'approved'
        const result = await classesCollection.find(query).toArray();

        // Log the result to inspect the data
        console.log("Approved Classes:", result);

        res.send(result);
      } catch (error) {
        console.error("Error fetching approved classes:", error);
        res.status(500).send({ error: "Failed to fetch approved classes" });
      }
    });

    // GET ALL INSTRUCTORS
    app.get("/instructors", async (req, res) => {
      const query = { role: "instructor" };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    // Update a class
    app.put(
      "/update-class/:id",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const id = req.params.id;
        const updatedClass = req.body;
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const updateDoc = {
          $set: {
            name: updatedClass.name,
            description: updatedClass.description,
            price: updatedClass.price,
            availableSeats: parseInt(updatedClass.availableSeats),
            videoLink: updatedClass.videoLink,
            status: "pending",
          },
        };
        const result = await classesCollection.updateOne(
          filter,
          updateDoc,
          options
        );
        res.send(result);
      }
    );

    // Get single class by id for details page
    app.get("/class/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classesCollection.findOne(query);
      res.send(result);
    });

    //Cart Routes !-----
    // ADD TO CART
    app.post("/add-to-cart", verifyJWT, async (req, res) => {
      const newCartItem = req.body;
      const result = await cartCollection.insertOne(newCartItem);
      res.send(result);
      console.log(result);
    });

    // Get cart item id for checking if a class is already in cart
    app.get("/cart-item/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const email = req.query.email;
      const query = { classId: id, userMail: email };
      const projection = { classId: 1 };
      const result = await cartCollection.findOne(query, {
        projection: projection,
      });
      res.send(result);
    });

    app.get("/cart/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { userMail: email };
      const projection = { classId: 1 };
      const carts = await cartCollection
        .find(query, { projection: projection })
        .toArray();
      const classIds = carts.map((cart) => new ObjectId(cart.classId));
      const query2 = { _id: { $in: classIds } };
      const result = await classesCollection.find(query2).toArray();
      res.send(result);
    });
    // Delete a item form cart
    app.delete("/delete-cart-item/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { classId: id };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    //payment routes
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price) * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "LKR",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    //post payment info to db
    app.post('/payment-info', verifyJWT, async (req, res) => {
      try {
          const paymentInfo = req.body;
          const classesId = paymentInfo.classesId;
          const userEmail = paymentInfo.userEmail;
          const singleClassId = req.query.classId;
  
          let query;
          if (singleClassId) {
              query = { classId: singleClassId, userMail: userEmail };
          } else {
              query = { classId: { $in: classesId } };
          }
  
          const classesQuery = { _id: { $in: classesId.map(id => new ObjectId(id)) } };
          const classes = await classesCollection.find(classesQuery).toArray();
  
          // Ensure that classes data is valid
          if (!classes || classes.length === 0) {
              return res.status(404).send({ message: "Classes not found" });
          }
  
          // Prepare new enrollment data
          const newEnrolledData = {
              userEmail: userEmail,
              classesId: classesId.map(id => new ObjectId(id)),
              transactionId: paymentInfo.transactionId,
          };
  
          // Update each class's availableSeats and totalEnrolled individually
          for (const singleClass of classes) {
              if (singleClass.availableSeats <= 0) {
                  return res.status(400).send({ message: `No available seats for class with ID: ${singleClass._id}` });
              }
  
              await classesCollection.updateOne(
                  { _id: singleClass._id },
                  {
                      $inc: {
                          totalEnrolled: 1,
                          availableSeats: -1,
                      },
                  }
              );
          }
  
          // Insert enrollment and payment data
          const enrolledResult = await enrolledCollection.insertOne(newEnrolledData);
          const deletedResult = await cartCollection.deleteMany(query);
          const paymentResult = await paymentCollection.insertOne(paymentInfo);
  
          res.send({
            paymentResult,
            deletedResult,
            enrolledResult,
            updatedResult: { modifiedCount: classes.length }, // Provide a count
          });
      } catch (error) {
          console.error("Error processing payment:", error);
          res.status(500).send({ message: "Internal Server Error", error: error.message });
      }
  });
  

    //get payment history
    app.get('/payment-history/:email', async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await paymentCollection.find(query).sort({ date: -1 }).toArray();
      res.send(result);
  })

    //payment history length
    app.get('/payment-history-length/:email', async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const total = await paymentCollection.countDocuments(query);
      res.send({ total });
  })

    // Enrollement Routes
    app.get("/popular_classes", async (req, res) => {
      const result = await classesCollection
        .find()
        .sort({ totalEnrolled: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    app.get("/popular-instructors", async (req, res) => {
      const pipeline = [
        {
          $group: {
            _id: "$instructorEmail",
            totalEnrolled: { $sum: "$totalEnrolled" },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "email",
            as: "instructor",
          },
        },
        {
          $match: {
            "instructor.role": "instructor",
          },
        },
        {
          $project: {
            _id: 0,
            instructor: {
              $arrayElemAt: ["$instructor", 0],
            },
            totalEnrolled: 1,
          },
        },
        {
          $sort: {
            totalEnrolled: -1,
          },
        },
        {
          $limit: 6,
        },
      ];

      const result = await classesCollection.aggregate(pipeline).toArray();
      console.log(result);
      res.send(result);
    });

    // Admins stats
    app.get("/admin-stats", verifyJWT, verifyAdmin, async (req, res) => {
      // Get approved classes and pending classes and instructors
      const approvedClasses = (
        await classesCollection.find({ status: "approved" }).toArray()
      ).length;
      const pendingClasses = (
        await classesCollection.find({ status: "pending" }).toArray()
      ).length;
      const instructors = (
        await userCollection.find({ role: "instructor" }).toArray()
      ).length;
      const totalClasses = (await classesCollection.find().toArray()).length;
      const totalEnrolled = (await enrolledCollection.find().toArray()).length;
      // const totalRevenue = await paymentCollection.find().toArray();
      // const totalRevenueAmount = totalRevenue.reduce((total, current) => total + parseInt(current.price), 0);
      const result = {
        approvedClasses,
        pendingClasses,
        instructors,
        totalClasses,
        totalEnrolled,
        // totalRevenueAmount
      };
      res.send(result);
    });

    // !GET ALL INSTrUCTOR

    app.get("/instructors", async (req, res) => {
      const result = await userCollection
        .find({ role: "instructor" })
        .toArray();
      res.send(result);
    });

    app.get("/enrolled-classes/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const pipeline = [
        {
          $match: query,
        },
        {
          $lookup: {
            from: "classes",
            localField: "classesId",
            foreignField: "_id",
            as: "classes",
          },
        },
        {
          $unwind: "$classes",
        },
        {
          $lookup: {
            from: "users",
            localField: "classes.instructorEmail",
            foreignField: "email",
            as: "instructor",
          },
        },
        {
          $project: {
            _id: 0,
            classes: 1,
            instructor: {
              $arrayElemAt: ["$instructor", 0],
            },
          },
        },
      ];
      const result = await enrolledCollection.aggregate(pipeline).toArray();
      // const result = await enrolledCollection.find(query).toArray();
      res.send(result);
    });

    //applied for instructors
    // Applied route
    app.post("/as-instructor", async (req, res) => {
      const data = req.body;
      const result = await appliedCollection.insertOne(data);
      res.send(result);
    });

    app.get("/applied-instructors/:email", async (req, res) => {
      const email = req.params.email;
      const result = await appliedCollection.findOne({ email });
      res.send(result);
    });

    app.get("/applied-instructors", async (req, res) => {
      // Temporarily bypass middleware for testing
      try {
        const result = await appliedCollection.find().toArray();
        console.log(result); // Check if data is fetched
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch data" });
      }
    });

    app.put("/change-role/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email; // Extract the email from the URL parameter
      const role = req.body.role; // Extract the new role from the request body

      if (!role) {
        return res
          .status(400)
          .send({ success: false, message: "Role is required to update." });
      }

      // Step 1: Find the user in the 'applied' collection by email
      const appliedUser = await appliedCollection.findOne({ email: email });

      if (!appliedUser) {
        return res
          .status(404)
          .send({
            success: false,
            message: "User not found in applied collection",
          });
      }

      // Step 2: Find the user in the 'user' collection by email
      const user = await userCollection.findOne({ email: email });

      if (!user) {
        return res
          .status(404)
          .send({
            success: false,
            message: "User not found in user collection",
          });
      }

      // Step 3: Update the role in the 'user' collection
      const updateDoc = {
        $set: {
          role: role, // Update the role field in the 'user' collection
        },
      };

      try {
        const result = await userCollection.updateOne(
          { email: email },
          updateDoc
        );

        if (result.modifiedCount > 0) {
          res
            .status(200)
            .send({
              success: true,
              message: "Role updated successfully in user collection.",
            });
        } else {
          res
            .status(404)
            .send({
              success: false,
              message: "No change made or user not found.",
            });
        }
      } catch (error) {
        console.error("Error updating role:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to update role", error });
      }
    });

    app.delete(
      "/delete-application/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };

        try {
          // Delete the application from the applied collection
          const result = await appliedCollection.deleteOne(query);

          if (result.deletedCount > 0) {
            res
              .status(200)
              .send({
                success: true,
                message: "Application deleted successfully.",
              });
          } else {
            res
              .status(404)
              .send({ success: false, message: "Application not found." });
          }
        } catch (error) {
          console.error("Error deleting application:", error);
          res.status(500).send({ success: false, message: "Server error." });
        }
      }
    );

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Learning Academy Server is running!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
